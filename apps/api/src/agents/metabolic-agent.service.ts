import { Injectable } from '@nestjs/common';
import type { AgentOutput, DailyEntry, DailySummary, Profile, WeightProgress } from '@nova/types';
import { BaseAgent, AgentInput } from './base-agent.abstract';
import { ClaudeClientService } from '../claude-client/claude-client.service';

interface WeightTrend {
  direction: 'up' | 'down' | 'stable';
  averageChange: number;
  dataPoints: number;
}

@Injectable()
export class MetabolicAgentService extends BaseAgent {
  constructor(claudeClient: ClaudeClientService) {
    super('metabolic', claudeClient);
  }

  protected getSystemPrompt(): string {
    return `You are the Metabolic Analysis component of NOVA, a calorie deficit coach.
Your role is to analyze weight trends and calorie deficit progress.

Focus on:
- Weight trends over time (not single data points)
- BMI calculations
- Deficit progress and projected weight loss
- Sustainable rate of change (0.5-1kg per week)
- Plateau detection

Keep responses brief, data-focused, and in the user's language.`;
  }

  protected validateInput(input: AgentInput): boolean {
    const hasWeightData = input.extractedData?.weight !== undefined;
    const hasWeightEntries = input.context.recentEntries.some(
      (e) => e.type === 'food' || e.data?.weight !== undefined,
    );
    return hasWeightData || hasWeightEntries || input.message.length > 2;
  }

  async process(input: AgentInput): Promise<AgentOutput> {
    this.logger.debug(`Processing metabolic analysis for user ${input.context.user.id}`);

    const profile = input.context.profile;
    const currentWeight = input.extractedData?.weight as number | undefined;

    // Calculate BMI if possible
    let bmi: number | undefined;
    const weight = currentWeight || profile?.weight;
    if (weight && profile?.height) {
      const heightM = profile.height / 100;
      bmi = Number((weight / (heightM * heightM)).toFixed(1));
    }

    // Calculate weight trend from recent entries
    const weightEntries = input.context.recentEntries
      .filter((e) => e.data?.weight !== undefined)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let weightTrend: WeightTrend | undefined;
    if (weightEntries.length >= 2) {
      weightTrend = this.calculateWeightTrend(weightEntries);
    }

    // Calculate TDEE
    const tdee = this.calculateTDEE(profile);

    // Build insights
    const insights: string[] = [];
    const recommendations: string[] = [];

    if (currentWeight) {
      insights.push(`Peso registrado: ${currentWeight} kg`);
    }

    if (bmi) {
      const bmiCategory = bmi < 18.5 ? 'bajo peso' : bmi < 25 ? 'normal' : bmi < 30 ? 'sobrepeso' : 'obesidad';
      insights.push(`IMC: ${bmi} (${bmiCategory})`);
    }

    if (weightTrend) {
      const direction = weightTrend.direction === 'down' ? 'bajando' :
                       weightTrend.direction === 'up' ? 'subiendo' : 'estable';
      insights.push(`Tendencia: ${direction} (${weightTrend.averageChange > 0 ? '+' : ''}${weightTrend.averageChange} kg/semana)`);

      if (weightTrend.direction === 'down' && Math.abs(weightTrend.averageChange) > 1) {
        recommendations.push('Estás bajando más de 1 kg/semana. Considera reducir el déficit para que sea sostenible.');
      } else if (weightTrend.direction === 'stable') {
        recommendations.push('Tu peso está estable. Si buscas perder, revisa tu ingesta calórica.');
      } else if (weightTrend.direction === 'down') {
        recommendations.push('Buen progreso. Mantén la consistencia.');
      }
    }

    // Weight projection based on deficit
    const weeklyGoal = profile?.weeklyGoal ?? 0.5;
    const dailyDeficit = Math.round((weeklyGoal * 7700) / 7);
    const projectedWeeklyLoss = dailyDeficit * 7 / 7700;
    insights.push(`Proyección con déficit de ${dailyDeficit} kcal/día: ~${projectedWeeklyLoss.toFixed(2)} kg/semana`);

    return this.createOutput({
      insights,
      recommendations,
      dataPoints: {
        currentWeight,
        bmi,
        weightTrend,
        tdee,
        projectedWeeklyLoss,
      },
      confidence: this.calculateConfidence(input.extractedData, input.context),
    });
  }

  calculateTDEE(profile?: Profile): number {
    if (!profile) return 2000;

    let bmr: number;
    if (profile.sex === 'male') {
      bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
    } else {
      bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
    }

    const activityMultipliers: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    };

    const multiplier = activityMultipliers[profile.activityLevel] || 1.55;
    return bmr * multiplier;
  }

  calculateDailySummary(
    profile: Profile | undefined,
    todayIntake: number,
    todayBurn: number,
    lastWeight?: number,
    goalWeight?: number,
  ): DailySummary {
    const tdee = this.calculateTDEE(profile);
    const totalBurn = tdee + todayBurn;
    const deficit = totalBurn - todayIntake;
    // Derive targetDeficit from user's weeklyGoal: kg/week * 7700 kcal/kg / 7 days
    const weeklyGoal = profile?.weeklyGoal ?? 0.5;
    const targetDeficit = Math.round((weeklyGoal * 7700) / 7);
    const projectedWeeklyLoss = (deficit * 7) / 7700; // 7700 cal = 1 kg

    const effectiveGoalWeight = goalWeight ?? profile?.goalWeight;
    let weightProgress: WeightProgress | undefined;
    if (lastWeight != null && effectiveGoalWeight != null) {
      const startingWeight = profile?.weight;
      const remaining = Number((lastWeight - effectiveGoalWeight).toFixed(1));
      let estimatedWeeks: number | undefined;
      if (remaining > 0 && weeklyGoal > 0) {
        estimatedWeeks = Math.round(remaining / weeklyGoal);
      }
      weightProgress = {
        current: lastWeight,
        goal: effectiveGoalWeight,
        remaining,
        change: startingWeight != null
          ? Number((lastWeight - startingWeight).toFixed(1))
          : undefined,
        estimatedWeeks,
      };
    }

    return {
      date: new Date(),
      intake: todayIntake,
      burn: todayBurn,
      tdee: Math.round(tdee),
      deficit: Math.round(deficit),
      targetDeficit,
      projectedWeeklyLoss: Number(projectedWeeklyLoss.toFixed(2)),
      goalWeight: effectiveGoalWeight,
      currentWeight: lastWeight,
      weightProgress,
    };
  }

  private calculateWeightTrend(entries: DailyEntry[]): WeightTrend {
    const weights = entries.map((e) => e.data.weight as number);
    const firstWeight = weights[0];
    const lastWeight = weights[weights.length - 1];
    const change = lastWeight - firstWeight;

    const daysDiff =
      (new Date(entries[entries.length - 1].date).getTime() -
        new Date(entries[0].date).getTime()) /
      (1000 * 60 * 60 * 24);
    const weeklyChange = daysDiff > 0 ? (change / daysDiff) * 7 : 0;

    return {
      direction:
        Math.abs(change) < 0.5 ? 'stable' : change > 0 ? 'up' : 'down',
      averageChange: Number(weeklyChange.toFixed(2)),
      dataPoints: weights.length,
    };
  }
}
