import { Injectable } from '@nestjs/common';
import type { AgentOutput, EnergyData, DailyEntry, SleepData, TrainingData } from '@nova/types';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import { BaseAgent, AgentInput } from './base-agent.abstract';

export interface EnergyInput extends AgentInput {
  extractedData?: EnergyData;
}

interface EnergyAnalysis {
  currentLevel: number;
  trend: 'improving' | 'stable' | 'declining';
  potentialCauses: string[];
  riskFactors: string[];
}

@Injectable()
export class EnergyAgentService extends BaseAgent {
  constructor(claudeClient: ClaudeClientService) {
    super('energy', claudeClient);
  }

  async process(input: EnergyInput): Promise<AgentOutput> {
    if (!this.validateInput(input)) {
      return this.createOutput({
        insights: ['No se detectaron datos de energía/estado de ánimo'],
        confidence: 0.3,
      });
    }

    try {
      const energyData = input.extractedData as EnergyData;
      const recentEnergy = this.getRecentEnergy(input.context.recentEntries);
      const recentContext = this.getRecentContext(input.context.recentEntries);

      // Analyze energy
      const analysis = this.analyzeEnergy(energyData, recentEnergy, recentContext);

      // Use Claude for deeper analysis including emotional state
      const prompt = this.buildEnergyPrompt(input, analysis, recentContext);
      const llmResponse = await this.claudeClient.generateResponse(prompt, {
        systemPrompt: this.getSystemPrompt(),
      });

      const llmInsights = this.parseInsights(llmResponse);
      const insights = this.generateInsights(energyData, analysis, llmInsights);
      const recommendations = this.generateRecommendations(analysis, energyData, recentContext);

      return this.createOutput({
        insights,
        recommendations,
        dataPoints: {
          level: energyData.level || 3,
          time: energyData.time || 'unknown',
          mood: energyData.mood || 'neutral',
          stressLevel: energyData.stressLevel || 3,
          trend: analysis.trend,
          weeklyAverage: this.calculateWeeklyAverage(recentEnergy),
          potentialCauses: analysis.potentialCauses,
          riskFactors: analysis.riskFactors,
        },
        confidence: this.calculateEnergyConfidence(energyData, input.context),
      });
    } catch (error) {
      this.logger.error(`Energy analysis error: ${error}`);
      return this.createOutput({
        insights: ['Error al analizar los datos de energía'],
        confidence: 0.2,
      });
    }
  }

  protected getSystemPrompt(): string {
    return `You are NOVA's Energy & Emotional State Specialist Agent. Your role is to:
- Analyze energy levels throughout the day (AM/PM)
- Detect patterns between energy, sleep, nutrition, and exercise
- Assess emotional state from user messages
- Identify potential metabolic stress signals

Guidelines:
- Low energy + caloric deficit may indicate metabolic stress
- Low AM energy often relates to poor sleep
- Low PM energy may be normal after intense training
- Consider emotional patterns and stress levels
- Be empathetic but data-driven
- Keep responses concise and in Spanish

Output format: Provide 2-3 key observations about energy/emotional state.`;
  }

  protected validateInput(input: AgentInput): boolean {
    const data = input.extractedData as EnergyData;
    // Also validate if there's emotional content in the message
    const hasEmotionalContent = this.detectEmotionalContent(input.message);
    return !!(
      data &&
      (data.level || data.mood || data.stressLevel || hasEmotionalContent)
    );
  }

  private detectEmotionalContent(message: string): boolean {
    const emotionalKeywords = [
      'cansado', 'cansada', 'energía', 'energia', 'agotado', 'agotada',
      'bien', 'mal', 'feliz', 'triste', 'estresado', 'estresada',
      'motivado', 'motivada', 'desmotivado', 'desmotivada',
      'ansioso', 'ansiosa', 'tranquilo', 'tranquila',
      'tired', 'energy', 'exhausted', 'good', 'bad', 'happy', 'sad',
      'stressed', 'motivated', 'anxious', 'calm',
    ];

    const lowerMessage = message.toLowerCase();
    return emotionalKeywords.some((keyword) => lowerMessage.includes(keyword));
  }

  private getRecentEnergy(entries: DailyEntry[]): DailyEntry[] {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return entries.filter(
      (entry) =>
        (entry.type === 'energy' || entry.type === 'mood') &&
        new Date(entry.date) >= sevenDaysAgo,
    );
  }

