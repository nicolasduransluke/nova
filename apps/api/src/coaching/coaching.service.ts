import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import { MetabolicAgentService } from '../agents/metabolic-agent.service';
import { PushNotificationService } from './push-notification.service';
import { generateId } from '@nova/utils';
import type { Profile } from '@nova/types';

interface CoachingUser {
  id: string;
  name: string;
  pushToken: string;
  timezone: string;
  language: string; // 'es' | 'en'
  profile: {
    weight: number;
    height: number;
    age: number;
    sex: string;
    activityLevel: string;
    goalWeight: number | null;
    weeklyGoal: number | null;
  } | null;
}

const COACHING_TITLES: Record<string, Record<string, string>> = {
  es: {
    meal_reminder: 'NOVA - Recordatorio',
    daily_summary: 'NOVA - Resumen del día',
    streak: 'NOVA - Racha',
    pattern_insight: 'NOVA - Insight semanal',
  },
  en: {
    meal_reminder: 'NOVA - Reminder',
    daily_summary: 'NOVA - Daily Summary',
    streak: 'NOVA - Streak',
    pattern_insight: 'NOVA - Weekly Insight',
  },
};

@Injectable()
export class CoachingService {
  private readonly logger = new Logger(CoachingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly claudeClient: ClaudeClientService,
    private readonly metabolicAgent: MetabolicAgentService,
    private readonly pushNotification: PushNotificationService,
  ) {}

  // ==========================================
  // 1. Meal Reminders — every hour, check local time
  // ==========================================
  @Cron('0 * * * *')
  async handleMealReminders(): Promise<void> {
    this.logger.debug('Running meal reminder cron');
    const users = await this.getCoachingUsers();

    for (const user of users) {
      try {
        const localHour = this.getLocalHour(user.timezone);

        // breakfast=11, lunch=15, dinner=21
        let mealType: string | null = null;
        let threshold: number;
        if (localHour === 11) {
          mealType = 'breakfast';
          threshold = 200;
        } else if (localHour === 15) {
          mealType = 'lunch';
          threshold = 500;
        } else if (localHour === 21) {
          // 21 is shared with daily summary — skip meal reminder at 21
          continue;
        } else {
          continue;
        }

        // Check if already sent today
        const today = this.getTodayDateForUser(user.timezone);
        const alreadySent = await this.hasCoachingLog(user.id, 'meal_reminder', mealType, today);
        if (alreadySent) continue;

        // Check today's intake
        const todayIntake = await this.getTodayIntake(user.id, user.timezone);
        if (todayIntake >= threshold) continue;

        // Generate message
        const lang = user.language;
        const isSpanish = lang !== 'en';
        const mealLabel = isSpanish
          ? (mealType === 'breakfast' ? 'desayuno' : 'almuerzo')
          : (mealType === 'breakfast' ? 'breakfast' : 'lunch');
        const timeLabel = isSpanish
          ? (mealType === 'breakfast' ? 'media mañana' : 'media tarde')
          : (mealType === 'breakfast' ? 'late morning' : 'mid-afternoon');
        const prompt = `Generate a brief, friendly meal reminder in ${isSpanish ? 'Spanish' : 'English'} for ${user.name}.
It's ${timeLabel} and they've only logged ${todayIntake} kcal so far today.
Remind them to log their ${mealLabel}.
Keep it under 2 sentences, warm and motivating. Don't use emojis.`;

        const message = await this.claudeClient.generateResponse(prompt, {
          systemPrompt: `You are NOVA, a calorie deficit coach. Generate brief coaching messages in ${isSpanish ? 'Spanish' : 'English'}.`,
          maxTokens: 150,
          temperature: 0.8,
        });

        await this.saveAndSend(user.id, user.pushToken, 'meal_reminder', mealType, today, message, lang);
      } catch (error) {
        this.logger.error(`Meal reminder error for user ${user.id}: ${error}`);
      }
    }
  }

