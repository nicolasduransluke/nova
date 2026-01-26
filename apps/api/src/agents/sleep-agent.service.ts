import { Injectable } from '@nestjs/common';
import type { AgentOutput, SleepData, DailyEntry } from '@nova/types';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import { BaseAgent, AgentInput } from './base-agent.abstract';

export interface SleepInput extends AgentInput {
  extractedData?: SleepData;
}

interface SleepAnalysis {
  durationScore: number; // 0-100
  qualityScore: number; // 0-100
  timingScore: number; // 0-100
  overallScore: number; // 0-100
  isOptimal: boolean;
  deficit: number; // hours below optimal
}

@Injectable()
export class SleepAgentService extends BaseAgent {
  private readonly OPTIMAL_SLEEP_MIN = 7;
  private readonly OPTIMAL_SLEEP_MAX = 9;
  private readonly OPTIMAL_BEDTIME = 23; // 11 PM

  constructor(claudeClient: ClaudeClientService) {
    super('sleep', claudeClient);
  }

  async process(input: SleepInput): Promise<AgentOutput> {
    if (!this.validateInput(input)) {
      return this.createOutput({
        insights: ['No se detectaron datos de sueño'],
        confidence: 0.3,
      });
    }

    try {
      const sleepData = input.extractedData as SleepData;
      const recentSleep = this.getRecentSleep(input.context.recentEntries);

      // Analyze sleep
      const analysis = this.analyzeSleep(sleepData, recentSleep);

      // Use Claude for deeper analysis
      const prompt = this.buildSleepPrompt(input, analysis, recentSleep);
      const llmResponse = await this.claudeClient.generateResponse(prompt, {
        systemPrompt: this.getSystemPrompt(),
      });

      const llmInsights = this.parseInsights(llmResponse);
      const insights = this.generateInsights(sleepData, analysis, llmInsights);
      const recommendations = this.generateRecommendations(analysis, sleepData);

      return this.createOutput({
        insights,
        recommendations,
        dataPoints: {
          duration: sleepData.duration || 0,
          quality: sleepData.quality || 3,
          bedtime: sleepData.bedtime || 'unknown',
          wakeTime: sleepData.wakeTime || 'unknown',
          interruptions: sleepData.interruptions || 0,
          durationScore: analysis.durationScore,
          qualityScore: analysis.qualityScore,
          timingScore: analysis.timingScore,
          overallScore: analysis.overallScore,
          deficit: analysis.deficit,
          weeklyAverage: this.calculateWeeklyAverage(recentSleep),
        },
        confidence: this.calculateSleepConfidence(sleepData, input.context),
      });
    } catch (error) {
      this.logger.error(`Sleep analysis error: ${error}`);
      return this.createOutput({
        insights: ['Error al analizar los datos de sueño'],
        confidence: 0.2,
      });
    }
  }

  protected getSystemPrompt(): string {
    return `You are NOVA's Sleep Specialist Agent. Your role is to:
- Analyze sleep duration, quality, and timing
- Compare to optimal sleep (7-9 hours)
- Assess impact on recovery and energy
- Identify patterns and provide recommendations

Guidelines:
- Optimal sleep is 7-9 hours for adults
- Bedtime before 11 PM is generally better
- Consistency matters more than occasional long sleep
- Consider weekly patterns, not just single nights
- Keep responses concise and in Spanish

Output format: Provide 2-3 key observations about sleep quality.`;
  }

  protected validateInput(input: AgentInput): boolean {
    const data = input.extractedData as SleepData;
    return !!(
      data &&
      (data.duration || data.bedtime || data.wakeTime || data.quality)
    );
  }

  private getRecentSleep(entries: DailyEntry[]): DailyEntry[] {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return entries.filter(
      (entry) =>
        entry.type === 'sleep' &&
        new Date(entry.date) >= sevenDaysAgo,
    );
  }

  private analyzeSleep(
    data: SleepData,
    recentSleep: DailyEntry[],
  ): SleepAnalysis {
    const duration = data.duration || 0;
    const quality = data.quality || 3;

    // Duration score (0-100)
    let durationScore = 0;
    if (duration >= this.OPTIMAL_SLEEP_MIN && duration <= this.OPTIMAL_SLEEP_MAX) {
      durationScore = 100;
    } else if (duration < this.OPTIMAL_SLEEP_MIN) {
      durationScore = Math.max(0, (duration / this.OPTIMAL_SLEEP_MIN) * 100);
    } else {
      // Oversleeping
      durationScore = Math.max(50, 100 - ((duration - this.OPTIMAL_SLEEP_MAX) * 10));
    }

    // Quality score (0-100)
    const qualityScore = (quality / 5) * 100;

    // Timing score (0-100)
    let timingScore = 100;
    if (data.bedtime) {
      const bedtimeHour = this.parseTimeToHour(data.bedtime);
      if (bedtimeHour !== null) {
        // Convert to 24h where midnight = 24, 1am = 25, etc for comparison
        const adjustedHour = bedtimeHour < 12 ? bedtimeHour + 24 : bedtimeHour;
        const targetHour = this.OPTIMAL_BEDTIME;

        const hoursDiff = Math.abs(adjustedHour - targetHour);
        timingScore = Math.max(0, 100 - (hoursDiff * 15));
      }
    }

    // Overall score (weighted average)
    const overallScore = Math.round(
      (durationScore * 0.4) + (qualityScore * 0.35) + (timingScore * 0.25),
    );

    // Calculate deficit
    const deficit = duration < this.OPTIMAL_SLEEP_MIN
      ? this.OPTIMAL_SLEEP_MIN - duration
      : 0;

    // Check if optimal
    const isOptimal = duration >= this.OPTIMAL_SLEEP_MIN &&
      duration <= this.OPTIMAL_SLEEP_MAX &&
      quality >= 4;

    return {
      durationScore: Math.round(durationScore),
      qualityScore: Math.round(qualityScore),
      timingScore: Math.round(timingScore),
      overallScore,
      isOptimal,
      deficit,
    };
  }