  private getRecentContext(entries: DailyEntry[]): {
    recentSleep: SleepData[];
    recentTraining: TrainingData[];
    recentFood: Record<string, unknown>[];
  } {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const recentEntries = entries.filter(
      (entry) => new Date(entry.date) >= threeDaysAgo,
    );

    return {
      recentSleep: recentEntries
        .filter((e) => e.type === 'sleep')
        .map((e) => e.data as SleepData),
      recentTraining: recentEntries
        .filter((e) => e.type === 'exercise')
        .map((e) => e.data as TrainingData),
      recentFood: recentEntries
        .filter((e) => e.type === 'food')
        .map((e) => e.data),
    };
  }

  private analyzeEnergy(
    data: EnergyData,
    recentEnergy: DailyEntry[],
    context: { recentSleep: SleepData[]; recentTraining: TrainingData[]; recentFood: Record<string, unknown>[] },
  ): EnergyAnalysis {
    const currentLevel = data.level || 3;
    const potentialCauses: string[] = [];
    const riskFactors: string[] = [];

    // Analyze sleep impact
    if (context.recentSleep.length > 0) {
      const avgSleep = context.recentSleep.reduce((sum, s) => sum + (s.duration || 0), 0) / context.recentSleep.length;
      if (avgSleep < 6) {
        potentialCauses.push('Sueño insuficiente (promedio < 6h)');
        riskFactors.push('sleep_deficit');
      }
    }

    // Analyze training impact
    if (context.recentTraining.length > 0) {
      const recentIntensity = context.recentTraining
        .filter((t) => t.intensity === 'high' || t.intensity === 'very_high');
      if (recentIntensity.length >= 2) {
        potentialCauses.push('Entrenamiento intenso reciente');
        if (data.time === 'afternoon' || data.time === 'evening') {
          potentialCauses.push('Fatiga post-entrenamiento (normal)');
        }
      }
    }

    // Analyze nutritional factors
    if (context.recentFood.length < 2) {
      potentialCauses.push('Pocas comidas registradas - posible déficit calórico');
      riskFactors.push('potential_undereating');
    }

    // Stress analysis
    if (data.stressLevel && data.stressLevel >= 4) {
      potentialCauses.push('Nivel de estrés elevado');
      riskFactors.push('high_stress');
    }

    // Calculate trend
    const trend = this.calculateTrend(recentEnergy, currentLevel);

    // Time-based analysis
    if (data.time === 'morning' && currentLevel <= 2) {
      potentialCauses.push('Energía baja matutina - revisar calidad de sueño');
      riskFactors.push('low_morning_energy');
    }

    if (data.time === 'afternoon' && currentLevel <= 2 && !context.recentTraining.length) {
      potentialCauses.push('Bajón de energía vespertino - revisar alimentación');
      riskFactors.push('afternoon_crash');
    }

    return {
      currentLevel,
      trend,
      potentialCauses,
      riskFactors,
    };
  }

  private calculateTrend(
    recentEnergy: DailyEntry[],
    currentLevel: number,
  ): 'improving' | 'stable' | 'declining' {
    if (recentEnergy.length < 2) return 'stable';

    const recentLevels = recentEnergy
      .slice(-5)
      .map((e) => (e.data as EnergyData).level || 3);

    const avgRecent = recentLevels.reduce((a, b) => a + b, 0) / recentLevels.length;

    if (currentLevel > avgRecent + 0.5) return 'improving';
    if (currentLevel < avgRecent - 0.5) return 'declining';
    return 'stable';
  }

  private calculateWeeklyAverage(recentEnergy: DailyEntry[]): number {
    if (recentEnergy.length === 0) return 3;

    const total = recentEnergy.reduce((sum, entry) => {
      const energyData = entry.data as EnergyData;
      return sum + (energyData.level || 3);
    }, 0);

    return Math.round((total / recentEnergy.length) * 10) / 10;
  }

  private generateInsights(
    data: EnergyData,
    analysis: EnergyAnalysis,
    llmInsights: string[],
  ): string[] {
    const insights: string[] = [];

    // Energy level insight
    const timeLabels: Record<string, string> = {
      morning: 'AM',
      afternoon: 'PM',
      evening: 'Tarde',
      night: 'Noche',
    };
    const timeLabel = timeLabels[data.time || 'morning'] || '';

    const levelLabels: Record<number, string> = {
      1: 'muy baja',
      2: 'baja',
      3: 'normal',
      4: 'buena',
      5: 'excelente',
    };
    insights.push(`Energía ${timeLabel}: ${data.level || 3}/5 (${levelLabels[data.level || 3]})`);

    // Mood insight
    if (data.mood) {
      const moodLabels: Record<string, string> = {
        great: 'excelente',
        good: 'bueno',
        neutral: 'neutral',
        low: 'bajo',
        bad: 'malo',
      };
      insights.push(`Estado de ánimo: ${moodLabels[data.mood] || data.mood}`);
    }

    // Trend insight
    const trendLabels: Record<string, string> = {
      improving: 'mejorando',
      stable: 'estable',
      declining: 'en descenso',
    };
    insights.push(`Tendencia semanal: ${trendLabels[analysis.trend]}`);

    // Potential causes (top 2)
    if (analysis.potentialCauses.length > 0) {
      insights.push(...analysis.potentialCauses.slice(0, 2));
    }

    // Add LLM insights
    insights.push(...llmInsights.slice(0, 2));

    return insights.slice(0, 5);
  }

