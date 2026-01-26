import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { QueueService } from './queue.service';

@Module({
  imports: [AgentsModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
