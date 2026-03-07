import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CoachService } from './coach.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { InvitePatientDto } from './dto/invite-patient.dto';
import { UpdateRelationshipDto } from './dto/update-relationship.dto';

function ok(data: unknown) {
  return { success: true, data };
}

@Controller('coach')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoachController {
  constructor(private readonly coachService: CoachService) {}

  // ─── Coach endpoints ──────────────────────────────────────

  @Post('invite')
  @Roles('coach')
  async invitePatient(
    @CurrentUser() user: JwtPayload,
    @Body() dto: InvitePatientDto,
  ) {
    return ok(await this.coachService.invitePatient(user.sub, dto.patientEmail));
  }

  @Get('invitations')
  @Roles('coach')
  async getMyInvitations(@CurrentUser() user: JwtPayload) {
    return ok(await this.coachService.getCoachInvitations(user.sub));
  }

  @Get('patients')
  @Roles('coach')
  async getPatients(@CurrentUser() user: JwtPayload) {
    return ok(await this.coachService.getPatients(user.sub));
  }

  @Get('patients/:patientId')
  @Roles('coach')
  async getPatientDetail(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
  ) {
    return ok(await this.coachService.getPatientDetail(user.sub, patientId));
  }

  @Get('patients/:patientId/history')
  @Roles('coach')
  async getPatientHistory(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
    @Query('days') days?: string,
  ) {
    return ok(await this.coachService.getPatientHistory(user.sub, patientId, Number(days) || 14));
  }

  @Get('patients/:patientId/weight')
  @Roles('coach')
  async getPatientWeightHistory(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
    @Query('days') days?: string,
  ) {
    return ok(await this.coachService.getPatientWeightHistory(user.sub, patientId, Number(days) || 30));
  }

  @Get('patients/:patientId/messages')
  @Roles('coach')
  async getPatientMessages(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
    @Query('limit') limit?: string,
  ) {
    return ok(await this.coachService.getPatientMessages(user.sub, patientId, Number(limit) || 50));
  }

  @Patch('patients/:patientId')
  @Roles('coach')
  async updateRelationship(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
    @Body() dto: UpdateRelationshipDto,
  ) {
    return ok(await this.coachService.updateRelationship(user.sub, patientId, dto));
  }

  // ─── Patient endpoints ────────────────────────────────────

  @Get('my-coach')
  async getMyCoach(@CurrentUser() user: JwtPayload) {
    return ok(await this.coachService.getMyCoach(user.sub));
  }

  @Get('pending-invitations')
  async getPendingInvitations(@CurrentUser() user: JwtPayload) {
    return ok(await this.coachService.getPatientInvitations(user.email));
  }

  @Post('invitations/:token/accept')
  async acceptInvitation(
    @CurrentUser() user: JwtPayload,
    @Param('token') token: string,
  ) {
    return ok(await this.coachService.acceptInvitation(user.sub, token));
  }

  @Post('invitations/:token/decline')
  async declineInvitation(
    @CurrentUser() user: JwtPayload,
    @Param('token') token: string,
  ) {
    return ok(await this.coachService.declineInvitation(user.sub, token));
  }

  @Delete('my-coach')
  async removeCoach(@CurrentUser() user: JwtPayload) {
    return ok(await this.coachService.removeCoach(user.sub));
  }
}
