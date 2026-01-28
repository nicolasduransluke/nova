import { Injectable } from '@nestjs/common';
import type { AgentOutput, Profile } from '@nova/types';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import { BaseAgent, AgentInput } from './base-agent.abstract';

export interface ActivityBurnResult {
  activity: string;
  durationMinutes: number;
  caloriesBurned: number;
}

// MET values for common activities
const MET_VALUES: Record<string, number> = {
  // Walking
  caminar: 3.5, walking: 3.5, caminata: 3.5,
  // Running
  correr: 8, running: 8, trotar: 6, jogging: 6,
  // Cycling
  ciclismo: 7, cycling: 7, bicicleta: 7, bici: 7, bike: 7,
  // Swimming
  nadar: 7, swimming: 7, natación: 7, natacion: 7,
  // Weights / Strength
  pesas: 5.5, weights: 5.5, strength: 5.5, gimnasio: 5.5, gym: 5.5,
  // High intensity
  hiit: 10, crossfit: 10, boxeo: 8, boxing: 8,
  // Cardio machines
  elíptica: 6, eliptica: 6, elliptical: 6,
  // Sports
  fútbol: 8, futbol: 8, soccer: 8, football: 8,
  tenis: 7, tennis: 7,
  basketball: 7, basquet: 7,
  // Yoga / Flexibility
  yoga: 3, stretching: 2.5, estirar: 2.5, pilates: 3.5,
  // Dance
  bailar: 5, dance: 5, zumba: 7,
};

@Injectable()
export class ActivityBurnAgentService extends BaseAgent {
  constructor(claudeClient: ClaudeClientService) {
    super('activity', claudeClient);
  }

  async process(input: AgentInput): Promise<AgentOutput> {
    if (!this.validateInput(input)) {
      return this.createOutput({
        insights: ['No se detectó actividad física'],
        confidence: 0.3,
      });
    }

    try {
      const result = await this.estimateBurn(input.message, input.context.profile);

      const insights = [
        `Actividad: ${result.activity} (${result.durationMinutes} min)`,
        `Calorías quemadas estimadas: ${result.caloriesBurned} kcal`,
      ];

      return this.createOutput({
        insights,
        recommendations: [],
        dataPoints: {
          activity: result.activity,
          durationMinutes: result.durationMinutes,
          caloriesBurned: result.caloriesBurned,
        },
        confidence: 0.7,
      });
    } catch (error) {
      this.logger.error(`Activity burn estimation error: ${error}`);
      return this.createOutput({
        insights: ['Error al estimar calorías quemadas'],
        confidence: 0.2,
      });
    }
  }

  protected getSystemPrompt(): string {
    return `You are an exercise calorie burn estimator. Extract activity type and duration from user messages.

Guidelines:
- Extract the activity name and duration in minutes
- Always respond with valid JSON
- If duration is not mentioned, estimate based on typical session length`;
  }

  protected validateInput(input: AgentInput): boolean {
    return input.message.length > 2;
  }

  async estimateBurn(description: string, profile?: Profile): Promise<ActivityBurnResult> {
    // Try to extract activity info from message directly
    const parsed = this.parseActivityFromMessage(description);

    if (parsed) {
      const weight = profile?.weight || 70;
      const caloriesBurned = this.calculateCaloriesBurned(
        parsed.met,
        weight,
        parsed.durationMinutes,
      );

      return {
        activity: parsed.activity,
        durationMinutes: parsed.durationMinutes,
        caloriesBurned: Math.round(caloriesBurned),
      };
    }

    // Fallback: use LLM to parse
    return this.llmEstimateBurn(description, profile);
  }

  private parseActivityFromMessage(
    message: string,
  ): { activity: string; met: number; durationMinutes: number } | null {
    const lower = message.toLowerCase();

    // Find matching activity
    let matchedActivity: string | null = null;
    let met = 5; // default MET

    for (const [keyword, metValue] of Object.entries(MET_VALUES)) {
      if (lower.includes(keyword)) {
        matchedActivity = keyword;
        met = metValue;
        break;
      }
    }

    if (!matchedActivity) return null;

    // Extract duration
    const durationMatch = message.match(/(\d+)\s*(min|minutos?|minutes?|hrs?|horas?|hours?)/i);
    let durationMinutes = 30; // default

    if (durationMatch) {
      const value = parseInt(durationMatch[1], 10);
      const unit = durationMatch[2].toLowerCase();

      if (unit.startsWith('h')) {
        durationMinutes = value * 60;
      } else {
        durationMinutes = value;
      }
    }

    return { activity: matchedActivity, met, durationMinutes };
  }

  private calculateCaloriesBurned(met: number, weightKg: number, durationMinutes: number): number {
    // Formula: calories = MET × weight(kg) × duration(hours)
    return met * weightKg * (durationMinutes / 60);
  }

  private async llmEstimateBurn(description: string, profile?: Profile): Promise<ActivityBurnResult> {
    const weight = profile?.weight || 70;

    const prompt = `Extract activity information from this message. Return ONLY valid JSON.

Message: "${description}"

Response format:
{
  "activity": "activity name",
  "durationMinutes": 30,
  "met": 5
}

Common MET values: walking 3.5, running 8, cycling 7, swimming 7, weights 5.5, yoga 3`;

    try {
      const response = await this.claudeClient.generateResponse(prompt, {
        systemPrompt: this.getSystemPrompt(),
        maxTokens: 100,
        temperature: 0,
      });

      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const caloriesBurned = this.calculateCaloriesBurned(
        parsed.met || 5,
        weight,
        parsed.durationMinutes || 30,
      );

      return {
        activity: parsed.activity || 'ejercicio',
        durationMinutes: parsed.durationMinutes || 30,
        caloriesBurned: Math.round(caloriesBurned),
      };
    } catch (error) {
      this.logger.error(`LLM burn estimation failed: ${error}`);
      // Ultimate fallback
      const caloriesBurned = this.calculateCaloriesBurned(5, weight, 30);
      return {
        activity: 'ejercicio general',
        durationMinutes: 30,
        caloriesBurned: Math.round(caloriesBurned),
      };
    }
  }
}
