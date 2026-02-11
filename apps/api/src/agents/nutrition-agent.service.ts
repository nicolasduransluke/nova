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
    return `You are a calorie estimation specialist. Your job is to accurately estimate calories for meals described by users.

Guidelines:
- Be accurate. Do NOT inflate or overestimate calories.
- Use Latin American portion sizes as default
- Break down meals into individual items with calorie estimates
- Pay attention to serving size words: cucharadita=teaspoon(5ml), cucharada=tablespoon(15ml), taza=cup(240ml)
- Black coffee ~5 kcal, 1 tsp oil ~40 kcal, 1 tbsp oil ~120 kcal
- Always respond with valid JSON`;
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
- Be accurate. Do NOT inflate calories.
- Split combined items: "café con aceite de coco" = "café" (~5 kcal) + "aceite de coco" (~40 kcal for 1 tsp)
- Pay attention to serving sizes: "cucharadita" = teaspoon (~5ml), "cucharada" = tablespoon (~15ml)
- Black coffee is ~2-5 kcal. 1 tsp coconut oil is ~40 kcal. 1 tbsp oil is ~120 kcal.
- Include all items mentioned`;

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

    // Compound phrases (matched first due to length sorting)
    const compoundPhrases: Record<string, number> = {
      'café sin azúcar': 5, 'cafe sin azucar': 5,
      'café con leche': 70, 'cafe con leche': 70,
      'café con azúcar': 50, 'cafe con azucar': 50,
      'café negro': 5, 'cafe negro': 5,
      'té sin azúcar': 2, 'te sin azucar': 2,
      'arroz integral': 180, 'arroz blanco': 200,
      'pollo a la plancha': 200, 'pollo asado': 220, 'pollo frito': 350,
      'pescado a la plancha': 180, 'pescado frito': 300,
      'yogurt natural': 100, 'yogurt griego': 130,
      'pan integral': 100, 'papas fritas': 350,
      'hamburguesa con queso': 500, 'hamburguesa doble': 700,
      'hamburguesa sencilla': 400, 'hamburguesa simple': 400,
      'hot dog': 300, 'perro caliente': 300,
      'aceite de coco': 40, 'aceite de oliva': 40,
      'mantequilla de maní': 95, 'mantequilla de mani': 95,
      'crema de cacahuate': 95,
    };

    const baseFoods: Record<string, number> = {
      pollo: 250, chicken: 250,
      arroz: 200, rice: 200,
      ensalada: 80, salad: 80,
      huevos: 150, eggs: 150, huevo: 80,
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
      'plátano': 105, platano: 105, banana: 105,
      manzana: 95, apple: 95,
      naranja: 65, orange: 65,
      uvas: 70, grapes: 70,
      mango: 100, papaya: 60, fresa: 50, durazno: 60, pera: 60,
      leche: 120, milk: 120, queso: 110, cheese: 110,
      'café': 5, cafe: 5, coffee: 5,
      avena: 150, oatmeal: 150, granola: 200, quinoa: 180,
      hamburguesa: 450, hamburguesas: 450,
      tacos: 250, taco: 250, burrito: 400, empanada: 300,
      arepa: 200, pupusa: 250, tamales: 300, tamal: 300,
      galletas: 150, chocolate: 200, helado: 250,
      jugo: 120, licuado: 200, batido: 250,
      aguacate: 160, avocado: 160,
      'atún': 150, atun: 150, tuna: 150,
      papas: 200, papa: 130,
      camote: 120, yuca: 150,
      lentejas: 180, garbanzos: 180,
      nueces: 200, almendras: 170,
      mantequilla: 100, butter: 100,
      miel: 60, honey: 60,
      aceite: 120, oil: 120,
    };

    // Merge and sort by key length DESC (longest match first)
    const allFoods: Record<string, number> = { ...baseFoods, ...compoundPhrases };
    const sortedKeys = Object.keys(allFoods).sort((a, b) => b.length - a.length);
    const items: CalorieEntryItem[] = [];
    const consumedRanges: Array<[number, number]> = [];

    const isConsumed = (start: number, end: number): boolean =>
      consumedRanges.some(([s, e]) => start < e && end > s);

    for (const food of sortedKeys) {
      const idx = lower.indexOf(food);
      if (idx === -1) continue;
      const end = idx + food.length;
      if (isConsumed(idx, end)) continue;

      // Skip words preceded by modifiers (e.g. "azúcar" in "sin azúcar")
      const before = lower.substring(Math.max(0, idx - 5), idx).trim();
      if (before.endsWith('sin') || before.endsWith('con') || before.endsWith('la') || before.endsWith('al')) {
        continue;
      }

      // Extract quantity (e.g., "2 hamburguesas", "3 tacos")
      let quantity = 1;
      const beforeText = lower.substring(Math.max(0, idx - 4), idx);
      const qtyMatch = beforeText.match(/(\d+)\s*$/);
      if (qtyMatch) {
        quantity = parseInt(qtyMatch[1], 10);
        if (quantity > 10) quantity = 1; // sanity check
      }

      const totalCal = allFoods[food] * quantity;
      const displayName = quantity > 1 ? `${quantity} ${food}` : food;
      items.push({ name: displayName, calories: totalCal });
      consumedRanges.push([idx, end]);
    }

    const totalCalories = items.reduce((sum, item) => sum + item.calories, 0) || 400;

    if (items.length === 0) {
      items.push({ name: 'comida estimada', calories: 400 });
    }

    return { items, totalCalories };
  }
}