  // ==========================================
  // 2. Daily Summary — every hour, fires at 9pm local
  // ==========================================
  @Cron('0 * * * *')
  async handleDailySummary(): Promise<void> {
    this.logger.debug('Running daily summary cron');
    const users = await this.getCoachingUsers();

    for (const user of users) {
      try {
        const localHour = this.getLocalHour(user.timezone);
        if (localHour !== 21) continue;

        const today = this.getTodayDateForUser(user.timezone);
        const alreadySent = await this.hasCoachingLog(user.id, 'daily_summary', '', today);
        if (alreadySent) continue;

        // Get today's data
        const todayIntake = await this.getTodayIntake(user.id, user.timezone);
        const todayBurn = await this.getTodayBurn(user.id, user.timezone);

        // Skip if no intake logged at all
        if (todayIntake === 0) continue;

        // Build profile for TDEE calculation
        const profile = user.profile ? {
          weight: user.profile.weight,
          height: user.profile.height,
          age: user.profile.age,
          sex: user.profile.sex as Profile['sex'],
          activityLevel: (user.profile.activityLevel || 'moderate') as Profile['activityLevel'],
          goalWeight: user.profile.goalWeight ?? undefined,
          weeklyGoal: user.profile.weeklyGoal ?? undefined,
        } as Profile : undefined;

        const summary = this.metabolicAgent.calculateDailySummary(
          profile,
          todayIntake,
          todayBurn,
        );

        const lang = user.language;
        const isSpanish = lang !== 'en';
        const prompt = `Generate a brief daily summary in ${isSpanish ? 'Spanish' : 'English'} for ${user.name}. Here are today's numbers:
- Consumed: ${todayIntake} kcal
- Exercise burn: ${todayBurn} kcal
- TDEE: ${summary.tdee} kcal
- Deficit: ${summary.deficit} kcal
- Target deficit: ${summary.targetDeficit} kcal
- Projected weekly loss: ${summary.projectedWeeklyLoss} kg/week

${summary.deficit >= summary.targetDeficit ? 'They met their deficit goal today.' : 'They fell short of their deficit goal.'}
Keep it under 3 sentences. Be encouraging and data-focused. Don't use emojis.`;

        const message = await this.claudeClient.generateResponse(prompt, {
          systemPrompt: `You are NOVA, a calorie deficit coach. Generate brief coaching messages in ${isSpanish ? 'Spanish' : 'English'}.`,
          maxTokens: 200,
          temperature: 0.7,
        });

        await this.saveAndSend(user.id, user.pushToken, 'daily_summary', '', today, message, lang);
      } catch (error) {
        this.logger.error(`Daily summary error for user ${user.id}: ${error}`);
      }
    }
  }

  // ==========================================
  // 3. Progress & Streaks — daily at 2pm UTC
  // ==========================================
  @Cron('0 14 * * *')
  async handleStreaksAndProgress(): Promise<void> {
    this.logger.debug('Running streaks cron');
    const users = await this.getCoachingUsers();

    for (const user of users) {
      try {
        const today = this.getTodayDateForUser(user.timezone);

        // Calculate logging streak
        const streak = await this.calculateStreak(user.id);
        const milestones = [3, 7, 14, 21, 30, 60, 90];

        if (milestones.includes(streak)) {
          const alreadySent = await this.hasCoachingLog(user.id, 'streak', `day_${streak}`, today);
          if (!alreadySent) {
            const lang = user.language;
            const isSpanish = lang !== 'en';
            const prompt = `Generate a streak celebration message in ${isSpanish ? 'Spanish' : 'English'} for ${user.name}.
They have logged their meals for ${streak} consecutive days!
Keep it under 2 sentences. Be enthusiastic but not over-the-top. Don't use emojis.`;

            const message = await this.claudeClient.generateResponse(prompt, {
              systemPrompt: `You are NOVA, a calorie deficit coach. Generate brief coaching messages in ${isSpanish ? 'Spanish' : 'English'}.`,
              maxTokens: 150,
              temperature: 0.8,
            });

            await this.saveAndSend(user.id, user.pushToken, 'streak', `day_${streak}`, today, message, lang);
          }
        }

        // Check for weight milestones
        if (user.profile?.goalWeight) {
          await this.checkWeightMilestone(user, today);
        }

        // Nudge if no weight log in 7+ days
        await this.checkWeightNudge(user, today);
      } catch (error) {
        this.logger.error(`Streak error for user ${user.id}: ${error}`);
      }
    }
  }

