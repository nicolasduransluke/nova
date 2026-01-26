import { Injectable } from '@nestjs/common';
import type { AgentOutput, TrainingData, DailyEntry, Profile } from '@nova/types';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import { BaseAgent, AgentInput } from './base-agent.abstract';

export interface TrainingInput extends AgentInput {
  extractedData?: TrainingData;
}

interface WorkoutAnalysis {
  strain: number; // 0-21 scale (like WHOOP)
  volumeScore: number; // 0-100
  recoveryNeeded: number; // hours
  workoutType: string;
}

@Injectable()
export class TrainingAgentService extends BaseAgent {
  constructor(claudeClient: ClaudeClientService) {
    super('training', claudeClient);
  }

  async process(input: TrainingInput): Promise<AgentOutput> {
    if (!this.validateInput(input)) {
      return this.createOutput({
        insights: ['No se detectaron datos de entrenamiento'],
        confidence: 0.3,
      });
    }

    try {
      const trainingData = input.extractedData as TrainingData;
      const recentWorkouts = this.getRecentWorkouts(input.context.recentEntries);

      // Analyze workout
      const analysis = this.analyzeWorkout(trainingData, recentWorkouts);

      // Use Claude for deeper analysis
      const prompt = this.buildTrainingPrompt(input, analysis);
      const llmResponse = await this.claudeClient.generateResponse(prompt, {
        systemPrompt: this.getSystemPrompt(),
      });

      const llmInsights = this.parseInsights(llmResponse);
      const insights = this.generateInsights(trainingData, analysis, llmInsights);
      const recommendations = this.generateRecommendations(analysis, recentWorkouts);

      return this.createOutput({
        insights,
        recommendations,
        dataPoints: {
          duration: trainingData.duration || 0,
          type: trainingData.type || 'mixed',
          strain: analysis.strain,
          volumeScore: analysis.volumeScore,
          caloriesBurned: trainingData.caloriesBurned || this.estimateCalories(trainingData),
          exerciseCount: trainingData.exercises?.length || 0,
          intensity: trainingData.intensity || 'moderate',
          recoveryHours: analysis.recoveryNeeded,
        },
        confidence: this.calculateTrainingConfidence(trainingData, input.context),
      });
    } catch (error) {
      this.logger.error(`Training analysis error: ${error}`);
      return this.createOutput({
        insights: ['Error al analizar el entrenamiento'],
        confidence: 0.2,
      });
    }
  }

  protected getSystemPrompt(): string {
    return `You are NOVA's Training Specialist Agent. Your role is to:
- Analyze workout data (duration, exercises, intensity)
- Calculate training strain and load
- Assess recovery needs based on workout type
- Compare to weekly training goals

Guidelines:
- Consider workout type (strength vs cardio vs mixed)
- Factor in intensity and duration
- Account for cumulative weekly load
- Suggest appropriate recovery
- Keep responses concise and in Spanish

Output format: Provide 2-3 key observations about the workout.`;
  }

  protected validateInput(input: AgentInput): boolean {
    const data = input.extractedData as TrainingData;
    return !!(
      data &&
      (data.duration || data.exercises?.length || data.type)
    );
  }

  private getRecentWorkouts(entries: DailyEntry[]): DailyEntry[] {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return entries.filter(
      (entry) =>
        entry.type === 'exercise' &&
        new Date(entry.date) >= sevenDaysAgo,
    );
  }

  private analyzeWorkout(
    data: TrainingData,
    recentWorkouts: DailyEntry[],
  ): WorkoutAnalysis {
    // Calculate strain (0-21 scale similar to WHOOP)
    let strain = 0;

    // Duration contribution (0-7)
    const durationMinutes = data.duration || 0;
    strain += Math.min(durationMinutes / 15, 7);

    // Intensity contribution (0-7)
    const intensityMap: Record<string, number> = {
      low: 2,
      moderate: 4,
      high: 6,
      very_high: 7,
    };
    strain += intensityMap[data.intensity || 'moderate'] || 4;

    // Exercise volume contribution (0-7)
    if (data.exercises && data.exercises.length > 0) {
      const totalSets = data.exercises.reduce((sum, ex) => sum + (ex.sets || 1), 0);
      strain += Math.min(totalSets / 3, 7);
    } else {
      strain += 3; // Default for unstructured workouts
    }

    // Calculate volume score (0-100)
    let volumeScore = 0;
    if (data.exercises) {
      const totalVolume = data.exercises.reduce((sum, ex) => {
        const sets = ex.sets || 1;
        const reps = ex.reps || 10;
        const weight = ex.weight || 0;
        return sum + (sets * reps * (weight || 1));
      }, 0);
      volumeScore = Math.min(totalVolume / 100, 100);
    } else {
      volumeScore = durationMinutes * (intensityMap[data.intensity || 'moderate'] || 4) / 4;
    }

    // Calculate recovery needed (hours)
    let recoveryNeeded = 24;
    if (data.type === 'strength' || strain > 15) {
      recoveryNeeded = 48;
    } else if (strain > 10) {
      recoveryNeeded = 36;
    } else if (strain < 8) {
      recoveryNeeded = 12;
    }

    // Adjust for weekly load
    if (recentWorkouts.length >= 5) {
      recoveryNeeded += 12; // More recovery if training frequently
    }

    return {
      strain: Math.round(strain * 10) / 10,
      volumeScore: Math.round(volumeScore),
      recoveryNeeded,
      workoutType: this.categorizeWorkout(data),
    };
  }

