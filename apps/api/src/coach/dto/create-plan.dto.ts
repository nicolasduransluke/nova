import { IsOptional, IsString, IsObject } from 'class-validator';

export class CreatePlanDto {
  @IsObject()
  goals: {
    dailyCalories?: number;
    weeklyWorkouts?: number;
    weeklyWeightGoal?: number;
    goalWeight?: number;
    targetWeeks?: number;
    proteinTarget?: number;
    waterTarget?: number;
    customGoals?: { label: string; target: string; unit: string }[];
  };

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsString()
  coachNotes?: string;

  @IsOptional()
  @IsString()
  weekStart?: string;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsObject()
  goals?: {
    dailyCalories?: number;
    weeklyWorkouts?: number;
    weeklyWeightGoal?: number;
    goalWeight?: number;
    targetWeeks?: number;
    proteinTarget?: number;
    waterTarget?: number;
    customGoals?: { label: string; target: string; unit: string }[];
  };

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsString()
  coachNotes?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
