import { Module } from '@nestjs/common';
import { ClaudeClientService } from './claude-client.service';
import { NutritionModule } from '../nutrition/nutrition.module';

@Module({
  imports: [NutritionModule],
  providers: [ClaudeClientService],
  exports: [ClaudeClientService],
})
export class ClaudeClientModule {}