  private parseTimeToHour(timeStr: string): number | null {
    // Handle formats like "23:00", "11:30 PM", "1:30am", etc.
    const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (!match) return null;

    let hour = parseInt(match[1], 10);
    const meridiem = match[3]?.toLowerCase();

    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;

    return hour;
  }

  private calculateWeeklyAverage(recentSleep: DailyEntry[]): number {
    if (recentSleep.length === 0) return 0;

    const totalHours = recentSleep.reduce((sum, entry) => {
      const sleepData = entry.data as SleepData;
      return sum + (sleepData.duration || 0);
    }, 0);

    return Math.round((totalHours / recentSleep.length) * 10) / 10;
  }

  private generateInsights(
    data: SleepData,
    analysis: SleepAnalysis,
    llmInsights: string[],
  ): string[] {
    const insights: string[] = [];

    // Duration insight
    if (data.duration) {
      if (analysis.isOptimal) {
        insights.push(`Excelente: ${data.duration}h de sueño (rango óptimo 7-9h)`);
      } else if (data.duration < this.OPTIMAL_SLEEP_MIN) {
        insights.push(`Dormiste ${data.duration}h (por debajo del óptimo de 7h)`);
      } else if (data.duration > this.OPTIMAL_SLEEP_MAX) {
        insights.push(`Dormiste ${data.duration}h (arriba del rango óptimo)`);
      }
    }

    // Timing insight
    if (data.bedtime) {
      const bedtimeHour = this.parseTimeToHour(data.bedtime);
      if (bedtimeHour !== null) {
        const adjustedHour = bedtimeHour < 12 ? bedtimeHour + 24 : bedtimeHour;
        if (adjustedHour >= 24) { // After midnight
          insights.push(`Te acostaste tarde: ${data.bedtime}`);
        } else if (adjustedHour < 22) {
          insights.push(`Buena hora de dormir: ${data.bedtime}`);
        }
      }
    }

    // Quality insight
    if (data.quality) {
      const qualityLabels: Record<number, string> = {
        1: 'muy mala',
        2: 'mala',
        3: 'regular',
        4: 'buena',
        5: 'excelente',
      };
      insights.push(`Calidad del sueño: ${qualityLabels[data.quality] || 'regular'}`);
    }

    // Add LLM insights
    insights.push(...llmInsights.slice(0, 2));

    return insights.slice(0, 5);
  }

  private generateRecommendations(
    analysis: SleepAnalysis,
    data: SleepData,
  ): string[] {
    const recommendations: string[] = [];

    // Duration recommendations
    if (analysis.deficit > 0) {
      recommendations.push(
        `Hoy: evitar déficit calórico agresivo por falta de sueño (${analysis.deficit}h menos)`,
      );
      recommendations.push(
        `Esta noche: target ${this.OPTIMAL_SLEEP_MIN + 0.5}h para compensar`,
      );
    }

    // Quality recommendations
    if (data.quality && data.quality <= 2) {
      recommendations.push(
        'Considera: evitar pantallas 1h antes de dormir, temperatura fresca en habitación',
      );
    }

    // Timing recommendations
    if (analysis.timingScore < 50) {
      recommendations.push(
        `Intenta acostarte antes de las 11pm - el sueño pre-medianoche es más reparador`,
      );
    }

    // Recovery impact
    if (!analysis.isOptimal) {
      recommendations.push(
        'Prioriza el sueño hoy - afecta recuperación y toma de decisiones',
      );
    }

    // Positive reinforcement
    if (analysis.overallScore >= 80) {
      recommendations.push('Mantén esta rutina de sueño - excelente para tu recuperación');
    }

    return recommendations.slice(0, 3);
  }

  private calculateSleepConfidence(
    data: SleepData,
    context: AgentInput['context'],
  ): number {
    let confidence = 0.5;

    // More sleep data = higher confidence
    if (data.duration) confidence += 0.15;
    if (data.quality) confidence += 0.1;
    if (data.bedtime) confidence += 0.1;
    if (data.wakeTime) confidence += 0.05;

    // Profile helps contextualize
    if (context.profile) confidence += 0.1;

    // History helps assess patterns
    const sleepEntries = context.recentEntries.filter(e => e.type === 'sleep');
    if (sleepEntries.length >= 3) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  private buildSleepPrompt(
    input: SleepInput,
    analysis: SleepAnalysis,
    recentSleep: DailyEntry[],
  ): string {
    const data = input.extractedData as SleepData;
    const weeklyAvg = this.calculateWeeklyAverage(recentSleep);

    return `Analiza estos datos de sueño:

## Sueño de Anoche
- Duración: ${data.duration || 'no especificada'} horas
- Calidad: ${data.quality || 'no especificada'}/5
- Hora de dormir: ${data.bedtime || 'no especificada'}
- Hora de despertar: ${data.wakeTime || 'no especificada'}
- Interrupciones: ${data.interruptions || 0}

## Análisis
- Puntuación duración: ${analysis.durationScore}/100
- Puntuación calidad: ${analysis.qualityScore}/100
- Puntuación horario: ${analysis.timingScore}/100
- Promedio semanal: ${weeklyAvg}h

## Mensaje Original
${input.message}

Proporciona 2-3 observaciones clave sobre este sueño y su impacto en la recuperación.`;
  }
}
