import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { HealthCheck } from '@nova/types';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthCheck> {
    let databaseHealthy = false;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseHealthy = true;
    } catch {
      databaseHealthy = false;
    }

    return {
      status: databaseHealthy ? 'ok' : 'error',
      timestamp: new Date(),
      services: {
        database: databaseHealthy,
      },
    };
  }
}
