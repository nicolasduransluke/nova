import { Injectable, Logger } from '@nestjs/common';
import type { ProcessMessageRequest, ProcessMessageResponse } from '@nova/types';
import { OrchestratorService } from '../agents/orchestrator.service';

// Simplified QueueService without Redis for demo purposes
// In production, use BullMQ with Redis

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(private readonly orchestrator: OrchestratorService) {
    this.logger.log('QueueService initialized (sync mode - no Redis)');
  }

  /**
   * Queue is not available without Redis
   */
  isQueueAvailable(): boolean {
    return false;
  }

  /**
   * Enqueue message - returns null to trigger sync processing
   */
  async enqueueMessage(
    _request: ProcessMessageRequest,
  ): Promise<string | null> {
    return null;
  }

  /**
   * Get job result - not available without Redis
   */
  async getJobResult(_jobId: string): Promise<null> {
    return null;
  }

  /**
   * Get queue health - returns disconnected status
   */
  async getQueueHealth(): Promise<{
    connected: boolean;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    return {
      connected: false,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
    };
  }
}
