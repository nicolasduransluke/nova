import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import type { ApiResponse, Profile, ActivityLevel } from '@nova/types';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../auth/decorators/current-user.decorator';
import { generateId } from '@nova/utils';

interface CreateProfileDto {
  weight: number;
  height: number;
  age: number;
  sex: 'male' | 'female';
  goalWeight?: number;
  weeklyGoal?: number;
  activityLevel?: string;
}

interface UpdateProfileDto {
  weight?: number;
  height?: number;
  age?: number;
  sex?: 'male' | 'female';
  goalWeight?: number;
  weeklyGoal?: number;
  targetWeeks?: number;
  activityLevel?: ActivityLevel;
}

@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createProfile(
    @Body() dto: CreateProfileDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<Profile>> {
    const profile = await this.prisma.profile.upsert({
      where: { userId: user.sub },
      update: {
        weight: dto.weight,
        height: dto.height,
        age: dto.age,
        sex: dto.sex,
        objective: 'weight_loss',
        activityLevel: dto.activityLevel || 'moderate',
        goalWeight: dto.goalWeight,
        weeklyGoal: dto.weeklyGoal ?? 0.5,
      },
      create: {
        id: generateId(),
        userId: user.sub,
        weight: dto.weight,
        height: dto.height,
        age: dto.age,
        sex: dto.sex,
        objective: 'weight_loss',
        activityLevel: dto.activityLevel || 'moderate',
        goalWeight: dto.goalWeight,
        weeklyGoal: dto.weeklyGoal ?? 0.5,
      },
    });

    // Create initial weight log
    await this.prisma.weightLog.create({
      data: {
        id: generateId(),
        userId: user.sub,
        weight: dto.weight,
        date: new Date(),
      },
    }).catch(() => {
      // Ignore if weight log creation fails (not critical)
    });

    return {
      success: true,
      data: {
        id: profile.id,
        userId: profile.userId,
        weight: profile.weight,
        height: profile.height,
        age: profile.age,
        sex: profile.sex as Profile['sex'],
        objective: profile.objective as Profile['objective'],
        activityLevel: (profile.activityLevel || 'moderate') as Profile['activityLevel'],
        goalWeight: profile.goalWeight ?? undefined,
        weeklyGoal: profile.weeklyGoal ?? undefined,
        targetWeeks: profile.targetWeeks ?? undefined,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    };
  }

  @Get(':userId')
  async getProfile(
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<Profile>> {
    if (userId !== user.sub) {
      throw new ForbiddenException('You can only access your own profile');
    }
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return {
      success: true,
      data: {
        id: profile.id,
        userId: profile.userId,
        weight: profile.weight,
        height: profile.height,
        age: profile.age,
        sex: profile.sex as Profile['sex'],
        objective: profile.objective as Profile['objective'],
        activityLevel: (profile.activityLevel || 'moderate') as Profile['activityLevel'],
        goalWeight: profile.goalWeight ?? undefined,
        weeklyGoal: profile.weeklyGoal ?? undefined,
        targetWeeks: profile.targetWeeks ?? undefined,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    };
  }

  @Patch(':userId')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Param('userId') userId: string,
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<Profile>> {
    if (userId !== user.sub) {
      throw new ForbiddenException('You can only update your own profile');
    }

    const existing = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException('Profile not found');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.weight !== undefined) updateData.weight = dto.weight;
    if (dto.height !== undefined) updateData.height = dto.height;
    if (dto.age !== undefined) updateData.age = dto.age;
    if (dto.sex !== undefined) updateData.sex = dto.sex;
    if (dto.goalWeight !== undefined) updateData.goalWeight = dto.goalWeight;
    if (dto.weeklyGoal !== undefined) updateData.weeklyGoal = dto.weeklyGoal;
    if (dto.targetWeeks !== undefined) updateData.targetWeeks = dto.targetWeeks;
    if (dto.activityLevel !== undefined) updateData.activityLevel = dto.activityLevel;

    const updated = await this.prisma.profile.update({
      where: { userId },
      data: updateData,
    });

    // If weight changed, also create a weight log entry to keep history in sync
    if (dto.weight !== undefined && dto.weight !== existing.weight) {
      try {
        await this.prisma.weightLog.create({
          data: {
            id: generateId(),
            userId,
            weight: dto.weight,
            date: new Date(),
          },
        });
      } catch (err) {
        console.error('Failed to create weight log on profile update:', err);
      }
    }

    return {
      success: true,
      data: {
        id: updated.id,
        userId: updated.userId,
        weight: updated.weight,
        height: updated.height,
        age: updated.age,
        sex: updated.sex as Profile['sex'],
        objective: updated.objective as Profile['objective'],
        activityLevel: (updated.activityLevel || 'moderate') as Profile['activityLevel'],
        goalWeight: updated.goalWeight ?? undefined,
        weeklyGoal: updated.weeklyGoal ?? undefined,
        targetWeeks: updated.targetWeeks ?? undefined,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
      message: 'Profile updated successfully',
    };
  }
}
