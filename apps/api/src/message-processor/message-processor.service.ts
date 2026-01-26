import { Injectable, Logger } from '@nestjs/common';
import type {
  ProcessMessageRequest,
  ProcessMessageResponse,
  User,
  Profile,
  DailyEntry,
  Message,
} from '@nova/types';
import { OrchestratorService, OrchestratorDependencies } from '../agents/orchestrator.service';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { generateId } from '@nova/utils';

@Injectable()
export class MessageProcessorService {
  private readonly logger = new Logger(MessageProcessorService.name);
  private readonly dependencies: OrchestratorDependencies;

  constructor(
    private readonly orchestrator: OrchestratorService,
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
  ) {
    // Initialize dependencies that use Prisma
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
          metadata: user.metadata as Record<string, unknown>,
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
          data: entry.data as Record<string, unknown>,
          novaPoints: entry.novaPoints,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        }));
      },

      getConversationHistory: async (
        userId: string,
        limit: number,
      ): Promise<Message[]> => {
        // In a real app, this would fetch from a messages table
        // For now, return empty array (messages are handled client-side)
        return [];
      },

      saveEntry: async (entry: Partial<DailyEntry>): Promise<DailyEntry> => {
        const created = await this.prisma.dailyEntry.create({
          data: {
            id: generateId(),
            userId: entry.userId!,
            date: entry.date || new Date(),
            type: entry.type!,
            data: entry.data || {},
            novaPoints: entry.novaPoints || 0,
          },
        });

        return {
          id: created.id,
          userId: created.userId,
          date: created.date,
          type: created.type as DailyEntry['type'],
          data: created.data as Record<string, unknown>,
          novaPoints: created.novaPoints,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        };
      },
    };
  }

  async processMessage(
    request: ProcessMessageRequest,
  ): Promise<ProcessMessageResponse> {
    this.logger.debug(`Processing message from user ${request.userId}`);

    // Try to use queue if available
    if (this.queueService.isQueueAvailable()) {
      const jobId = await this.queueService.enqueueMessage(request);

      if (jobId) {
        this.logger.debug(`Message queued with job ID ${jobId}`);

        // For now, wait for result (in production, could return job ID for polling)
        // This is a simplified approach - in production you'd use WebSockets
        return this.waitForJobResult(jobId, 30000);
      }
    }

    // Fall back to synchronous processing
    this.logger.debug('Processing message synchronously');
    return this.orchestrator.processMessage(request, this.dependencies);
  }

  private async waitForJobResult(
    jobId: string,
    timeoutMs: number,
  ): Promise<ProcessMessageResponse> {
    const startTime = Date.now();
    const pollInterval = 100;

    while (Date.now() - startTime < timeoutMs) {
      const result = await this.queueService.getJobResult(jobId);

      if (result) {
        return result.response;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    // Timeout - fall back to sync processing
    this.logger.warn(`Job ${jobId} timed out, falling back to sync`);
    throw new Error('Message processing timed out');
  }

  async processMessageSync(
    request: ProcessMessageRequest,
  ): Promise<ProcessMessageResponse> {
    return this.orchestrator.processMessage(request, this.dependencies);
  }
}
