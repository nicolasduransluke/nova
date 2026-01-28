import { Injectable } from '@nestjs/common';
import type { AgentOutput, Profile, CalorieEntryItem } from '@nova/types';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import { BaseAgent, AgentInput } from './base-agent.abstract';

export interface CalorieIntakeResult {
  items: CalorieEntryItem[];
  totalCalories: number;
}

@Injectable()
export class NutritionAgentService extends BaseAgent {
  constructor(claudeClient: ClaudeClientService) {
    super('nutrition', claudeClient);
  }

  async process(input: AgentInput): Promise<AgentOutput> {
    if (!this.validateInput(input)) {
      return this.createOutput({
        insights: ['No se detectaron datos de alimentación'],
        confidence: 0.3,
      });
    }

    try {
      const profile = input.context.profile;
      const tdee = this.calculateTDEE(profile);

      // Use LLM to estimate calories for the described meal
      const estimate = await this.estimateCalories(input.message);

      const insights: string[] = [];
      const recommendations: string[] = [];

      if (estimate.items.length > 0) {
        const itemsSummary = estimate.items
          .map((item) => `${item.name}: ~${item.calories} kcal`)
          .join(', ');
        insights.push(`Estimado: ${itemsSummary}`);
        insights.push(`Total estimado: ${estimate.totalCalories} kcal`);
      }

      if (tdee > 0) {
        const targetIntake = tdee - 500; // 500 cal deficit target
        insights.push(`Tu meta diaria de ingesta es ~${Math.round(targetIntake)} kcal (TDEE: ${Math.round(tdee)})`);
      }

      return this.createOutput({
        insights,
        recommendations,
        dataPoints: {
          items: estimate.items,
          totalCalories: estimate.totalCalories,
          tdee,
        },
        confidence: estimate.items.length > 0 ? 0.7 : 0.4,
      });
    } catch (error) {
      this.logger.error(`Nutrition analysis error: ${error}`);
      return this.createOutput({
        insights: ['Error al analizar los datos nutricionales'],
        confidence: 0.2,
      });
    }
  }

  protected getSystemPrompt(): string {
    return `You are a calorie estimation specialist. Your job is to estimate calories for meals described by users.

Guidelines:
- Estimate calories conservatively (slightly overestimate rather than underestimate)
- Use Latin American portion sizes as default
- Break down meals into individual items with calorie estimates
- Always respond with valid JSON
- Keep estimates realistic and practical`;
  }

  protected validateInput(input: AgentInput): boolean {
    return input.message.length > 2;
  }

  calculateTDEE(profile?: Profile): number {
    if (!profile) return 2000;

    // Mifflin-St Jeor formula
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

  async estimateCalories(description: string): Promise<CalorieIntakeResult> {
    const prompt = `Estimate calories for this meal description. Return ONLY valid JSON.

Meal description: "${description}"

Response format:
{
  "items": [{"name": "item name", "calories": 123}],
  "totalCalories": 456
}

Rules:
- Use Latin American portion sizes
- Be conservative (slightly overestimate)
- Include all items mentioned
- If unsure, estimate based on typical serving`;

    try {
      const response = await this.claudeClient.generateResponse(prompt, {
        systemPrompt: this.getSystemPrompt(),
        maxTokens: 300,
        temperature: 0.3,
      });

      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        items: parsed.items || [],
        totalCalories: parsed.totalCalories || 0,
      };
    } catch (error) {
      this.logger.error(`Calorie estimation failed: ${error}`);
      // Fallback: rough estimate from keywords
      return this.fallbackEstimate(description);
    }
  }

  private fallbackEstimate(description: string): CalorieIntakeResult {
    const lower = description.toLowerCase();
    const items: CalorieEntryItem[] = [];

    const foodCalories: Record<string, number> = {
      pollo: 250, chicken: 250,
      arroz: 200, rice: 200,
      ensalada: 80, salad: 80,
      huevos: 150, eggs: 150,
      pan: 120, bread: 120,
      pasta: 350, fideos: 350,
      torta: 400, cake: 400,
      pizza: 300,
      pescado: 200, fish: 200,
      carne: 300, beef: 300, meat: 300,
      frijoles: 150, beans: 150,
      tortilla: 100,
      sandwich: 350,
      sopa: 150, soup: 150,
      fruta: 80, fruit: 80,
      yogurt: 120,
      cereal: 200,
    };

    for (const [food, cal] of Object.entries(foodCalories)) {
      if (lower.includes(food)) {
        items.push({ name: food, calories: cal });
      }
    }

    const totalCalories = items.reduce((sum, item) => sum + item.calories, 0) || 400;

    if (items.length === 0) {
      items.push({ name: 'comida estimada', calories: 400 });
    }

    return { items, totalCalories };
  }
}
