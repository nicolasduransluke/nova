import {
  Controller,
  Get,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { CoachService } from './coach.service';
import { IsEmail } from 'class-validator';

class AcceptByEmailDto {
  @IsEmail()
  email: string;
}

function ok(data: unknown) {
  return { success: true, data };
}

@Controller('coach/public')
export class CoachPublicController {
  constructor(private readonly coachService: CoachService) {}

  @Get('invitations/:token')
  async getInvitationInfo(@Param('token') token: string) {
    const info = await this.coachService.getInvitationInfo(token);
    if (!info) {
      return { success: false, error: 'Invitation not found or expired' };
    }
    return ok(info);
  }

  @Post('invitations/:token/accept')
  async acceptByEmail(
    @Param('token') token: string,
    @Body() dto: AcceptByEmailDto,
  ) {
    return ok(await this.coachService.acceptInvitationByEmail(token, dto.email));
  }
}
