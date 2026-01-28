import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './presentation/controllers/health.controller';
import { UserController } from './presentation/controllers/user.controller';
import { ProfileController } from './presentation/controllers/profile.controller';
import { WeightLogsController } from './presentation/controllers/weight-logs.controller';
import { DatabaseModule } from './infrastructure/database/database.module';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { GetUserUseCase } from './application/use-cases/get-user.use-case';
import { UserRepository } from './infrastructure/database/repositories/user.repository';
import { ClaudeClientModule } from './claude-client/claude-client.module';
import { AgentsModule } from './agents/agents.module';
import { MessageProcessorModule } from './message-processor/message-processor.module';
import { HistoryModule } from './history/history.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    AuthModule,
    MailModule,
    ClaudeClientModule,
    AgentsModule,
    MessageProcessorModule,
    HistoryModule,
  ],
  controllers: [HealthController, UserController, ProfileController, WeightLogsController],
  providers: [
    CreateUserUseCase,
    GetUserUseCase,
    {
      provide: 'IUserRepository',
      useClass: UserRepository,
    },
  ],
})
export class AppModule {}
