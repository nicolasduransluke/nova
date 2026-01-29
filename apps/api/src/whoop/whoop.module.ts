import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhoopService } from './whoop.service';
import { WhoopController } from './whoop.controller';
import { DatabaseModule } from '../infrastructure/database/database.module';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [WhoopController],
  providers: [WhoopService],
  exports: [WhoopService],
})
export class WhoopModule {}