  // ==========================================
  // 4. Pattern Insights — Mondays 10am UTC
  // ==========================================
  @Cron('0 10 * * 1')
  async handlePatternInsights(): Promise<void> {
    this.logger.debug('Running pattern insights cron');
    const users = await this.getCoachingUsers();

    for (const user of users) {
      try {
        const today = this.getTodayDateForUser(user.timezone);
        const alreadySent = await this.hasCoachingLog(user.id, 'pattern_insight', '', today);
        if (alreadySent) continue;

        // Get last 14 days of entries
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const entries = await this.prisma.calorieEntry.findMany({
          where: {
            userId: user.id,
            type: 'intake',
            date: { gte: twoWeeksAgo },
          },
          orderBy: { date: 'asc' },
        });

        // Need at least 7 data points
        if (entries.length < 7) continue;

        // Build daily intake map
        const dailyMap: Record<string, number> = {};
        for (const entry of entries) {
          const dateKey = entry.date.toISOString().split('T')[0];
          dailyMap[dateKey] = (dailyMap[dateKey] || 0) + entry.calories;
        }

        const lang = user.language;
        const isSpanish = lang !== 'en';
        const prompt = `Analyze this 2-week daily calorie intake data and find patterns.
Data (date: calories): ${JSON.stringify(dailyMap)}

Look for:
- Weekend vs weekday differences
- Consistently high/low days
- Trends (improving or worsening)
- Any notable pattern

If there's NO interesting pattern, respond with exactly: NO_PATTERN
Otherwise, generate a brief insight message in ${isSpanish ? 'Spanish' : 'English'} (2-3 sentences).
Be specific with numbers. Don't use emojis.`;

        const message = await this.claudeClient.generateResponse(prompt, {
          systemPrompt: `You are NOVA, a calorie deficit coach. Analyze eating patterns and give brief insights in ${isSpanish ? 'Spanish' : 'English'}.`,
          maxTokens: 200,
          temperature: 0.7,
        });

        if (message.trim() === 'NO_PATTERN') continue;

        await this.saveAndSend(user.id, user.pushToken, 'pattern_insight', '', today, message, lang);
      } catch (error) {
        this.logger.error(`Pattern insight error for user ${user.id}: ${error}`);
      }
    }
  }

  // ==========================================
  // Helper: Save chat message + send push + log
  // ==========================================
  private async saveAndSend(
    userId: string,
    pushToken: string,
    type: string,
    subtype: string,
    date: Date,
    message: string,
    language: string = 'es',
  ): Promise<void> {
    // 1. Create ChatMessage
    await this.prisma.chatMessage.create({
      data: {
        id: generateId(),
        userId,
        type: 'text',
        content: message,
        sender: 'agent',
        metadata: {
          source: 'coaching',
          coachingType: type,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // 2. Send push notification
    const titles = COACHING_TITLES[language] || COACHING_TITLES.es;
    const title = titles[type] || 'NOVA';
    const pushSent = await this.pushNotification.sendPushNotification(
      pushToken,
      title,
      message.length > 100 ? message.substring(0, 97) + '...' : message,
      { screen: 'Chat' },
    );

    // 3. Create CoachingLog
    await this.prisma.coachingLog.create({
      data: {
        userId,
        type,
        subtype,
        date,
        message,
        pushSent,
      },
    });

    this.logger.debug(`Coaching ${type}/${subtype} sent to user ${userId}, push=${pushSent}`);
  }

  // ==========================================
  // Data helpers
  // ==========================================

  private async getCoachingUsers(): Promise<CoachingUser[]> {
    const users = await this.prisma.user.findMany({
      where: {
        pushToken: { not: null },
        timezone: { not: null },
        profile: { isNot: null },
      },
      select: {
        id: true,
        name: true,
        pushToken: true,
        timezone: true,
        metadata: true,
        profile: {
          select: {
            weight: true,
            height: true,
            age: true,
            sex: true,
            activityLevel: true,
            goalWeight: true,
            weeklyGoal: true,
          },
        },
      },
    });

    return users
      .filter((u) => u.pushToken !== null && u.timezone !== null)
      .map((u) => {
        const meta = (u.metadata ?? {}) as Record<string, unknown>;
        return {
          id: u.id,
          name: u.name,
          pushToken: u.pushToken!,
          timezone: u.timezone!,
          language: (meta.preferredLanguage as string) || 'es',
          profile: u.profile,
        };
      });
  }

  private getLocalHour(timezone: string): number {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      });
      return parseInt(formatter.format(new Date()), 10);
    } catch {
      return new Date().getUTCHours();
    }
  }

  private getTodayDateForUser(timezone: string): Date {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const dateStr = formatter.format(new Date());
      return new Date(dateStr + 'T00:00:00.000Z');
    } catch {
      const now = new Date();
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    }
  }

