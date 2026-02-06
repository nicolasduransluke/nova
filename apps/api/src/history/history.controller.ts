import { Controller, Get, Delete, Param, Query, UsePipes, ValidationPipe, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import { HistoryService } from './history.service';
import { HistoryQueryDto } from './dto/history-query.dto';
import type { ApiResponse, HistoryDay, WeightEntry } from '@nova/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../infrastructure/database/prisma.service';

@Controller('history')
@UseGuards(JwtAuthGuard)
export class HistoryController {
  constructor(
    private readonly historyService: HistoryService,
    private readonly prisma: PrismaService,
  ) {}

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

  @Delete('entries/:id')
  async deleteEntry(
    @Param('id') entryId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<null>> {
    // Verify the entry belongs to the authenticated user
    const entry = await this.prisma.calorieEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    if (entry.userId !== user.sub) {
      throw new ForbiddenException('You can only delete your own entries');
    }

    await this.prisma.calorieEntry.delete({
      where: { id: entryId },
    });

    return { success: true, data: null };
  }
}
