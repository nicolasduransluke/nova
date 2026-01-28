import { Injectable } from '@nestjs/common';
import { PrismaService } from '../infrastructure/database/prisma.service';
import type { HistoryDay, WeightEntry, HistoryDayEntry, DailySummary } from '@nova/types';

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailyHistory(userId: string, days: number): Promise<HistoryDay[]> {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - days);

    // Fetch user profile for dynamic targetDeficit
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    const weeklyGoal = profile?.weeklyGoal ?? 0.5;
    const targetDeficit = Math.round((weeklyGoal * 7700) / 7);

    const entries = await this.prisma.calorieEntry.findMany({
      where: {
        userId,
        date: { gte: since },
      },
      orderBy: { date: 'desc' },
    });

    // Group entries by date string (YYYY-MM-DD)
    const grouped = new Map<string, typeof entries>();
    for (const entry of entries) {
      const dateKey = entry.date.toISOString().split('T')[0];
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(entry);
    }

    // Build HistoryDay array
    const result: HistoryDay[] = [];
    for (const [dateKey, dayEntries] of grouped) {
      let intake = 0;
      let burn = 0;
      const mappedEntries: HistoryDayEntry[] = [];

      for (const e of dayEntries) {
        if (e.type === 'intake') intake += e.calories;
        if (e.type === 'burn') burn += e.calories;

        let items = [];
        try {
          items = JSON.parse(e.items);
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

      const summary: DailySummary = {
        date: new Date(dateKey),
        intake,
        burn,
        tdee: 0,
        deficit: -intake + burn,
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

    return result;
  }

  async getWeightHistory(userId: string, days: number): Promise<WeightEntry[]> {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - days);

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
      const dateKey = log.date.toISOString().split('T')[0];
      byDay.set(dateKey, log.weight);
    }

    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, weight]) => ({ date, weight }));
  }
}
