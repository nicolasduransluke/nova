import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NutritionService } from './nutrition.service';

@Module({
  imports: [ConfigModule],
  providers: [NutritionService],
  exports: [NutritionService],
})
export class NutritionModule {}
