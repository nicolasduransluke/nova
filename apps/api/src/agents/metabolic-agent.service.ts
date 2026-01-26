import { Injectable } from '@nestjs/common';
import type { AgentOutput, DailyEntry } from '@nova/types';
import { BaseAgent, AgentInput } from './base-agent.abstract';
import { ClaudeClientService } from '../claude-client/claude-client.service';

interface WeightTrend {
  direction: 'up' | 'down' | 'stable';
  averageChange: number;
  dataPoints: number;
}

interface MetabolicData {
  currentWeight?: number;
  weightTrend?: WeightTrend;
  bmi?: number;
  goalProgress?: number;
}

@Injectable()
export class MetabolicAgentService extends BaseAgent {
  constructor(claudeClient: ClaudeClientService) {
    super('metabolic', claudeClient);
  }

  protected getSystemPrompt(): string {
    return `You are the Metabolic Analysis component of NOVA.
Your role is to analyze weight and body composition data.

Focus on:
- Weight trends over time (not single data points)
- BMI calculations and what they mean
- Progress toward weight-related goals
- Sustainable rate of change (0.5-1kg per week)

When analyzing:
1. Look at trends, not just numbers
2. Consider natural fluctuations (±1kg is normal daily)
3. Compare to user's stated goals
4. Provide one actionable insight

Keep responses brief and data-focused.`;
  }

  protected validateInput(input: AgentInput): boolean {
    // Metabolic agent needs either extracted weight data or recent weight entries
    const hasWeightData = input.extractedData?.weight !== undefined;
    const hasWeightEntries = input.context.recentEntries.some(
      (e) => e.type === 'food' || e.data?.weight !== undefined,
    );

    return hasWeightData || hasWeightEntries;
  }

  async process(input: AgentInput): Promise<AgentOutput> {
    this.logger.debug(`Processing metabolic analysis for user ${input.context.user.id}`);

    // Calculate metabolic metrics
    const metabolicData = this.calculateMetabolicData(input);

    // Build analysis prompt
    const prompt = this.buildAnalysisPrompt(input, metabolicData);

    // Get Claude's analysis
    const analysis = await this.claudeClient.generateResponse(prompt, {
      systemPrompt: this.getSystemPrompt(),
      maxTokens: 300,
      temperature: 0.5,
    });

    // Parse and structure the output
    const insights = this.parseInsights(analysis);
    const recommendations = this.generateRecommendations(metabolicData, input);

    return this.createOutput({
      insights,
      recommendations,
      dataPoints: metabolicData,
      confidence: this.calculateConfidence(input.extractedData, input.context),
    });
  }

  private calculateMetabolicData(input: AgentInput): MetabolicData {
    const data: MetabolicData = {};
    const { context, extractedData } = input;

    // Get current weight from extracted data
    if (extractedData?.weight) {
      data.currentWeight = extractedData.weight as number;
    }

    // Calculate weight trend from recent entries
    const weightEntries = context.recentEntries
      .filter((e) => e.data?.weight !== undefined)
      .sort(
        (a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

    if (weightEntries.length >= 2) {
      data.weightTrend = this.calculateWeightTrend(weightEntries);
    }

    // Calculate BMI if we have height from profile
    if (data.currentWeight && context.profile?.height) {
      const heightM = context.profile.height / 100;
      data.bmi = Number(
        (data.currentWeight / (heightM * heightM)).toFixed(1),
      );
    }

    // Calculate goal progress if applicable
    if (
      context.profile?.objective === 'weight_loss' &&
      data.currentWeight &&
      context.profile?.weight
    ) {
      const startWeight = context.profile.weight;
      const targetLoss = startWeight * 0.1; // Assume 10% target
      const actualLoss = startWeight - data.currentWeight;
      data.goalProgress = Math.min(
        100,
        Math.max(0, (actualLoss / targetLoss) * 100),
      );
    }

    return data;
  }

  private calculateWeightTrend(entries: DailyEntry[]): WeightTrend {
    const weights = entries.map((e) => e.data.weight as number);
    const firstWeight = weights[0];
    const lastWeight = weights[weights.length - 1];
    const change = lastWeight - firstWeight;

    // Calculate average weekly change
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

  private buildAnalysisPrompt(
    input: AgentInput,
    metabolicData: MetabolicData,
  ): string {
    const basePrompt = this.buildPrompt(input);

    let metricsSection = '\n## Calculated Metrics\n';

    if (metabolicData.currentWeight) {
      metricsSection += `- Current weight: ${metabolicData.currentWeight}kg\n`;
    }

    if (metabolicData.bmi) {
      metricsSection += `- BMI: ${metabolicData.bmi}\n`;
    }

    if (metabolicData.weightTrend) {
      const trend = metabolicData.weightTrend;
      metricsSection += `- Trend: ${trend.direction} (${trend.averageChange > 0 ? '+' : ''}${trend.averageChange}kg/week over ${trend.dataPoints} data points)\n`;
    }

    if (metabolicData.goalProgress !== undefined) {
      metricsSection += `- Goal progress: ${metabolicData.goalProgress.toFixed(0)}%\n`;
    }

    return `${basePrompt}${metricsSection}

Provide a brief metabolic analysis focusing on trends and one actionable insight.`;
  }

  private generateRecommendations(
    data: MetabolicData,
    input: AgentInput,
  ): string[] {
    const recommendations: string[] = [];
    const objective = input.context.profile?.objective;

    if (data.weightTrend) {
      const { direction, averageChange } = data.weightTrend;

      if (objective === 'weight_loss') {
        if (direction === 'down' && Math.abs(averageChange) > 1) {
          recommendations.push(
            'Current rate exceeds 1kg/week. Consider slowing down for sustainability.',
          );
        } else if (direction === 'stable' || direction === 'up') {
          recommendations.push(
            'Weight plateau detected. Review calorie intake and activity levels.',
          );
        } else {
          recommendations.push(
            'Progress is on track. Maintain current approach.',
          );
        }
      }

      if (objective === 'muscle_gain') {
        if (direction === 'up' && averageChange > 0.5) {
          recommendations.push(
            'Gaining at a good rate for lean muscle. Monitor body composition.',
          );
        } else if (direction === 'stable' || direction === 'down') {
          recommendations.push(
            'Consider increasing calorie surplus to support muscle growth.',
          );
        }
      }
    }

    // BMI-based recommendations
    if (data.bmi) {
      if (data.bmi < 18.5) {
        recommendations.push(
          'BMI indicates underweight. Consult healthcare provider for guidance.',
        );
      } else if (data.bmi >= 25 && data.bmi < 30) {
        recommendations.push(
          'BMI in overweight range. Focus on gradual, sustainable changes.',
        );
      }
    }

    return recommendations.slice(0, 2);
  }
}
