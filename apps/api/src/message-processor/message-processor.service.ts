import { Injectable, Logger } from '@nestjs/common';
import type {
  ProcessMessageRequest,
  ProcessMessageResponse,
  User,
  Profile,
  DailyEntry,
  Message,
  CalorieEntry,
  WeightLog,
} from '@nova/types';
import { Prisma } from '@prisma/client';
import { OrchestratorService, OrchestratorDependencies } from '../agents/orchestrator.service';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { generateId } from '@nova/utils';

@Injectable()
export class MessageProcessorService {
  private readonly logger = new Logger(MessageProcessorService.name);
  private readonly dependencies: OrchestratorDependencies;

  constructor(
    private readonly orchestrator: OrchestratorService,
    private readonly prisma: PrismaService,
  ) {
    this.dependencies = this.createDependencies();
  }

  private createDependencies(): OrchestratorDependencies {
    return {
      getUser: async (userId: string): Promise<User | null> => {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          provider: user.provider as User['provider'],
          emailVerified: user.emailVerified,
          metadata: (user.metadata ?? {}) as Record<string, unknown>,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
      },

      getProfile: async (userId: string): Promise<Profile | null> => {
        const profile = await this.prisma.profile.findUnique({
          where: { userId },
        });

        if (!profile) return null;

        return {
          id: profile.id,
          userId: profile.userId,
          weight: profile.weight,
          height: profile.height,
          age: profile.age,
          sex: profile.sex as Profile['sex'],
          objective: profile.objective as Profile['objective'],
          activityLevel: (profile.activityLevel || 'moderate') as Profile['activityLevel'],
          goalWeight: profile.goalWeight ?? undefined,
          weeklyGoal: profile.weeklyGoal ?? undefined,
          targetWeeks: profile.targetWeeks ?? undefined,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        };
      },

      getRecentEntries: async (
        userId: string,
        limit: number,
      ): Promise<DailyEntry[]> => {
        const entries = await this.prisma.dailyEntry.findMany({
          where: { userId },
          orderBy: { date: 'desc' },
          take: limit,
        });

        return entries.map((entry) => ({
          id: entry.id,
          userId: entry.userId,
          date: entry.date,
          type: entry.type as DailyEntry['type'],
          data: (entry.data ?? {}) as Record<string, unknown>,
          novaPoints: entry.novaPoints,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        }));
      },

      getConversationHistory: async (
        userId: string,
        limit: number,
      ): Promise<Message[]> => {
        return [];
      },

      saveEntry: async (entry: Partial<DailyEntry>): Promise<DailyEntry> => {
        const created = await this.prisma.dailyEntry.create({
          data: {
            id: generateId(),
            userId: entry.userId!,
            date: entry.date || new Date(),
            type: entry.type!,
            data: (entry.data ?? {}) as Prisma.InputJsonValue,
            novaPoints: entry.novaPoints || 0,
          },
        });

        return {
          id: created.id,
          userId: created.userId,
          date: created.date,
          type: created.type as DailyEntry['type'],
          data: (created.data ?? {}) as Record<string, unknown>,
          novaPoints: created.novaPoints,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        };
      },

      createCalorieEntry: async (data: {
        userId: string;
        date: Date;
        type: string;
        description: string;
        calories: number;
        items: Array<{ name: string; calories: number }>;
        confirmed: boolean;
      }): Promise<CalorieEntry> => {
        const created = await this.prisma.calorieEntry.create({
          data: {
            id: generateId(),
            userId: data.userId,
            date: data.date,
            type: data.type,
            description: data.description,
            calories: data.calories,
            items: data.items as unknown as Prisma.InputJsonValue,
            confirmed: data.confirmed,
          },
        });

        return {
          id: created.id,
          userId: created.userId,
          date: created.date,
          type: created.type as CalorieEntry['type'],
          description: created.description,
          calories: created.calories,
          items: created.items as unknown as CalorieEntry['items'],
          confirmed: created.confirmed,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        };
      },

      getTodayCalorieEntries: async (userId: string): Promise<CalorieEntry[]> => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const entries = await this.prisma.calorieEntry.findMany({
          where: {
            userId,
            date: { gte: today, lt: tomorrow },
          },
        });

        return entries.map((entry) => ({
          id: entry.id,
          userId: entry.userId,
          date: entry.date,
          type: entry.type as CalorieEntry['type'],
          description: entry.description,
          calories: entry.calories,
          items: entry.items as unknown as CalorieEntry['items'],
          confirmed: entry.confirmed,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        }));
      },

      createWeightLog: async (data: {
        userId: string;
        weight: number;
        date: Date;
      }): Promise<WeightLog> => {
        const created = await this.prisma.weightLog.create({
          data: {
            id: generateId(),
            userId: data.userId,
            weight: data.weight,
            date: data.date,
          },
        });

        return {
          id: created.id,
          userId: created.userId,
          weight: created.weight,
          date: created.date,
          createdAt: created.createdAt,
        };
      },

      updateProfile: async (userId: string, data: {
        weight?: number;
        height?: number;
        age?: number;
        sex?: 'male' | 'female';
        goalWeight?: number;
        weeklyGoal?: number;
        targetWeeks?: number;
      }): Promise<Profile> => {
        const updated = await this.prisma.profile.upsert({
          where: { userId },
          update: data,
          create: {
            id: generateId(),
            userId,
            weight: data.weight ?? 70,
            height: data.height ?? 170,
            age: data.age ?? 30,
            sex: data.sex ?? 'male',
            objective: 'weight_loss',
            activityLevel: 'moderate',
            goalWeight: data.goalWeight,
            weeklyGoal: data.weeklyGoal,
            targetWeeks: data.targetWeeks,
          },
        });

        return {
          id: updated.id,
          userId: updated.userId,
          weight: updated.weight,
          height: updated.height,
          age: updated.age,
          sex: updated.sex as Profile['sex'],
          objective: updated.objective as Profile['objective'],
          activityLevel: (updated.activityLevel || 'moderate') as Profile['activityLevel'],
          goalWeight: updated.goalWeight ?? undefined,
          weeklyGoal: updated.weeklyGoal ?? undefined,
          targetWeeks: updated.targetWeeks ?? undefined,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        };
      },

      getRecentWeightLogs: async (userId: string, limit: number): Promise<WeightLog[]> => {
        const logs = await this.prisma.weightLog.findMany({
          where: { userId },
          orderBy: { date: 'desc' },
          take: limit,
        });

        return logs.map((log) => ({
          id: log.id,
          userId: log.userId,
          weight: log.weight,
          date: log.date,
          createdAt: log.createdAt,
        }));
      },

      getUserMetadata: async (userId: string): Promise<string | null> => {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { metadata: true },
        });
        if (!user?.metadata) return null;
        return typeof user.metadata === 'string'
          ? user.metadata
          : JSON.stringify(user.metadata);
      },

      updateUserMetadata: async (userId: string, metadata: Record<string, any>): Promise<void> => {
        await this.prisma.user.update({
          where: { id: userId },
          data: { metadata: metadata as any },
        });
      },

      deleteCalorieEntry: async (entryId: string): Promise<void> => {
        await this.prisma.calorieEntry.delete({
          where: { id: entryId },
        });
      },

      getLastCalorieEntry: async (userId: string): Promise<CalorieEntry | null> => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const entry = await this.prisma.calorieEntry.findFirst({
          where: {
            userId,
            date: { gte: today, lt: tomorrow },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (!entry) return null;

        return {
          id: entry.id,
          userId: entry.userId,
          date: entry.date,
          type: entry.type as CalorieEntry['type'],
          description: entry.description,
          calories: entry.calories,
          items: entry.items as unknown as CalorieEntry['items'],
          confirmed: entry.confirmed,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        };
      },
    };
  }

  async processMessage(
    request: ProcessMessageRequest,
  ): Promise<ProcessMessageResponse> {
    this.logger.debug(`Processing message from user ${request.userId}`);
    return this.orchestrator.processMessage(request, this.dependencies);
  }

  async processMessageSync(
    request: ProcessMessageRequest,
  ): Promise<ProcessMessageResponse> {
    return this.orchestrator.processMessage(request, this.dependencies);
  }
}
