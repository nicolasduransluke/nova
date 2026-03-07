import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { HistoryService } from '../history/history.service';

@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: HistoryService,
  ) {}

  // ─── Invitations ───────────────────────────────────────────

  async invitePatient(coachId: string, patientEmail: string) {
    const coach = await this.prisma.user.findUnique({ where: { id: coachId } });
    if (!coach || coach.role !== 'coach') {
      throw new ForbiddenException('Only coaches can invite patients');
    }

    if (coach.email.toLowerCase() === patientEmail.toLowerCase()) {
      throw new BadRequestException('Cannot invite yourself');
    }

    // Check if relationship already exists
    const existingPatient = await this.prisma.user.findUnique({
      where: { email: patientEmail.toLowerCase() },
    });

    if (existingPatient) {
      const existingRelation = await this.prisma.coachPatient.findUnique({
        where: {
          coachId_patientId: { coachId, patientId: existingPatient.id },
        },
      });
      if (existingRelation && existingRelation.status === 'active') {
        throw new ConflictException('This patient is already linked to you');
      }
    }

    // Check for pending invitation
    const pendingInvite = await this.prisma.coachInvitation.findFirst({
      where: {
        coachId,
        patientEmail: patientEmail.toLowerCase(),
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
    });

    if (pendingInvite) {
      throw new ConflictException('An invitation is already pending for this email');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.prisma.coachInvitation.create({
      data: {
        coachId,
        patientEmail: patientEmail.toLowerCase(),
        token,
        expiresAt,
      },
    });

    this.logger.log(`Coach ${coachId} invited ${patientEmail}`);

    return {
      id: invitation.id,
      patientEmail: invitation.patientEmail,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      token: invitation.token,
    };
  }

  async acceptInvitation(patientId: string, token: string) {
    const invitation = await this.prisma.coachInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException(`Invitation already ${invitation.status}`);
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.coachInvitation.update({
        where: { id: invitation.id },
        data: { status: 'expired' },
      });
      throw new BadRequestException('Invitation has expired');
    }

    // Verify the patient's email matches
    const patient = await this.prisma.user.findUnique({ where: { id: patientId } });
    if (!patient || patient.email.toLowerCase() !== invitation.patientEmail) {
      throw new ForbiddenException('This invitation is not for your account');
    }

    // Create the relationship
    await this.prisma.coachPatient.upsert({
      where: {
        coachId_patientId: {
          coachId: invitation.coachId,
          patientId,
        },
      },
      update: { status: 'active' },
      create: {
        coachId: invitation.coachId,
        patientId,
        status: 'active',
      },
    });

    await this.prisma.coachInvitation.update({
      where: { id: invitation.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    });

    this.logger.log(`Patient ${patientId} accepted invitation from coach ${invitation.coachId}`);
    return { message: 'Invitation accepted' };
  }

  async declineInvitation(patientId: string, token: string) {
    const invitation = await this.prisma.coachInvitation.findUnique({
      where: { token },
    });

    if (!invitation || invitation.status !== 'pending') {
      throw new NotFoundException('Invitation not found or already processed');
    }

    const patient = await this.prisma.user.findUnique({ where: { id: patientId } });
    if (!patient || patient.email.toLowerCase() !== invitation.patientEmail) {
      throw new ForbiddenException('This invitation is not for your account');
    }

    await this.prisma.coachInvitation.update({
      where: { id: invitation.id },
      data: { status: 'declined' },
    });

    return { message: 'Invitation declined' };
  }

  async getCoachInvitations(coachId: string) {
    return this.prisma.coachInvitation.findMany({
      where: { coachId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPatientInvitations(patientEmail: string) {
    return this.prisma.coachInvitation.findMany({
      where: {
        patientEmail: patientEmail.toLowerCase(),
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      include: {
        coach: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Coach Patient Management ─────────────────────────────

  async getPatients(coachId: string) {
    const relationships = await this.prisma.coachPatient.findMany({
      where: { coachId, status: 'active' },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            timezone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with profile and latest weight
    const patients = await Promise.all(
      relationships.map(async (rel) => {
        const [profile, latestWeight] = await Promise.all([
          this.prisma.profile.findUnique({ where: { userId: rel.patientId } }),
          this.prisma.weightLog.findFirst({
            where: { userId: rel.patientId },
            orderBy: { date: 'desc' },
          }),
        ]);

        return {
          patient: rel.patient,
          relationship: {
            id: rel.id,
            status: rel.status,
            notes: rel.notes,
            createdAt: rel.createdAt,
          },
          profile: profile
            ? {
                weight: profile.weight,
                height: profile.height,
                age: profile.age,
                sex: profile.sex,
                objective: profile.objective,
                activityLevel: profile.activityLevel,
                goalWeight: profile.goalWeight,
                weeklyGoal: profile.weeklyGoal,
              }
            : null,
          latestWeight: latestWeight
            ? { weight: latestWeight.weight, date: latestWeight.date }
            : null,
        };
      }),
    );

    return patients;
  }

  async getPatientDetail(coachId: string, patientId: string) {
    await this.verifyCoachAccess(coachId, patientId);

    const [patient, profile, latestWeight] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: patientId },
        select: { id: true, name: true, email: true, createdAt: true, timezone: true },
      }),
      this.prisma.profile.findUnique({ where: { userId: patientId } }),
      this.prisma.weightLog.findFirst({
        where: { userId: patientId },
        orderBy: { date: 'desc' },
      }),
    ]);

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return { patient, profile, latestWeight };
  }

  async getPatientHistory(coachId: string, patientId: string, days: number) {
    await this.verifyCoachAccess(coachId, patientId);
    return this.historyService.getDailyHistory(patientId, days);
  }

  async getPatientWeightHistory(coachId: string, patientId: string, days: number) {
    await this.verifyCoachAccess(coachId, patientId);
    return this.historyService.getWeightHistory(patientId, days);
  }

  async getPatientMessages(coachId: string, patientId: string, limit: number = 50) {
    await this.verifyCoachAccess(coachId, patientId);

    return this.prisma.chatMessage.findMany({
      where: { userId: patientId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async updateRelationship(
    coachId: string,
    patientId: string,
    data: { status?: string; notes?: string },
  ) {
    const relationship = await this.prisma.coachPatient.findUnique({
      where: { coachId_patientId: { coachId, patientId } },
    });

    if (!relationship) {
      throw new NotFoundException('Relationship not found');
    }

    return this.prisma.coachPatient.update({
      where: { id: relationship.id },
      data,
    });
  }

  // ─── Patient side ─────────────────────────────────────────

  async getMyCoach(patientId: string) {
    const relationship = await this.prisma.coachPatient.findFirst({
      where: { patientId, status: 'active' },
      include: {
        coach: { select: { id: true, name: true, email: true } },
      },
    });

    return relationship
      ? { coach: relationship.coach, since: relationship.createdAt }
      : null;
  }

  async removeCoach(patientId: string) {
    const relationship = await this.prisma.coachPatient.findFirst({
      where: { patientId, status: 'active' },
    });

    if (!relationship) {
      throw new NotFoundException('No active coach found');
    }

    await this.prisma.coachPatient.update({
      where: { id: relationship.id },
      data: { status: 'ended' },
    });

    return { message: 'Coach removed' };
  }

  // ─── Helpers ──────────────────────────────────────────────

  private async verifyCoachAccess(coachId: string, patientId: string) {
    const relationship = await this.prisma.coachPatient.findUnique({
      where: { coachId_patientId: { coachId, patientId } },
    });

    if (!relationship || relationship.status !== 'active') {
      throw new ForbiddenException('You do not have access to this patient');
    }

    return relationship;
  }
}
