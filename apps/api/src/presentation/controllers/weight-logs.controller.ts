import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import type { ApiResponse, WeightLog } from '@nova/types';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../auth/decorators/current-user.decorator';

@Controller('weight-logs')
@UseGuards(JwtAuthGuard)
export class WeightLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':userId')
  async getWeightLogs(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: JwtPayload,
  ): Promise<ApiResponse<WeightLog[]>> {
    if (user && userId !== user.sub) {
      throw new ForbiddenException('You can only access your own weight logs');
    }
    const take = limit ? parseInt(limit, 10) : 30;

    const logs = await this.prisma.weightLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take,
    });

    return {
      success: true,
      data: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        weight: log.weight,
        date: log.date,
        createdAt: log.createdAt,
      })),
    };
  }
}
