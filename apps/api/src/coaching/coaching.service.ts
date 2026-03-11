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

// Parsed protocol rule
interface ProtocolRule {
  type: 'scheduled' | 'conditional' | 'event';
  hour?: number;           // for scheduled rules
  dayOfWeek?: number;      // 0=Sun..6=Sat, for weekly rules
  condition?: string;      // 'no_intake_by_14', 'streak_milestone', 'weight_milestone', etc.
  instruction: string;     // what to tell the AI to do
  messageType: string;     // for coaching log dedup
  subtype: string;
}

const DEFAULT_PROTOCOL = `08:30 - Pregúntale cómo va su día y si tiene algún plan de actividad física. Recomienda estrategia de alimentación.
11:00 - Si no ha registrado comida, recuérdale registrar su desayuno/almuerzo.
15:00 - Si no ha registrado comida desde las 11, recuérdale registrar su almuerzo/merienda.
21:00 - Resumen diario con balance calórico, déficit y proyección semanal.
lunes 09:00 - Revisar metas de la semana, preguntar objetivos.
streak - Celebrar streaks en días 3, 7, 14, 21, 30, 60, 90.
pattern - Analizar patrones de calorías de las últimas 2 semanas (lunes).`;

const COACHING_TITLES: Record<string, Record<string, string>> = {
  es: {
    morning_checkin: 'NOVA - Buenos días',
    meal_reminder: 'NOVA - Recordatorio',
    daily_summary: 'NOVA - Resumen del día',
    streak: 'NOVA - Racha',
    pattern_insight: 'NOVA - Insight semanal',
    protocol_message: 'NOVA - Coach',
  },
  en: {
    morning_checkin: 'NOVA - Good morning',
    meal_reminder: 'NOVA - Reminder',
    daily_summary: 'NOVA - Daily Summary',
    streak: 'NOVA - Streak',
    pattern_insight: 'NOVA - Weekly Insight',
    protocol_message: 'NOVA - Coach',
  },
};

