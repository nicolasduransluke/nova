import { Injectable } from '@nestjs/common';
import type { AgentOutput, NutritionData, Profile } from '@nova/types';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import { BaseAgent, AgentInput } from './base-agent.abstract';

export interface NutritionInput extends AgentInput {
  extractedData?: NutritionData;
}

interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

@Injectable()
export class NutritionAgentService extends BaseAgent {
  constructor(claudeClient: ClaudeClientService) {
    super('nutrition', claudeClient);
  }

  async process(input: NutritionInput): Promise<AgentOutput> {
    if (!this.validateInput(input)) {
      return this.createOutput({
        insights: ['No se detectaron datos de alimentación'],
        confidence: 0.3,
      });
    }

    try {
      const nutritionData = input.extractedData as NutritionData;
      const profile = input.context.profile;

      // Calculate macro targets based on profile
      const targets = this.calculateMacroTargets(profile);

      // Analyze current intake vs targets
      const analysis = this.analyzeNutrition(nutritionData, targets);

      // Use Claude for deeper analysis
      const prompt = this.buildNutritionPrompt(input, analysis, targets);
      const llmResponse = await this.claudeClient.generateResponse(prompt, {
        systemPrompt: this.getSystemPrompt(),
      });

      // Parse LLM response for additional insights
      const llmInsights = this.parseInsights(llmResponse);

      // Combine analysis with LLM insights
      const insights = [
        ...analysis.insights,
        ...llmInsights.slice(0, 2),
      ].slice(0, 5);

      const recommendations = this.generateRecommendations(analysis, targets);

      return this.createOutput({
        insights,
        recommendations,
        dataPoints: {
          calories: nutritionData.totalCalories || 0,
          protein: nutritionData.totalProtein || 0,
          carbs: nutritionData.totalCarbs || 0,
          fat: nutritionData.totalFat || 0,
          targetCalories: targets.calories,
          targetProtein: targets.protein,
          calorieAdherence: analysis.calorieAdherence,
          proteinAdherence: analysis.proteinAdherence,
          mealsCount: nutritionData.meals?.length || 0,
        },
        confidence: this.calculateNutritionConfidence(nutritionData, input.context),
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
    return `You are NOVA's Nutrition Specialist Agent. Your role is to:
- Analyze meals and nutritional intake
- Calculate and compare macronutrients (protein, carbs, fat)
- Assess meal timing and distribution
- Provide actionable nutrition advice

Guidelines:
- Be encouraging but honest about adherence
- Focus on protein intake as priority for most goals
- Consider meal timing relative to workouts
- Suggest specific, actionable adjustments
- Keep responses concise and in Spanish

Output format: Provide 2-3 key observations about the meal/nutrition.`;
  }

  protected validateInput(input: AgentInput): boolean {
    const data = input.extractedData as NutritionData;
    return !!(
      data &&
      (data.meals?.length || data.totalCalories || data.totalProtein)
    );
  }

  private calculateMacroTargets(profile?: Profile): MacroTargets {
    if (!profile) {
      // Default targets for average adult
      return {
        calories: 2000,
        protein: 120,
        carbs: 200,
        fat: 65,
      };
    }

    // Calculate BMR using Mifflin-St Jeor
    let bmr: number;
    if (profile.sex === 'male') {
      bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
    } else {
      bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
    }

    // Apply activity multiplier (assume moderate activity)
    const tdee = bmr * 1.55;

    // Adjust based on objective
    let targetCalories: number;
    let proteinMultiplier: number;

    switch (profile.objective) {
      case 'weight_loss':
        targetCalories = tdee - 500; // 500 cal deficit
        proteinMultiplier = 2.2; // Higher protein for muscle preservation
        break;
      case 'muscle_gain':
        targetCalories = tdee + 300; // 300 cal surplus
        proteinMultiplier = 2.0;
        break;
      default:
        targetCalories = tdee;
        proteinMultiplier = 1.8;
    }

    const targetProtein = profile.weight * proteinMultiplier;
    const proteinCalories = targetProtein * 4;
    const fatCalories = targetCalories * 0.25;
    const carbCalories = targetCalories - proteinCalories - fatCalories;

    return {
      calories: Math.round(targetCalories),
      protein: Math.round(targetProtein),
      carbs: Math.round(carbCalories / 4),
      fat: Math.round(fatCalories / 9),
    };
  }

  private analyzeNutrition(
    data: NutritionData,
    targets: MacroTargets,
  ): {
    insights: string[];
    calorieAdherence: number;
    proteinAdherence: number;
    carbAdherence: number;
    fatAdherence: number;
  } {
    const insights: string[] = [];

    const totalCalories = data.totalCalories || 0;
    const totalProtein = data.totalProtein || 0;
    const totalCarbs = data.totalCarbs || 0;
    const totalFat = data.totalFat || 0;

    // Calculate adherence percentages
    const calorieAdherence = targets.calories > 0
      ? Math.min(totalCalories / targets.calories, 1.5)
      : 0;
    const proteinAdherence = targets.protein > 0
      ? Math.min(totalProtein / targets.protein, 1.5)
      : 0;
    const carbAdherence = targets.carbs > 0
      ? Math.min(totalCarbs / targets.carbs, 1.5)
      : 0;
    const fatAdherence = targets.fat > 0
      ? Math.min(totalFat / targets.fat, 1.5)
      : 0;

    // Generate insights based on analysis
    if (totalCalories > 0) {
      const calorieDiff = totalCalories - targets.calories;
      if (Math.abs(calorieDiff) <= 100) {
        insights.push(`Calorías en target: ${totalCalories}/${targets.calories} kcal`);
      } else if (calorieDiff > 0) {
        insights.push(`Calorías sobre el objetivo: +${calorieDiff} kcal`);
      } else {
        insights.push(`Calorías bajo el objetivo: ${calorieDiff} kcal`);
      }
    }

    if (totalProtein > 0) {
      const proteinDiff = totalProtein - targets.protein;
      if (Math.abs(proteinDiff) <= 10) {
        insights.push(`Proteína en target: ${totalProtein}g/${targets.protein}g`);
      } else if (proteinDiff > 0) {
        insights.push(`Proteína arriba del objetivo: +${proteinDiff}g`);
      } else {
        insights.push(`Proteína bajo el objetivo: ${proteinDiff}g - priorizar en próxima comida`);
      }
    }

    // Meal distribution insight
    if (data.meals && data.meals.length > 0) {
      if (data.meals.length >= 3) {
        insights.push(`Buena distribución en ${data.meals.length} comidas`);
      } else if (data.meals.length === 1) {
        insights.push('Considera dividir la ingesta en más comidas');
      }
    }

    return {
      insights,
      calorieAdherence,
      proteinAdherence,
      carbAdherence,
      fatAdherence,
    };
  }

  private buildNutritionPrompt(
    input: NutritionInput,
    analysis: { insights: string[]; calorieAdherence: number; proteinAdherence: number },
    targets: MacroTargets,
  ): string {
    const data = input.extractedData as NutritionData;

    return `Analiza esta información nutricional:

## Datos del Usuario
- Objetivo: ${input.context.profile?.objective || 'no especificado'}
- Peso: ${input.context.profile?.weight || 'no especificado'}kg

## Ingesta Actual
- Calorías: ${data.totalCalories || 0} / ${targets.calories} kcal
- Proteína: ${data.totalProtein || 0}g / ${targets.protein}g
- Carbohidratos: ${data.totalCarbs || 0}g / ${targets.carbs}g
- Grasa: ${data.totalFat || 0}g / ${targets.fat}g

## Comidas
${data.meals?.map(m => `- ${m.name}: ${m.calories || '?'} kcal, ${m.protein || '?'}g proteína`).join('\n') || 'No detalladas'}

## Mensaje Original
${input.message}

Proporciona 2-3 observaciones clave sobre esta ingesta nutricional.`;
  }

  private generateRecommendations(
    analysis: { calorieAdherence: number; proteinAdherence: number },
    targets: MacroTargets,
  ): string[] {
    const recommendations: string[] = [];

    // Protein priority
    if (analysis.proteinAdherence < 0.8) {
      const deficit = Math.round(targets.protein * (1 - analysis.proteinAdherence));
      recommendations.push(`Añadir ${deficit}g de proteína en próxima comida (ej: huevos, pollo, pescado)`);
    }

    // Calorie balance
    if (analysis.calorieAdherence > 1.2) {
      recommendations.push('Próxima comida más ligera o aumentar actividad física');
    } else if (analysis.calorieAdherence < 0.6) {
      recommendations.push('Consumo muy bajo - asegurar ingesta suficiente para energía');
    }

    // General healthy eating
    if (recommendations.length === 0) {
      recommendations.push('Mantén esta consistencia en las próximas comidas');
    }

    return recommendations.slice(0, 3);
  }

  private calculateNutritionConfidence(
    data: NutritionData,
    context: AgentInput['context'],
  ): number {
    let confidence = 0.5;

    // More meal data = higher confidence
    if (data.meals && data.meals.length > 0) {
      confidence += 0.1 * Math.min(data.meals.length, 3);
    }

    // Macro data increases confidence
    if (data.totalCalories) confidence += 0.1;
    if (data.totalProtein) confidence += 0.1;

    // Profile data helps with targets
    if (context.profile) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }
}