  private generateRecommendations(
    analysis: EnergyAnalysis,
    data: EnergyData,
    context: { recentSleep: SleepData[]; recentTraining: TrainingData[]; recentFood: Record<string, unknown>[] },
  ): string[] {
    const recommendations: string[] = [];

    // Sleep-based recommendations
    if (analysis.riskFactors.includes('sleep_deficit')) {
      recommendations.push('Prioriza dormir 7+ horas esta noche');
    }

    // Low morning energy
    if (analysis.riskFactors.includes('low_morning_energy')) {
      recommendations.push('Revisa: hora de dormir, calidad del sueño, hidratación matutina');
    }

    // Afternoon crash
    if (analysis.riskFactors.includes('afternoon_crash')) {
      recommendations.push('Considera: lunch con proteína, caminata corta, siesta de 20min');
    }

    // High stress
    if (analysis.riskFactors.includes('high_stress')) {
      recommendations.push('Técnicas recomendadas: respiración profunda, caminata, limitar cafeína');
    }

    // Metabolic stress signals
    if (analysis.riskFactors.includes('potential_undereating') && analysis.currentLevel <= 2) {
      recommendations.push('Posible señal de déficit excesivo - considera aumentar calorías hoy');
    }

    // Positive reinforcement
    if (analysis.currentLevel >= 4 && analysis.riskFactors.length === 0) {
      recommendations.push('Excelente energía - mantén tus hábitos actuales');
    }

    // General recommendation based on trend
    if (analysis.trend === 'declining') {
      recommendations.push('Tendencia a la baja - revisa sueño, alimentación y carga de entrenamiento');
    }

    return recommendations.slice(0, 3);
  }

  private calculateEnergyConfidence(
    data: EnergyData,
    context: AgentInput['context'],
  ): number {
    let confidence = 0.5;

    // More data = higher confidence
    if (data.level) confidence += 0.1;
    if (data.mood) confidence += 0.1;
    if (data.stressLevel) confidence += 0.05;
    if (data.time) confidence += 0.05;

    // Profile helps contextualize
    if (context.profile) confidence += 0.1;

    // History is crucial for energy patterns
    const energyEntries = context.recentEntries.filter(
      (e) => e.type === 'energy' || e.type === 'mood',
    );
    if (energyEntries.length >= 3) confidence += 0.15;

    // Cross-data helps (sleep, exercise, food)
    const hasMultipleTypes = new Set(context.recentEntries.map((e) => e.type)).size >= 3;
    if (hasMultipleTypes) confidence += 0.1;

    return Math.min(confidence, 0.90);
  }

  private buildEnergyPrompt(
    input: EnergyInput,
    analysis: EnergyAnalysis,
    context: { recentSleep: SleepData[]; recentTraining: TrainingData[]; recentFood: Record<string, unknown>[] },
  ): string {
    const data = input.extractedData as EnergyData;

    const avgSleep = context.recentSleep.length > 0
      ? (context.recentSleep.reduce((sum, s) => sum + (s.duration || 0), 0) / context.recentSleep.length).toFixed(1)
      : 'N/A';

    return `Analiza este estado de energía y ánimo:

## Estado Actual
- Nivel de energía: ${data.level || 'no especificado'}/5
- Momento del día: ${data.time || 'no especificado'}
- Estado de ánimo: ${data.mood || 'no especificado'}
- Nivel de estrés: ${data.stressLevel || 'no especificado'}/5

## Contexto Reciente (3 días)
- Promedio sueño: ${avgSleep}h
- Entrenamientos: ${context.recentTraining.length}
- Comidas registradas: ${context.recentFood.length}

## Análisis Preliminar
- Tendencia: ${analysis.trend}
- Posibles causas: ${analysis.potentialCauses.join(', ') || 'ninguna identificada'}
- Factores de riesgo: ${analysis.riskFactors.join(', ') || 'ninguno'}

## Mensaje Original
${input.message}

Proporciona 2-3 observaciones sobre el estado de energía/ánimo y posibles correlaciones.`;
  }
}
