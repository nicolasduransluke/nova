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
import { WhoopService } from '../whoop/whoop.service';
import { generateId } from '@nova/utils';
import { getUserTodayRange, DEFAULT_TIMEZONE } from '../utils/timezone';

@Injectable()
export class MessageProcessorService {
  private readonly logger = new Logger(MessageProcessorService.name);

  constructor(
    private readonly orchestrator: OrchestratorService,
    private readonly prisma: PrismaService,
    private readonly whoopService: WhoopService,
  ) {}

  private createDependencies(timezone: string): OrchestratorDependencies {
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
        try {
          const messages = await this.prisma.chatMessage.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
          });

          return messages.reverse().map((msg) => ({
            id: msg.id,
            type: msg.type as Message['type'],
            content: msg.content,
            imageUrl: msg.imageUrl ?? undefined,
            sender: msg.sender as Message['sender'],
            timestamp: msg.createdAt,
            metadata: (msg.metadata ?? {}) as Record<string, unknown>,
          }));
        } catch (error) {
          this.logger.error(`Error loading conversation history: ${error}`);
          return [];
        }
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
        const { start: today, end: tomorrow } = getUserTodayRange(timezone);

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
        const { start: today, end: tomorrow } = getUserTodayRange(timezone);

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

      getWhoopToken: async (userId: string) => {
        const result = await this.whoopService.getValidToken(userId);
        if (!result) return null;
        return { accessToken: result.accessToken };
      },
    };
  }

  private async saveMessage(
    userId: string,
    type: string,
    content: string,
    sender: 'user' | 'agent',
    imageUrl?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.chatMessage.create({
        data: {
          id: generateId(),
          userId,
          type,
          content,
          sender,
          imageUrl: imageUrl ?? null,
          metadata: (metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Error saving chat message: ${error}`);
    }
  }

  async processMessage(
    request: ProcessMessageRequest,
  ): Promise<ProcessMessageResponse> {
    this.logger.debug(`Processing message from user ${request.userId}`);
    const timezone = request.timezone || DEFAULT_TIMEZONE;

    // Persist timezone to user record
    if (request.timezone) {
      this.prisma.user.update({
        where: { id: request.userId },
        data: { timezone: request.timezone },
      }).catch((err) => this.logger.warn(`Failed to persist timezone: ${err}`));
    }

    await this.saveMessage(
      request.userId,
      request.messageType || 'text',
      request.content,
      'user',
      request.imageUrl,
    );

    const deps = this.createDependencies(timezone);
    const result = await this.orchestrator.processMessage(request, deps);

    if (result.success && result.response?.message) {
      await this.saveMessage(
        request.userId,
        result.intent === 'meal_log' ? 'meal' : 'text',
        result.response.message,
        'agent',
        undefined,
        {
          ...(result.intent ? { intent: result.intent } : {}),
          ...(result.response.foodItems ? { foodItems: result.response.foodItems } : {}),
        },
      );
    }

    return result;
  }

  async processGuestMessage(
    content: string,
    imageUrl?: string,
    language?: string,
  ): Promise<ProcessMessageResponse> {
    this.logger.debug('Processing guest message');

    const guestUserId = 'guest';

    // Noop dependencies — no DB reads/writes
    const noopDeps: OrchestratorDependencies = {
      getUser: async () => ({
        id: guestUserId,
        email: 'guest@nova.app',
        name: 'Invitado',
        provider: 'local' as const,
        emailVerified: false,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      getProfile: async () => ({
        id: 'guest-profile',
        userId: guestUserId,
        weight: 70,
        height: 170,
        age: 30,
        sex: 'male' as const,
        objective: 'weight_loss' as const,
        activityLevel: 'moderate' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      getRecentEntries: async () => [],
      getConversationHistory: async () => [],
      saveEntry: async (entry) => ({
        id: 'noop',
        userId: guestUserId,
        date: entry.date || new Date(),
        type: entry.type!,
        data: (entry.data ?? {}) as Record<string, unknown>,
        novaPoints: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      createCalorieEntry: async (data) => ({
        id: 'noop',
        userId: guestUserId,
        date: data.date,
        type: data.type as any,
        description: data.description,
        calories: data.calories,
        items: data.items as any,
        confirmed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      getTodayCalorieEntries: async () => [],
      createWeightLog: async (data) => ({
        id: 'noop',
        userId: guestUserId,
        weight: data.weight,
        date: data.date,
        createdAt: new Date(),
      }),
      getRecentWeightLogs: async () => [],
      updateProfile: async (_, data) => ({
        id: 'guest-profile',
        userId: guestUserId,
        weight: data.weight ?? 70,
        height: data.height ?? 170,
        age: data.age ?? 30,
        sex: (data.sex ?? 'male') as any,
        objective: 'weight_loss' as const,
        activityLevel: 'moderate' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      getUserMetadata: async () => null,
      updateUserMetadata: async () => {},
      deleteCalorieEntry: async () => {},
      getLastCalorieEntry: async () => null,
      getWhoopToken: async () => null,
    };

    const result = await this.orchestrator.processMessage(
      { userId: guestUserId, content, imageUrl, language },
      noopDeps,
    );

    return result;
  }

  async processMessageSync(
    request: ProcessMessageRequest,
  ): Promise<ProcessMessageResponse> {
    const timezone = request.timezone || DEFAULT_TIMEZONE;

    if (request.timezone) {
      this.prisma.user.update({
        where: { id: request.userId },
        data: { timezone: request.timezone },
      }).catch((err) => this.logger.warn(`Failed to persist timezone: ${err}`));
    }

    await this.saveMessage(
      request.userId,
      request.messageType || 'text',
      request.content,
      'user',
      request.imageUrl,
    );

    const deps = this.createDependencies(timezone);
    const result = await this.orchestrator.processMessage(request, deps);

    if (result.success && result.response?.message) {
      await this.saveMessage(
        request.userId,
        result.intent === 'meal_log' ? 'meal' : 'text',
        result.response.message,
        'agent',
        undefined,
        {
          ...(result.intent ? { intent: result.intent } : {}),
          ...(result.response.foodItems ? { foodItems: result.response.foodItems } : {}),
        },
      );
    }

    return result;
  }

  async getMessageHistory(userId: string, limit: number): Promise<Message[]> {
    // Fetch the most recent messages (desc), then reverse for chronological display order
    const messages = await this.prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    messages.reverse();

    return messages.map((msg) => ({
      id: msg.id,
      type: msg.type as Message['type'],
      content: msg.content,
      imageUrl: msg.imageUrl ?? undefined,
      sender: msg.sender as Message['sender'],
      timestamp: msg.createdAt,
      metadata: (msg.metadata ?? {}) as Record<string, unknown>,
    }));
  }
}