  private categorizeWorkout(data: TrainingData): string {
    if (data.type) return data.type;

    if (data.exercises && data.exercises.length > 0) {
      const hasWeights = data.exercises.some((ex) => ex.weight && ex.weight > 0);
      const hasCardio = data.exercises.some((ex) =>
        ex.name?.toLowerCase().includes('run') ||
        ex.name?.toLowerCase().includes('bike') ||
        ex.name?.toLowerCase().includes('cardio'),
      );

      if (hasWeights && hasCardio) return 'mixed';
      if (hasWeights) return 'strength';
      if (hasCardio) return 'cardio';
    }

    return 'mixed';
  }

  private estimateCalories(data: TrainingData): number {
    const duration = data.duration || 30;
    const intensityMultiplier: Record<string, number> = {
      low: 4,
      moderate: 6,
      high: 8,
      very_high: 10,
    };

    const multiplier = intensityMultiplier[data.intensity || 'moderate'] || 6;
    return Math.round(duration * multiplier);
  }

  private generateInsights(
    data: TrainingData,
    analysis: WorkoutAnalysis,
    llmInsights: string[],
  ): string[] {
    const insights: string[] = [];

    // Workout type and completion
    const typeNames: Record<string, string> = {
      strength: 'Entrenamiento de fuerza',
      cardio: 'Sesión de cardio',
      flexibility: 'Sesión de flexibilidad',
      sports: 'Práctica deportiva',
      mixed: 'Entrenamiento mixto',
    };
    insights.push(`${typeNames[data.type || 'mixed'] || 'Entrenamiento'} completado`);

    // Duration and strain
    if (data.duration) {
      insights.push(`Duración: ${data.duration} min | Strain: ${analysis.strain}/21`);
    }

    // Volume assessment
    if (data.exercises && data.exercises.length > 0) {
      const totalSets = data.exercises.reduce((sum, ex) => sum + (ex.sets || 1), 0);
      if (totalSets >= 15 && totalSets <= 25) {
        insights.push(`Volumen óptimo: ${totalSets} series totales`);
      } else if (totalSets > 25) {
        insights.push(`Volumen alto: ${totalSets} series - monitorear recuperación`);
      } else {
        insights.push(`Volumen: ${totalSets} series`);
      }
    }

    // Add LLM insights
    insights.push(...llmInsights.slice(0, 2));

    return insights.slice(0, 5);
  }

  private generateRecommendations(
    analysis: WorkoutAnalysis,
    recentWorkouts: DailyEntry[],
  ): string[] {
    const recommendations: string[] = [];

    // Recovery recommendation
    if (analysis.recoveryNeeded >= 48) {
      recommendations.push(`Necesitas ${analysis.recoveryNeeded}h de recuperación - mañana descanso o cardio ligero`);
    } else if (analysis.recoveryNeeded >= 36) {
      recommendations.push('Mañana: sesión de baja intensidad o activo recovery');
    } else {
      recommendations.push('Buena recuperación esperada - puedes entrenar mañana');
    }

    // Weekly load assessment
    if (recentWorkouts.length >= 5) {
      recommendations.push('5+ entrenamientos esta semana - considera un día de descanso');
    } else if (recentWorkouts.length <= 1) {
      recommendations.push('Intenta mantener 3-4 sesiones semanales para progreso óptimo');
    }

    // Nutrition timing
    if (analysis.strain > 12) {
      recommendations.push('Post-entreno: 25-30g proteína dentro de 2 horas');
    }

    return recommendations.slice(0, 3);
  }

  private calculateTrainingConfidence(
    data: TrainingData,
    context: AgentInput['context'],
  ): number {
    let confidence = 0.5;

    // More workout data = higher confidence
    if (data.duration) confidence += 0.1;
    if (data.type) confidence += 0.1;
    if (data.intensity) confidence += 0.1;
    if (data.exercises && data.exercises.length > 0) {
      confidence += 0.1 * Math.min(data.exercises.length / 3, 0.2);
    }

    // Profile helps contextualize
    if (context.profile) confidence += 0.1;

    // History helps assess patterns
    const exerciseEntries = context.recentEntries.filter(e => e.type === 'exercise');
    if (exerciseEntries.length >= 3) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  private buildTrainingPrompt(input: TrainingInput, analysis: WorkoutAnalysis): string {
    const data = input.extractedData as TrainingData;

    return `Analiza este entrenamiento:

## Datos del Usuario
- Objetivo: ${input.context.profile?.objective || 'no especificado'}

## Entrenamiento
- Tipo: ${data.type || 'no especificado'}
- Duración: ${data.duration || 'no especificada'} minutos
- Intensidad: ${data.intensity || 'no especificada'}
- Strain calculado: ${analysis.strain}/21

## Ejercicios
${data.exercises?.map(ex => `- ${ex.name}: ${ex.sets || '?'}x${ex.reps || '?'} @ ${ex.weight || '?'}kg`).join('\n') || 'No detallados'}

## Mensaje Original
${input.message}

Proporciona 2-3 observaciones clave sobre este entrenamiento.`;
  }
}
