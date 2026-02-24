import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { MessageProcessorService } from './message-processor.service';
import { MessageProcessorController } from './message-processor.controller';
import { GuestMessageController } from './guest-message.controller';

@Module({
  imports: [AgentsModule],
  controllers: [MessageProcessorController, GuestMessageController],
  providers: [MessageProcessorService],
  exports: [MessageProcessorService],
})
export class MessageProcessorModule {}
