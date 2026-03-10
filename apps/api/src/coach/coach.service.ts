import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { generateId } from '@nova/utils';
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

  async acceptInvitationByEmail(token: string, email: string) {
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

    if (email.toLowerCase() !== invitation.patientEmail) {
      throw new ForbiddenException('This invitation is not for this email');
    }

    const patient = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!patient) {
      throw new NotFoundException('No account found with this email. Please register in the Nova app first.');
    }

    await this.prisma.coachPatient.upsert({
      where: {
        coachId_patientId: {
          coachId: invitation.coachId,
          patientId: patient.id,
        },
      },
      update: { status: 'active' },
      create: {
        coachId: invitation.coachId,
        patientId: patient.id,
        status: 'active',
      },
    });

    await this.prisma.coachInvitation.update({
      where: { id: invitation.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    });

    this.logger.log(`Patient ${patient.id} (${email}) accepted invitation via link from coach ${invitation.coachId}`);
    return { message: 'Invitation accepted' };
  }

  async getInvitationInfo(token: string) {
    const invitation = await this.prisma.coachInvitation.findUnique({
      where: { token },
      include: { coach: { select: { id: true, name: true, email: true } } },
    });

    if (!invitation || invitation.status !== 'pending') {
      return null;
    }

    if (invitation.expiresAt < new Date()) {
      return null;
    }

    return {
      coachName: invitation.coach.name,
      coachEmail: invitation.coach.email,
      patientEmail: invitation.patientEmail,
      expiresAt: invitation.expiresAt,
    };
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

  // ─── Coaching Plans ──────────────────────────────────────

  async createPlan(
    coachId: string,
    patientId: string,
    data: {
      goals: Record<string, unknown>;
      instructions?: string;
      coachNotes?: string;
      weekStart?: string;
    },
  ) {
    await this.verifyCoachAccess(coachId, patientId);

    // Calculate week boundaries (Monday-Sunday)
    let weekStart: Date;
    if (data.weekStart) {
      weekStart = new Date(data.weekStart);
    } else {
      const now = new Date();
      const day = now.getDay();
      const mondayOffset = day === 0 ? 6 : day - 1;
      weekStart = new Date(now);
      weekStart.setDate(now.getDate() - mondayOffset);
    }
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Mark any existing active plan as completed
    const existingActive = await this.prisma.coachingPlan.findFirst({
      where: { coachId, patientId, status: 'active' },
    });

    if (existingActive) {
      // Generate results snapshot before completing
      const results = await this.calculatePlanResults(existingActive);
      await this.prisma.coachingPlan.update({
        where: { id: existingActive.id },
        data: { status: 'completed', results },
      });
    }

    // Get next version number
    const lastPlan = await this.prisma.coachingPlan.findFirst({
      where: { patientId },
      orderBy: { version: 'desc' },
    });
    const version = (lastPlan?.version ?? 0) + 1;

    const plan = await this.prisma.coachingPlan.create({
      data: {
        coachId,
        patientId,
        version,
        weekStart,
        weekEnd,
        goals: data.goals as any,
        instructions: data.instructions || '',
        coachNotes: data.coachNotes || '',
      },
    });

    this.logger.log(`Coach ${coachId} created plan v${version} for patient ${patientId}`);

    // Send a chat message to the patient notifying them of the new plan
    this.notifyPatientOfPlan(patientId, coachId, plan).catch((err) =>
      this.logger.error(`Failed to notify patient of new plan: ${err}`),
    );

    return plan;
  }

  /**
   * Send a Nova chat message to the patient introducing the new coaching plan.
   */
  private async notifyPatientOfPlan(
    patientId: string,
    coachId: string,
    plan: { version: number; goals: any; instructions: string },
  ) {
    // Get coach name and patient language preference
    const [coach, patient] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: coachId }, select: { name: true } }),
      this.prisma.user.findUnique({ where: { id: patientId }, select: { metadata: true } }),
    ]);

    const coachName = coach?.name?.split(' ')[0] || 'Tu coach';
    const meta = (patient?.metadata ?? {}) as Record<string, unknown>;
    const isEnglish = meta.preferredLanguage === 'en';

    const goals = plan.goals as Record<string, any>;
    const lines: string[] = [];

    if (isEnglish) {
      lines.push(`Your coach ${coachName} just set up a new plan for you (v${plan.version}):`);
      if (goals.dailyCalories) lines.push(`- Daily calorie budget: ${goals.dailyCalories} kcal`);
      if (goals.weeklyWorkouts) lines.push(`- Workouts per week: ${goals.weeklyWorkouts}`);
      if (goals.proteinGrams) lines.push(`- Protein target: ${goals.proteinGrams}g/day`);
      if (goals.weeklyWeightGoal) lines.push(`- Weekly weight goal: ${goals.weeklyWeightGoal} kg`);
      if (plan.instructions) {
        lines.push('');
        lines.push(`Guidelines: ${plan.instructions}`);
      }
      lines.push('');
      lines.push("I'll help you follow this plan. Let's go!");
    } else {
      lines.push(`Tu coach ${coachName} acaba de crear un nuevo plan para ti (v${plan.version}):`);
      if (goals.dailyCalories) lines.push(`- Presupuesto diario: ${goals.dailyCalories} kcal`);
      if (goals.weeklyWorkouts) lines.push(`- Entrenamientos por semana: ${goals.weeklyWorkouts}`);
      if (goals.proteinGrams) lines.push(`- Proteína objetivo: ${goals.proteinGrams}g/día`);
      if (goals.weeklyWeightGoal) lines.push(`- Meta de peso semanal: ${goals.weeklyWeightGoal} kg`);
      if (plan.instructions) {
        lines.push('');
        lines.push(`Indicaciones: ${plan.instructions}`);
      }
      lines.push('');
      lines.push('Voy a ayudarte a seguir este plan. Vamos!');
    }

    await this.prisma.chatMessage.create({
      data: {
        id: generateId(),
        userId: patientId,
        type: 'text',
        content: lines.join('\n'),
        sender: 'agent',
        metadata: {
          source: 'coaching_plan',
          planVersion: plan.version,
        } as Prisma.InputJsonValue,
      },
    });

    this.logger.debug(`Sent plan notification to patient ${patientId} for plan v${plan.version}`);
  }

  async getPlans(coachId: string, patientId: string) {
    await this.verifyCoachAccess(coachId, patientId);
    return this.prisma.coachingPlan.findMany({
      where: { patientId },
      orderBy: { version: 'desc' },
    });
  }

  async getActivePlan(coachId: string, patientId: string) {
    await this.verifyCoachAccess(coachId, patientId);
    return this.prisma.coachingPlan.findFirst({
      where: { patientId, status: 'active' },
    });
  }

  async updatePlan(
    coachId: string,
    patientId: string,
    planId: string,
    data: {
      goals?: Record<string, unknown>;
      instructions?: string;
      coachNotes?: string;
      status?: string;
    },
  ) {
    await this.verifyCoachAccess(coachId, patientId);

    const plan = await this.prisma.coachingPlan.findUnique({
      where: { id: planId },
    });

    if (!plan || plan.patientId !== patientId) {
      throw new NotFoundException('Plan not found');
    }

    // If completing, generate results snapshot
    if (data.status === 'completed' && plan.status === 'active') {
      const results = await this.calculatePlanResults(plan);
      return this.prisma.coachingPlan.update({
        where: { id: planId },
        data: { ...data, goals: data.goals as any, results },
      });
    }

    const oldGoals = plan.goals as Record<string, any>;
    const oldInstructions = plan.instructions;

    const updated = await this.prisma.coachingPlan.update({
      where: { id: planId },
      data: { ...data, goals: data.goals ? (data.goals as any) : undefined },
    });

    // Notify patient if goals or instructions changed (not coachNotes-only edits)
    const goalsChanged = data.goals && JSON.stringify(data.goals) !== JSON.stringify(oldGoals);
    const instructionsChanged = data.instructions != null && data.instructions !== oldInstructions;

    if (goalsChanged || instructionsChanged) {
      this.notifyPatientOfPlanEdit(patientId, coachId, oldGoals, data.goals as Record<string, any> | undefined, oldInstructions, data.instructions, instructionsChanged ?? false).catch((err) =>
        this.logger.error(`Failed to notify patient of plan edit: ${err}`),
      );
    }

    return updated;
  }

  /**
   * Send a lightweight chat message when the coach edits the active plan.
   * Only mentions what actually changed.
   */
  private async notifyPatientOfPlanEdit(
    patientId: string,
    coachId: string,
    oldGoals: Record<string, any>,
    newGoals: Record<string, any> | undefined,
    oldInstructions: string,
    newInstructions: string | undefined,
    instructionsChanged: boolean,
  ) {
    const [coach, patient] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: coachId }, select: { name: true } }),
      this.prisma.user.findUnique({ where: { id: patientId }, select: { metadata: true } }),
    ]);

    const coachName = coach?.name?.split(' ')[0] || 'Tu coach';
    const meta = (patient?.metadata ?? {}) as Record<string, unknown>;
    const isEnglish = meta.preferredLanguage === 'en';

    const changes: string[] = [];

    if (newGoals) {
      const goalLabels: Record<string, [string, string, string]> = {
        dailyCalories: ['Calorías/día', 'Daily calories', 'kcal'],
        weeklyWorkouts: ['Entrenamientos/sem', 'Workouts/week', ''],
        proteinTarget: ['Proteína/día', 'Protein/day', 'g'],
        weeklyWeightGoal: ['Meta peso/sem', 'Weight goal/week', 'kg'],
      };

      for (const [key, [esLabel, enLabel, unit]] of Object.entries(goalLabels)) {
        if (newGoals[key] != null && newGoals[key] !== oldGoals[key]) {
          const label = isEnglish ? enLabel : esLabel;
          const suffix = unit ? ` ${unit}` : '';
          if (oldGoals[key] != null) {
            changes.push(`- ${label}: ${oldGoals[key]}${suffix} → ${newGoals[key]}${suffix}`);
          } else {
            changes.push(`- ${label}: ${newGoals[key]}${suffix}`);
          }
        }
      }
    }

    if (instructionsChanged) {
      changes.push(isEnglish
        ? '- Updated plan guidelines'
        : '- Indicaciones actualizadas');
    }

    if (changes.length === 0) return;

    const header = isEnglish
      ? `Your coach ${coachName} adjusted your plan:`
      : `Tu coach ${coachName} ajustó tu plan:`;

    const content = [header, ...changes].join('\n');

    await this.prisma.chatMessage.create({
      data: {
        id: generateId(),
        userId: patientId,
        type: 'text',
        content,
        sender: 'agent',
        metadata: {
          source: 'coaching_plan_edit',
        } as Prisma.InputJsonValue,
      },
    });

    this.logger.debug(`Sent plan edit notification to patient ${patientId}`);
  }

  async getPlanProgress(coachId: string, patientId: string) {
    await this.verifyCoachAccess(coachId, patientId);

    const plan = await this.prisma.coachingPlan.findFirst({
      where: { patientId, status: 'active' },
    });

    if (!plan) return null;

    const goals = plan.goals as any;
    const now = new Date();

    // Today's data
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const todayEntries = await this.prisma.calorieEntry.findMany({
      where: {
        userId: patientId,
        date: { gte: todayStart, lte: todayEnd },
      },
    });

    const caloriesConsumed = todayEntries
      .filter((e) => e.type === 'intake')
      .reduce((sum, e) => sum + e.calories, 0);
    const caloriesBurned = todayEntries
      .filter((e) => e.type === 'burn')
      .reduce((sum, e) => sum + e.calories, 0);
    const mealCount = todayEntries.filter((e) => e.type === 'intake').length;
    const hasWorkout = todayEntries.some((e) => e.type === 'burn');

    // Week data
    const weekEntries = await this.prisma.calorieEntry.findMany({
      where: {
        userId: patientId,
        date: { gte: plan.weekStart, lte: plan.weekEnd },
      },
    });

    // Group by day
    const dayMap = new Map<string, { intake: number; hasBurn: boolean }>();
    for (const entry of weekEntries) {
      const dayKey = entry.date.toISOString().split('T')[0];
      const day = dayMap.get(dayKey) || { intake: 0, hasBurn: false };
      if (entry.type === 'intake') day.intake += entry.calories;
      if (entry.type === 'burn') day.hasBurn = true;
      dayMap.set(dayKey, day);
    }

    const daysTracked = dayMap.size;
    const daysOnTarget = [...dayMap.values()].filter(
      (d) => goals.dailyCalories && d.intake <= goals.dailyCalories * 1.05,
    ).length;
    const totalIntake = [...dayMap.values()].reduce((s, d) => s + d.intake, 0);
    const avgDailyCalories = daysTracked > 0 ? Math.round(totalIntake / daysTracked) : 0;
    const workoutsCompleted = [...dayMap.values()].filter((d) => d.hasBurn).length;

    // Weight change during plan
    const weightLogs = await this.prisma.weightLog.findMany({
      where: {
        userId: patientId,
        date: { gte: plan.weekStart, lte: plan.weekEnd },
      },
      orderBy: { date: 'asc' },
    });
    let weightChange: number | null = null;
    if (weightLogs.length >= 2) {
      weightChange = weightLogs[weightLogs.length - 1].weight - weightLogs[0].weight;
    }

    const complianceRate = daysTracked > 0 ? Math.round((daysOnTarget / daysTracked) * 100) : 0;

    return {
      plan,
      today: {
        date: todayStart.toISOString().split('T')[0],
        caloriesConsumed,
        caloriesBurned,
        remaining: (goals.dailyCalories || 0) - caloriesConsumed,
        mealCount,
        hasWorkout,
      },
      week: {
        daysTracked,
        daysOnTarget,
        avgDailyCalories,
        workoutsCompleted,
        complianceRate,
        weightChange,
      },
    };
  }

  // Get active plan for AI injection (no coach auth needed — called by orchestrator)
  async getActivePlanForPatient(patientId: string) {
    return this.prisma.coachingPlan.findFirst({
      where: { patientId, status: 'active' },
    });
  }

  async getCompletedPlansForPatient(patientId: string, limit: number = 4) {
    return this.prisma.coachingPlan.findMany({
      where: { patientId, status: 'completed' },
      orderBy: { version: 'desc' },
      take: limit,
    });
  }

  async getPatientAIProfile(patientId: string) {
    return this.prisma.patientProfileAI.findUnique({
      where: { patientId },
    });
  }

  async updateCoachInsights(coachId: string, patientId: string, insights: string[]) {
    await this.verifyCoachAccess(coachId, patientId);

    return this.prisma.patientProfileAI.upsert({
      where: { patientId },
      update: { coachInsights: insights },
      create: {
        patientId,
        coachInsights: insights,
      },
    });
  }

  async getCoachInsights(coachId: string, patientId: string) {
    await this.verifyCoachAccess(coachId, patientId);
    const profile = await this.prisma.patientProfileAI.findUnique({
      where: { patientId },
    });
    return (profile?.coachInsights as string[]) || [];
  }

  private async calculatePlanResults(plan: any) {
    const goals = plan.goals as any;

    const entries = await this.prisma.calorieEntry.findMany({
      where: {
        userId: plan.patientId,
        date: { gte: plan.weekStart, lte: plan.weekEnd },
      },
    });

    const dayMap = new Map<string, { intake: number; hasBurn: boolean }>();
    for (const entry of entries) {
      const dayKey = entry.date.toISOString().split('T')[0];
      const day = dayMap.get(dayKey) || { intake: 0, hasBurn: false };
      if (entry.type === 'intake') day.intake += entry.calories;
      if (entry.type === 'burn') day.hasBurn = true;
      dayMap.set(dayKey, day);
    }

    const daysTracked = dayMap.size;
    const totalIntake = [...dayMap.values()].reduce((s, d) => s + d.intake, 0);
    const daysOnTarget = [...dayMap.values()].filter(
      (d) => goals.dailyCalories && d.intake <= goals.dailyCalories * 1.05,
    ).length;

    const weightLogs = await this.prisma.weightLog.findMany({
      where: {
        userId: plan.patientId,
        date: { gte: plan.weekStart, lte: plan.weekEnd },
      },
      orderBy: { date: 'asc' },
    });

    let weightChange = 0;
    if (weightLogs.length >= 2) {
      weightChange = weightLogs[weightLogs.length - 1].weight - weightLogs[0].weight;
    }

    return {
      avgDailyCalories: daysTracked > 0 ? Math.round(totalIntake / daysTracked) : 0,
      daysOnTarget,
      totalWorkouts: [...dayMap.values()].filter((d) => d.hasBurn).length,
      weightChange: Number(weightChange.toFixed(2)),
      complianceRate: daysTracked > 0 ? Math.round((daysOnTarget / daysTracked) * 100) : 0,
    };
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
