import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { PushNotificationService } from './push-notification.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@Controller('coaching')
@UseGuards(JwtAuthGuard)
export class CoachingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushNotification: PushNotificationService,
  ) {}

  @Post('push-token')
  @HttpCode(HttpStatus.OK)
  async registerPushToken(
    @Body() dto: RegisterPushTokenDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.prisma.user.update({
      where: { id: user.sub },
      data: {
        pushToken: dto.pushToken,
        timezone: dto.timezone || null,
      },
    });

    return {
      success: true,
      message: 'Push token registered',
    };
  }

  @Delete('push-token')
  @HttpCode(HttpStatus.OK)
  async unregisterPushToken(@CurrentUser() user: JwtPayload) {
    await this.prisma.user.update({
      where: { id: user.sub },
      data: {
        pushToken: null,
      },
    });

    return {
      success: true,
      message: 'Push token removed',
    };
  }

  @Post('test-push')
  @HttpCode(HttpStatus.OK)
  async testPush(@CurrentUser() user: JwtPayload) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { pushToken: true, name: true },
    });

    if (!dbUser?.pushToken) {
      return { success: false, message: 'No push token registered' };
    }

    const sent = await this.pushNotification.sendPushNotification(
      dbUser.pushToken,
      'NOVA - Test',
      `Hola ${dbUser.name || 'usuario'}, las notificaciones de coaching están funcionando correctamente.`,
      { screen: 'Chat' },
    );

    return { success: sent, message: sent ? 'Push sent' : 'Push failed' };
  }
}
