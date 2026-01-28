import { Controller, Get, Query, UsePipes, ValidationPipe, UseGuards, ForbiddenException } from '@nestjs/common';
import { HistoryService } from './history.service';
import { HistoryQueryDto } from './dto/history-query.dto';
import type { ApiResponse, HistoryDay, WeightEntry } from '@nova/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';

@Controller('history')
@UseGuards(JwtAuthGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get('daily')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getDailyHistory(
    @Query() query: HistoryQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<HistoryDay[]>> {
    if (query.userId !== user.sub) {
      throw new ForbiddenException('You can only access your own history');
    }
    const data = await this.historyService.getDailyHistory(
      query.userId,
      query.days ?? 14,
    );
    return { success: true, data };
  }

  @Get('weight')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getWeightHistory(
    @Query() query: HistoryQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<WeightEntry[]>> {
    if (query.userId !== user.sub) {
      throw new ForbiddenException('You can only access your own weight history');
    }
    const data = await this.historyService.getWeightHistory(
      query.userId,
      query.days ?? 30,
    );
    return { success: true, data };
  }
}