  private async hasCoachingLog(
    userId: string,
    type: string,
    subtype: string,
    date: Date,
  ): Promise<boolean> {
    const existing = await this.prisma.coachingLog.findUnique({
      where: {
        userId_type_subtype_date: { userId, type, subtype, date },
      },
    });
    return existing !== null;
  }

  private async getTodayIntake(userId: string, timezone: string): Promise<number> {
    const today = this.getTodayDateForUser(timezone);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const entries = await this.prisma.calorieEntry.findMany({
      where: {
        userId,
        type: 'intake',
        date: { gte: today, lt: tomorrow },
      },
    });

    return entries.reduce((sum, e) => sum + e.calories, 0);
  }

  private async getTodayBurn(userId: string, timezone: string): Promise<number> {
    const today = this.getTodayDateForUser(timezone);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const entries = await this.prisma.calorieEntry.findMany({
      where: {
        userId,
        type: 'burn',
        date: { gte: today, lt: tomorrow },
      },
    });

    return entries.reduce((sum, e) => sum + e.calories, 0);
  }

  private async calculateStreak(userId: string): Promise<number> {
    let streak = 0;
    const date = new Date();

    for (let i = 0; i < 100; i++) {
      const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = await this.prisma.calorieEntry.count({
        where: {
          userId,
          type: 'intake',
          date: { gte: dayStart, lt: dayEnd },
        },
      });

      if (count === 0) break;
      streak++;
      date.setDate(date.getDate() - 1);
    }

    return streak;
  }

  private async checkWeightMilestone(user: CoachingUser, today: Date): Promise<void> {
    if (!user.profile?.goalWeight) return;

    const recentLogs = await this.prisma.weightLog.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      take: 2,
    });

    if (recentLogs.length < 2) return;

    const current = recentLogs[0].weight;
    const previous = recentLogs[1].weight;
    const goal = user.profile.goalWeight;

    // Check if crossed a whole kg toward goal
    const currentFloor = Math.floor(current);
    const previousFloor = Math.floor(previous);

    if (current < previous && currentFloor < previousFloor && current > goal) {
      const alreadySent = await this.hasCoachingLog(user.id, 'streak', `weight_${currentFloor}`, today);
      if (alreadySent) return;

      const remaining = (current - goal).toFixed(1);
      const lang = user.language;
      const isSpanish = lang !== 'en';
      const prompt = `Generate a weight milestone celebration in ${isSpanish ? 'Spanish' : 'English'} for ${user.name}.
They just crossed below ${previousFloor} kg and are now at ${current} kg.
Their goal is ${goal} kg (${remaining} kg remaining).
Keep it under 2 sentences. Don't use emojis.`;

      const message = await this.claudeClient.generateResponse(prompt, {
        systemPrompt: `You are NOVA, a calorie deficit coach. Generate brief coaching messages in ${isSpanish ? 'Spanish' : 'English'}.`,
        maxTokens: 150,
        temperature: 0.8,
      });

      await this.saveAndSend(user.id, user.pushToken, 'streak', `weight_${currentFloor}`, today, message, lang);
    }
  }

  private async checkWeightNudge(user: CoachingUser, today: Date): Promise<void> {
    const alreadySent = await this.hasCoachingLog(user.id, 'streak', 'weight_nudge', today);
    if (alreadySent) return;

    const lastWeightLog = await this.prisma.weightLog.findFirst({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
    });

    if (!lastWeightLog) return;

    const daysSinceLastLog = Math.floor(
      (Date.now() - lastWeightLog.date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceLastLog < 7) return;

    const lang = user.language;
    const isSpanish = lang !== 'en';
    const prompt = `Generate a gentle weight logging reminder in ${isSpanish ? 'Spanish' : 'English'} for ${user.name}.
They haven't logged their weight in ${daysSinceLastLog} days.
Keep it under 2 sentences. Be encouraging, not pushy. Don't use emojis.`;

    const message = await this.claudeClient.generateResponse(prompt, {
      systemPrompt: `You are NOVA, a calorie deficit coach. Generate brief coaching messages in ${isSpanish ? 'Spanish' : 'English'}.`,
      maxTokens: 150,
      temperature: 0.8,
    });

    await this.saveAndSend(user.id, user.pushToken, 'streak', 'weight_nudge', today, message, lang);
  }
}
