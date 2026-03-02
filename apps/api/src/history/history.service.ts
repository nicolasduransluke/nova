import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { WhoopService } from '../whoop/whoop.service';
import type { HistoryDay, WeightEntry, HistoryDayEntry, DailySummary } from '@nova/types';
import { toDateKeyInTimezone, getUserTodayRange, DEFAULT_TIMEZONE } from '../utils/timezone';

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whoopService: WhoopService,
  ) {}

  // Convert date to local date string (YYYY-MM-DD) instead of UTC
  private toLocalDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Convert UTC date to local date string using explicit timezone offset (minutes)
  // Works correctly regardless of server timezone
  private toDateKeyWithOffset(date: Date, offsetMinutes: number): string {
    const adjusted = new Date(date.getTime() + offsetMinutes * 60000);
    const year = adjusted.getUTCFullYear();
    const month = String(adjusted.getUTCMonth() + 1).padStart(2, '0');
    const day = String(adjusted.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async getDailyHistory(userId: string, days: number): Promise<HistoryDay[]> {
    // Fetch user to get timezone
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true, timezone: true },
    });
    const userTimezone = user?.timezone || DEFAULT_TIMEZONE;

    const { start: todayStart } = getUserTodayRange(userTimezone);
    const since = new Date(todayStart.getTime() - days * 24 * 60 * 60 * 1000);
    const now = new Date();

    // Fetch user profile for dynamic targetDeficit
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    const weeklyGoal = profile?.weeklyGoal ?? 0.5;
    const targetDeficit = Math.round((weeklyGoal * 7700) / 7);

    // Check if user has Whoop connected and fetch historical data
    let whoopCaloriesByDate = new Map<string, number>();
    try {
      const whoopToken = await this.whoopService.getValidToken(userId);
      if (whoopToken) {
        const whoopResult = await this.whoopService.getCyclesForRange(whoopToken.accessToken, since, now);
        whoopCaloriesByDate = whoopResult.caloriesByDate;

        // Whoop range queries don't include today's in-progress cycle — fetch it separately
        const todayKey = toDateKeyInTimezone(new Date(), userTimezone);
        if (!whoopCaloriesByDate.has(todayKey)) {
          try {
            const todaySummary = await this.whoopService.getDailySummary(whoopToken.accessToken);
            if (todaySummary.caloriesBurned > 0) {
              whoopCaloriesByDate.set(todayKey, todaySummary.caloriesBurned);
            }
          } catch (e) {
            this.logger.debug(`Could not fetch today's Whoop cycle: ${e}`);
          }
        }

        this.logger.debug(`Got Whoop data for ${whoopCaloriesByDate.size} days`);
      }
    } catch (error) {
      this.logger.debug(`Whoop history not available: ${error}`);
    }

    const entries = await this.prisma.calorieEntry.findMany({
      where: {
        userId,
        date: { gte: since },
      },
      orderBy: { date: 'desc' },
    });

    // Group entries by date string (YYYY-MM-DD) in user's timezone
    const grouped = new Map<string, typeof entries>();
    for (const entry of entries) {
      const dateKey = toDateKeyInTimezone(entry.date, userTimezone);
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(entry);
    }

    // DEBUG: Log date key comparison
    const foodDateKeys = Array.from(grouped.keys());
    const whoopDateKeys = Array.from(whoopCaloriesByDate.keys());
    this.logger.debug(`Food entry date keys: ${JSON.stringify(foodDateKeys)}`);
    this.logger.debug(`Whoop date keys: ${JSON.stringify(whoopDateKeys)}`);
    this.logger.debug(`Sample food entry raw dates: ${entries.slice(0, 3).map(e => `${e.date.toISOString()} -> ${toDateKeyInTimezone(e.date, userTimezone)}`).join(', ')}`);

    // NOTE: Do NOT add days that only have Whoop data but no manual entries.
    // Showing Whoop burn with 0 intake creates misleading huge deficits.

    // Build HistoryDay array
    const result: HistoryDay[] = [];
    for (const [dateKey, dayEntries] of grouped) {
      let intake = 0;
      let manualBurn = 0;
      const mappedEntries: HistoryDayEntry[] = [];

      for (const e of dayEntries) {
        if (e.type === 'intake') intake += e.calories;
        if (e.type === 'burn') manualBurn += e.calories;

        let items = [];
        try {
          items = e.items as any;
        } catch {
          items = [];
        }

        mappedEntries.push({
          id: e.id,
          type: e.type as 'intake' | 'burn',
          description: e.description,
          calories: e.calories,
          items,
          createdAt: e.createdAt.toISOString(),
        });
      }

      // Only use Whoop data if the day has intake entries (food logs)
      // Otherwise Whoop burn with 0 intake shows a misleading huge deficit
      const hasIntakeEntries = intake > 0;
      const whoopBurn = hasIntakeEntries ? whoopCaloriesByDate.get(dateKey) : undefined;
      const burn = whoopBurn ?? manualBurn;
      const burnSource = whoopBurn ? 'whoop' : 'manual';

      // Add Whoop as an entry if it's the source
      if (whoopBurn) {
        mappedEntries.unshift({
          id: `whoop-${dateKey}`,
          type: 'burn',
          description: 'Whoop - Gasto calórico total',
          calories: whoopBurn,
          items: [],
          createdAt: new Date(dateKey).toISOString(),
        });
      }

      // If burn comes from Whoop, it already includes TDEE
      // For manual entries, we'd need to add TDEE but we don't have profile TDEE calculation here
      // So for history, deficit = burn - intake (Whoop already has TDEE included)
      const deficit = burn - intake;

      const summary: DailySummary = {
        date: new Date(dateKey),
        intake,
        burn,
        burnSource: burnSource as 'manual' | 'whoop',
        tdee: 0,
        deficit,
        targetDeficit,
        projectedWeeklyLoss: 0,
        goalWeight: profile?.goalWeight ?? undefined,
      };

      result.push({
        date: dateKey,
        summary,
        entries: mappedEntries,
      });
    }

    // Sort descending by date
    result.sort((a, b) => b.date.localeCompare(a.date));

    // DEBUG: Log final response summary
    this.logger.debug(`History response: ${result.map(r => `${r.date}: intake=${r.summary.intake}, burn=${r.summary.burn}, source=${r.summary.burnSource}`).join(' | ')}`);

    return result;
  }

  async updateEntryItems(
    entryId: string,
    newItems: { name: string; calories: number; quantity?: number; protein?: number; carbs?: number; fat?: number; portionSize?: number; portionLabel?: string }[],
    existingItems: { name: string; calories: number; quantity?: number; protein?: number; carbs?: number; fat?: number; imageUrl?: string; portionSize?: number; portionLabel?: string }[],
  ) {
    // Build a map of existing imageUrls by item name so we preserve them
    const imageMap = new Map<string, string>();
    for (const item of existingItems) {
      if (item.imageUrl) {
        imageMap.set(item.name, item.imageUrl);
      }
    }

    const mergedItems = newItems.map((item) => ({
      name: item.name,
      calories: item.calories,
      quantity: item.quantity ?? 1,
      ...(item.protein != null ? { protein: item.protein } : {}),
      ...(item.carbs != null ? { carbs: item.carbs } : {}),
      ...(item.fat != null ? { fat: item.fat } : {}),
      ...(item.portionSize != null ? { portionSize: item.portionSize } : {}),
      ...(item.portionLabel ? { portionLabel: item.portionLabel } : {}),
      ...(imageMap.has(item.name) ? { imageUrl: imageMap.get(item.name) } : {}),
    }));

    const totalCalories = mergedItems.reduce(
      (sum, item) => sum + item.calories * (item.quantity ?? 1),
      0,
    );

    return this.prisma.calorieEntry.update({
      where: { id: entryId },
      data: {
        items: mergedItems as any,
        calories: totalCalories,
      },
    });
  }

  async getWeightHistory(userId: string, days: number): Promise<WeightEntry[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const userTimezone = user?.timezone || DEFAULT_TIMEZONE;

    const { start: todayStart } = getUserTodayRange(userTimezone);
    const since = new Date(todayStart.getTime() - days * 24 * 60 * 60 * 1000);

    const logs = await this.prisma.weightLog.findMany({
      where: {
        userId,
        date: { gte: since },
      },
      orderBy: { date: 'asc' },
    });

    // Group by day, keep only the last entry per day
    const byDay = new Map<string, number>();
    for (const log of logs) {
      const dateKey = toDateKeyInTimezone(log.date, userTimezone);
      byDay.set(dateKey, log.weight);
    }

    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, weight]) => ({ date, weight }));
  }
}
