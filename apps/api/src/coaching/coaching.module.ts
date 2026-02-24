import { Module } from '@nestjs/common';
import { CoachingController } from './coaching.controller';
import { CoachingService } from './coaching.service';
import { PushNotificationService } from './push-notification.service';
import { ClaudeClientModule } from '../claude-client/claude-client.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [ClaudeClientModule, AgentsModule],
  controllers: [CoachingController],
  providers: [CoachingService, PushNotificationService],
})
export class CoachingModule {}
