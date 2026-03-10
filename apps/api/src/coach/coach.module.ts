import { Module } from '@nestjs/common';
import { CoachController } from './coach.controller';
import { CoachPublicController } from './coach-public.controller';
import { CoachService } from './coach.service';
import { PushNotificationService } from '../coaching/push-notification.service';
import { DatabaseModule } from '../infrastructure/database/database.module';
import { HistoryModule } from '../history/history.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, HistoryModule, AuthModule],
  controllers: [CoachController, CoachPublicController],
  providers: [CoachService, PushNotificationService],
  exports: [CoachService],
})
export class CoachModule {}
