import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { QueueModule } from '../queue/queue.module';
import { MessageProcessorService } from './message-processor.service';
import { MessageProcessorController } from './message-processor.controller';

@Module({
  imports: [AgentsModule, QueueModule],
  controllers: [MessageProcessorController],
  providers: [MessageProcessorService],
  exports: [MessageProcessorService],
})
export class MessageProcessorModule {}
