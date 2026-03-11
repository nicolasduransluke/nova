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
import { CreatePlanDto, UpdatePlanDto } from './dto/create-plan.dto';

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
    return ok(await this.coachService.invitePatient(user.sub, dto.patientEmail ?? undefined));
  }

  @Get('invitations')
  @Roles('coach')
  async getMyInvitations(@CurrentUser() user: JwtPayload) {
    return ok(await this.coachService.getCoachInvitations(user.sub));
  }

  @Get('dashboard-stats')
  @Roles('coach')
  async getDashboardStats(@CurrentUser() user: JwtPayload) {
    return ok(await this.coachService.getDashboardStats(user.sub));
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

  @Get('patients/:patientId/usage')
  @Roles('coach')
  async getPatientUsage(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
  ) {
    return ok(await this.coachService.getPatientUsage(user.sub, patientId));
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

  // ─── Coaching Plans ──────────────────────────────────────

  @Post('patients/:patientId/plans')
  @Roles('coach')
  async createPlan(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
    @Body() dto: CreatePlanDto,
  ) {
    return ok(await this.coachService.createPlan(user.sub, patientId, dto));
  }

  @Get('patients/:patientId/plans')
  @Roles('coach')
  async getPlans(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
  ) {
    return ok(await this.coachService.getPlans(user.sub, patientId));
  }

  @Get('patients/:patientId/plans/active')
  @Roles('coach')
  async getActivePlan(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
  ) {
    return ok(await this.coachService.getActivePlan(user.sub, patientId));
  }

  @Get('patients/:patientId/plans/progress')
  @Roles('coach')
  async getPlanProgress(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
  ) {
    return ok(await this.coachService.getPlanProgress(user.sub, patientId));
  }

  @Patch('patients/:patientId/plans/:planId')
  @Roles('coach')
  async updatePlan(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
    @Param('planId') planId: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return ok(await this.coachService.updatePlan(user.sub, patientId, planId, dto));
  }

  // ─── Coach Insights ─────────────────────────────────────

  @Get('patients/:patientId/insights')
  @Roles('coach')
  async getInsights(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
  ) {
    return ok(await this.coachService.getCoachInsights(user.sub, patientId));
  }

  @Patch('patients/:patientId/insights')
  @Roles('coach')
  async updateInsights(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
    @Body() body: { insights: string[] },
  ) {
    return ok(await this.coachService.updateCoachInsights(user.sub, patientId, body.insights));
  }

  // ─── Coaching Logs & Style ─────────────────────────────

  @Get('patients/:patientId/coaching-logs')
  @Roles('coach')
  async getCoachingLogs(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
    @Query('days') days?: string,
  ) {
    return ok(await this.coachService.getCoachingLogs(user.sub, patientId, Number(days) || 30));
  }

  @Patch('patients/:patientId/coaching-logs/:logId/dislike')
  @Roles('coach')
  async dislikeCoachingLog(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
    @Param('logId') logId: string,
  ) {
    return ok(await this.coachService.dislikeCoachingLog(user.sub, patientId, logId));
  }

  @Get('patients/:patientId/style')
  @Roles('coach')
  async getPatientStyle(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
  ) {
    return ok(await this.coachService.getPatientStyle(user.sub, patientId));
  }

  @Patch('patients/:patientId/style')
  @Roles('coach')
  async updatePatientStyle(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
    @Body() body: { styleInstructions: string },
  ) {
    return ok(await this.coachService.updatePatientStyle(user.sub, patientId, body.styleInstructions));
  }

  @Get('patients/:patientId/protocol')
  @Roles('coach')
  async getPatientProtocol(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
  ) {
    return ok(await this.coachService.getPatientProtocol(user.sub, patientId));
  }

  @Patch('patients/:patientId/protocol')
  @Roles('coach')
  async updatePatientProtocol(
    @CurrentUser() user: JwtPayload,
    @Param('patientId') patientId: string,
    @Body() body: { coachingProtocol: string },
  ) {
    return ok(await this.coachService.updatePatientProtocol(user.sub, patientId, body.coachingProtocol));
  }

  // ─── Patient endpoints ────────────────────────────────────

  @Get('my-coach')
  async getMyCoach(@CurrentUser() user: JwtPayload) {
    return ok(await this.coachService.getMyCoach(user.sub));
  }

  @Get('my-plan')
  async getMyPlan(@CurrentUser() user: JwtPayload) {
    return ok(await this.coachService.getActivePlanForPatient(user.sub));
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