const DAY_MAP: Record<string, number> = {
  domingo: 0, sunday: 0, dom: 0, sun: 0,
  lunes: 1, monday: 1, lun: 1, mon: 1,
  martes: 2, tuesday: 2, mar: 2, tue: 2,
  miércoles: 3, miercoles: 3, wednesday: 3, mie: 3, wed: 3,
  jueves: 4, thursday: 4, jue: 4, thu: 4,
  viernes: 5, friday: 5, vie: 5, fri: 5,
  sábado: 6, sabado: 6, saturday: 6, sab: 6, sat: 6,
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
  // Single unified cron — runs every hour
  // ==========================================
  @Cron('0 * * * *')
  async handleProtocolEngine(): Promise<void> {
    this.logger.debug('Running protocol engine');
    const users = await this.getCoachingUsers();

    for (const user of users) {
      try {
        await this.executeProtocolForUser(user);
      } catch (error) {
        this.logger.error(`Protocol engine error for user ${user.id}: ${error}`);
      }
    }
  }

  private async executeProtocolForUser(user: CoachingUser): Promise<void> {
    const localHour = this.getLocalHour(user.timezone);
    const localDayOfWeek = this.getLocalDayOfWeek(user.timezone);
    const today = this.getTodayDateForUser(user.timezone);
    const lang = user.language;
    const isSpanish = lang !== 'en';

    // Load protocol + style + plan
    const [{ style, protocol: rawProtocol }, planInstructions] = await Promise.all([
      this.getPatientAIProfile(user.id),
      this.getActivePlanInstructions(user.id),
    ]);

    const protocolText = rawProtocol || DEFAULT_PROTOCOL;
    const rules = this.parseProtocol(protocolText);

    for (const rule of rules) {
      try {
        await this.executeRule(user, rule, localHour, localDayOfWeek, today, isSpanish, style, planInstructions, protocolText);
      } catch (error) {
        this.logger.error(`Rule execution error for user ${user.id}, rule ${rule.messageType}/${rule.subtype}: ${error}`);
      }
    }
  }

  private async executeRule(
    user: CoachingUser,
    rule: ProtocolRule,
    localHour: number,
    localDayOfWeek: number,
    today: Date,
    isSpanish: boolean,
    style: string,
    planInstructions: string | undefined,
    protocolText: string,
  ): Promise<void> {
    const lang = user.language;

    if (rule.type === 'scheduled') {
      // Time-based rule — check if hour matches
      if (rule.hour !== localHour) return;
      // Weekly rules — check day of week
      if (rule.dayOfWeek !== undefined && rule.dayOfWeek !== localDayOfWeek) return;

      const alreadySent = await this.hasCoachingLog(user.id, rule.messageType, rule.subtype, today);
      if (alreadySent) return;

      // Special handling for daily_summary (needs data)
      if (rule.messageType === 'daily_summary') {
        await this.executeDailySummary(user, today, isSpanish, style, planInstructions, protocolText, rule);
        return;
      }

      // Special handling for meal reminders with intake condition
      if (rule.messageType === 'meal_reminder') {
        const todayIntake = await this.getTodayIntake(user.id, user.timezone);
        const threshold = localHour <= 12 ? 200 : 500;
        if (todayIntake >= threshold) return;

        const prompt = `Generate a brief coaching message in ${isSpanish ? 'Spanish' : 'English'} for ${user.name}.
Current time: ${localHour}:00. They've logged ${todayIntake} kcal so far today.
Instruction from their coach: "${rule.instruction}"
IMPORTANT: If the coaching plan includes fasting or specific meal timing, adapt accordingly. Do NOT tell them to eat if they should be fasting.
Keep it under 2 sentences, warm and motivating. Don't use emojis.`;

        const systemPrompt = this.buildSystemPrompt(isSpanish, style, planInstructions, protocolText);
        const message = await this.claudeClient.generateResponse(prompt, { systemPrompt, maxTokens: 150, temperature: 0.8 });
        const triggerData = { hour: localHour, intake: todayIntake, threshold, instruction: rule.instruction };
        await this.saveAndSend(user.id, user.pushToken, rule.messageType, rule.subtype, today, message, lang, triggerData);
        return;
      }

      // Generic scheduled message (morning_checkin, weekly review, custom)
      const todayIntake = await this.getTodayIntake(user.id, user.timezone);
      const prompt = `Generate a brief coaching message in ${isSpanish ? 'Spanish' : 'English'} for ${user.name}.
Current time: ${localHour}:00. Today's intake so far: ${todayIntake} kcal.
Instruction from their coach: "${rule.instruction}"
Keep it under 2-3 sentences. Be warm, specific, and actionable. Don't use emojis.`;

      const systemPrompt = this.buildSystemPrompt(isSpanish, style, planInstructions, protocolText);
      const message = await this.claudeClient.generateResponse(prompt, { systemPrompt, maxTokens: 200, temperature: 0.8 });
      const triggerData = { hour: localHour, dayOfWeek: localDayOfWeek, instruction: rule.instruction };
      await this.saveAndSend(user.id, user.pushToken, rule.messageType, rule.subtype, today, message, lang, triggerData);

    } else if (rule.type === 'event') {
      // Event-based rules (streaks, patterns, weight milestones)
      if (rule.condition === 'streak_milestone') {
        await this.executeStreakRule(user, today, isSpanish, style, planInstructions, protocolText);
      } else if (rule.condition === 'pattern_insight') {
        // Only run on Mondays
        if (localDayOfWeek !== 1 || localHour !== 10) return;
        await this.executePatternRule(user, today, isSpanish, style, planInstructions, protocolText);
      } else if (rule.condition === 'weight_milestone') {
        await this.executeWeightMilestone(user, today, isSpanish, style, planInstructions, protocolText);
        await this.executeWeightNudge(user, today, isSpanish, style, planInstructions, protocolText);
      }
    }
  }

  // ==========================================
  // Protocol parser
  // ==========================================
  parseProtocol(text: string): ProtocolRule[] {
    const rules: ProtocolRule[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    let ruleIndex = 0;

    for (const line of lines) {
      // Event-based: "streak - ..."
      if (/^streak\s*[-–—]/i.test(line)) {
        rules.push({
          type: 'event',
          condition: 'streak_milestone',
          instruction: line.replace(/^streak\s*[-–—]\s*/i, ''),
          messageType: 'streak',
          subtype: 'milestone',
        });
        continue;
      }

      // Event-based: "pattern - ..."
      if (/^pattern\s*[-–—]/i.test(line)) {
        rules.push({
          type: 'event',
          condition: 'pattern_insight',
          instruction: line.replace(/^pattern\s*[-–—]\s*/i, ''),
          messageType: 'pattern_insight',
          subtype: '',
        });
        continue;
      }

      // Event-based: "weight - ..."
      if (/^(weight|peso)\s*[-–—]/i.test(line)) {
        rules.push({
          type: 'event',
          condition: 'weight_milestone',
          instruction: line.replace(/^(weight|peso)\s*[-–—]\s*/i, ''),
          messageType: 'streak',
          subtype: 'weight',
        });
        continue;
      }

      // Weekly: "lunes 09:00 - ..." or "monday 9:00 - ..."
      const weeklyMatch = line.match(/^(\w+)\s+(\d{1,2})[:\.]?(\d{2})?\s*[-–—]\s*(.+)/i);
      if (weeklyMatch) {
        const dayStr = weeklyMatch[1].toLowerCase();
        const dayOfWeek = DAY_MAP[dayStr];
        if (dayOfWeek !== undefined) {
          const hour = parseInt(weeklyMatch[2], 10);
          rules.push({
            type: 'scheduled',
            hour,
            dayOfWeek,
            instruction: weeklyMatch[4],
            messageType: 'protocol_message',
            subtype: `weekly_${dayStr}_${hour}`,
          });
          continue;
        }
      }

      // Time-based: "08:30 - ..." or "8:30 - ..." or "21:00 - ..."
      const timeMatch = line.match(/^(\d{1,2})[:\.](\d{2})\s*[-–—]\s*(.+)/);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1], 10);
        const instruction = timeMatch[3];

        // Detect type from content
        let messageType = 'protocol_message';
        let subtype = `h${hour}_${ruleIndex}`;

        const lowerInstr = instruction.toLowerCase();
        if (lowerInstr.includes('resumen') || lowerInstr.includes('summary') || lowerInstr.includes('balance')) {
          messageType = 'daily_summary';
          subtype = '';
        } else if (lowerInstr.includes('registr') || lowerInstr.includes('log') || lowerInstr.includes('recuérd') || lowerInstr.includes('recuerd') || lowerInstr.includes('remind')) {
          messageType = 'meal_reminder';
          subtype = `h${hour}`;
        } else if (hour <= 10) {
          messageType = 'morning_checkin';
          subtype = '';
        }

        rules.push({
          type: 'scheduled',
          hour,
          instruction,
          messageType,
          subtype,
        });
        ruleIndex++;
        continue;
      }

      // Bullet point without time: "- Si no ha registrado..." (becomes a condition hint injected into protocol text, not a standalone rule)
      // These are handled by the protocol text being injected into system prompts
    }

    // Always ensure weight milestone check exists
    if (!rules.some(r => r.condition === 'weight_milestone')) {
      rules.push({
        type: 'event',
        condition: 'weight_milestone',
        instruction: 'Celebrate weight milestones and nudge if no weight log in 7+ days',
        messageType: 'streak',
        subtype: 'weight',
      });
    }

    return rules;
  }

  // ==========================================
  // Specialized execution methods
  // ==========================================

  private async executeDailySummary(
    user: CoachingUser, today: Date, isSpanish: boolean,
    style: string, planInstructions: string | undefined, protocolText: string,
    rule: ProtocolRule,
  ): Promise<void> {
    const todayIntake = await this.getTodayIntake(user.id, user.timezone);
    const todayBurn = await this.getTodayBurn(user.id, user.timezone);
    if (todayIntake === 0) return;

    const profile = user.profile ? {
      weight: user.profile.weight,
      height: user.profile.height,
      age: user.profile.age,
      sex: user.profile.sex as Profile['sex'],
      activityLevel: (user.profile.activityLevel || 'moderate') as Profile['activityLevel'],
      goalWeight: user.profile.goalWeight ?? undefined,
      weeklyGoal: user.profile.weeklyGoal ?? undefined,
    } as Profile : undefined;

    const summary = this.metabolicAgent.calculateDailySummary(profile, todayIntake, todayBurn);

    const prompt = `Generate a brief daily summary in ${isSpanish ? 'Spanish' : 'English'} for ${user.name}. Here are today's numbers:
- Consumed: ${todayIntake} kcal
- Exercise burn: ${todayBurn} kcal
- TDEE: ${summary.tdee} kcal
- Deficit: ${summary.deficit} kcal
- Target deficit: ${summary.targetDeficit} kcal
- Projected weekly loss: ${summary.projectedWeeklyLoss} kg/week

${summary.deficit >= summary.targetDeficit ? 'They met their deficit goal today.' : 'They fell short of their deficit goal.'}
Coach instruction: "${rule.instruction}"
Keep it under 3 sentences. Be encouraging and data-focused. Don't use emojis.`;

    const systemPrompt = this.buildSystemPrompt(isSpanish, style, planInstructions, protocolText);
    const message = await this.claudeClient.generateResponse(prompt, { systemPrompt, maxTokens: 200, temperature: 0.7 });
    const triggerData = { intake: todayIntake, burn: todayBurn, tdee: summary.tdee, deficit: summary.deficit, targetDeficit: summary.targetDeficit };
    await this.saveAndSend(user.id, user.pushToken, 'daily_summary', '', today, message, user.language, triggerData);
  }

  private async executeStreakRule(
    user: CoachingUser, today: Date, isSpanish: boolean,
    style: string, planInstructions: string | undefined, protocolText: string,
  ): Promise<void> {
    const streak = await this.calculateStreak(user.id);
    const milestones = [3, 7, 14, 21, 30, 60, 90];

    if (!milestones.includes(streak)) return;

    const alreadySent = await this.hasCoachingLog(user.id, 'streak', `day_${streak}`, today);
    if (alreadySent) return;

    const prompt = `Generate a streak celebration message in ${isSpanish ? 'Spanish' : 'English'} for ${user.name}.
They have logged their meals for ${streak} consecutive days!
Keep it under 2 sentences. Be enthusiastic but not over-the-top. Don't use emojis.`;

    const systemPrompt = this.buildSystemPrompt(isSpanish, style, planInstructions, protocolText);
    const message = await this.claudeClient.generateResponse(prompt, { systemPrompt, maxTokens: 150, temperature: 0.8 });
    const triggerData = { streak, milestone: `day_${streak}` };
    await this.saveAndSend(user.id, user.pushToken, 'streak', `day_${streak}`, today, message, user.language, triggerData);
  }

  private async executePatternRule(
    user: CoachingUser, today: Date, isSpanish: boolean,
    style: string, planInstructions: string | undefined, protocolText: string,
  ): Promise<void> {
    const alreadySent = await this.hasCoachingLog(user.id, 'pattern_insight', '', today);
    if (alreadySent) return;

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const entries = await this.prisma.calorieEntry.findMany({
      where: { userId: user.id, type: 'intake', date: { gte: twoWeeksAgo } },
      orderBy: { date: 'asc' },
    });

    if (entries.length < 7) return;

    const dailyMap: Record<string, number> = {};
    for (const entry of entries) {
      const dateKey = entry.date.toISOString().split('T')[0];
      dailyMap[dateKey] = (dailyMap[dateKey] || 0) + entry.calories;
    }

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

    const systemPrompt = this.buildSystemPrompt(isSpanish, style, planInstructions, protocolText);
    const message = await this.claudeClient.generateResponse(prompt, { systemPrompt, maxTokens: 200, temperature: 0.7 });
    if (message.trim() === 'NO_PATTERN') return;

    const triggerData = { dataPoints: Object.keys(dailyMap).length, dailyMap };
    await this.saveAndSend(user.id, user.pushToken, 'pattern_insight', '', today, message, user.language, triggerData);
  }

  private async executeWeightMilestone(
    user: CoachingUser, today: Date, isSpanish: boolean,
    style: string, planInstructions: string | undefined, protocolText: string,
  ): Promise<void> {
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

    const currentFloor = Math.floor(current);
    const previousFloor = Math.floor(previous);

    if (current < previous && currentFloor < previousFloor && current > goal) {
      const alreadySent = await this.hasCoachingLog(user.id, 'streak', `weight_${currentFloor}`, today);
      if (alreadySent) return;

      const remaining = (current - goal).toFixed(1);
      const prompt = `Generate a weight milestone celebration in ${isSpanish ? 'Spanish' : 'English'} for ${user.name}.
They just crossed below ${previousFloor} kg and are now at ${current} kg.
Their goal is ${goal} kg (${remaining} kg remaining).
Keep it under 2 sentences. Don't use emojis.`;

      const systemPrompt = this.buildSystemPrompt(isSpanish, style, planInstructions, protocolText);
      const message = await this.claudeClient.generateResponse(prompt, { systemPrompt, maxTokens: 150, temperature: 0.8 });
      const triggerData = { previous, current, goal, crossedBelow: previousFloor };
      await this.saveAndSend(user.id, user.pushToken, 'streak', `weight_${currentFloor}`, today, message, user.language, triggerData);
    }
  }

  private async executeWeightNudge(
    user: CoachingUser, today: Date, isSpanish: boolean,
    style: string, planInstructions: string | undefined, protocolText: string,
  ): Promise<void> {
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

    const prompt = `Generate a gentle weight logging reminder in ${isSpanish ? 'Spanish' : 'English'} for ${user.name}.
They haven't logged their weight in ${daysSinceLastLog} days.
Keep it under 2 sentences. Be encouraging, not pushy. Don't use emojis.`;

    const systemPrompt = this.buildSystemPrompt(isSpanish, style, planInstructions, protocolText);
    const message = await this.claudeClient.generateResponse(prompt, { systemPrompt, maxTokens: 150, temperature: 0.8 });
    const triggerData = { daysSinceLastLog, lastLogDate: lastWeightLog.date.toISOString() };
    await this.saveAndSend(user.id, user.pushToken, 'streak', 'weight_nudge', today, message, user.language, triggerData);
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
    triggerData?: Record<string, unknown>,
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
        triggerData: triggerData as any,
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

  private getLocalDayOfWeek(timezone: string): number {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
      });
      const day = formatter.format(new Date());
      const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return map[day] ?? new Date().getDay();
    } catch {
      return new Date().getDay();
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

  // ==========================================
  // Style & prompt helpers
  // ==========================================

  private buildSystemPrompt(isSpanish: boolean, style: string, planInstructions?: string, protocol?: string): string {
    let base = `You are NOVA, a calorie deficit coach. Generate brief coaching messages in ${isSpanish ? 'Spanish' : 'English'}.`;
    if (protocol) {
      base += `\n\nCOACHING PROTOCOL (behavioral rules set by the patient's human coach — ALWAYS follow these):\n${protocol}`;
    }
    if (planInstructions) {
      base += `\n\nACTIVE COACHING PLAN INSTRUCTIONS (set by the patient's human coach — ALWAYS respect these):\n${planInstructions}`;
    }
    if (style) {
      base += `\n\nCommunication style for this patient:\n${style}`;
    }
    return base;
  }

  private async getPatientAIProfile(userId: string): Promise<{ style: string; protocol: string }> {
    const profile = await this.prisma.patientProfileAI.findUnique({
      where: { patientId: userId },
    });
    return {
      style: profile?.styleInstructions || '',
      protocol: profile?.coachingProtocol || '',
    };
  }

  private async getActivePlanInstructions(userId: string): Promise<string | undefined> {
    const plan = await this.prisma.coachingPlan.findFirst({
      where: { patientId: userId, status: 'active' },
    });
    if (!plan) return undefined;
    const goals = plan.goals as Record<string, any>;
    const parts: string[] = [];
    if (goals.dailyCalories) parts.push(`Daily calorie target: ${goals.dailyCalories} kcal`);
    if (goals.weeklyWorkouts) parts.push(`Weekly workouts: ${goals.weeklyWorkouts}`);
    if (goals.proteinGrams) parts.push(`Protein target: ${goals.proteinGrams}g/day`);
    if (plan.instructions) parts.push(`Coach instructions: ${plan.instructions}`);
    return parts.length > 0 ? parts.join('\n') : undefined;
  }
}
