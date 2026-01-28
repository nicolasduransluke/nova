import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { MessageProcessorService } from './message-processor.service';
import { MessageProcessorController } from './message-processor.controller';

@Module({
  imports: [AgentsModule],
  controllers: [MessageProcessorController],
  providers: [MessageProcessorService],
  exports: [MessageProcessorService],
})
export class MessageProcessorModule {}
