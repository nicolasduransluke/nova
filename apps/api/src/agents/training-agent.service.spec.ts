import { Test, TestingModule } from '@nestjs/testing';
import { TrainingAgentService } from './training-agent.service';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import type { AgentContext, TrainingData } from '@nova/types';

describe('TrainingAgentService', () => {
  let service: TrainingAgentService;
  let claudeClient: ClaudeClientService;

  const mockContext: AgentContext = {
    user: {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    profile: {
      id: 'profile-1',
      userId: 'user-1',
      weight: 80,
      height: 175,
      age: 30,
      sex: 'male',
      objective: 'muscle_gain',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    recentEntries: [],
    conversationHistory: [],
    currentDate: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrainingAgentService, ClaudeClientService],
    }).compile();

    service = module.get<TrainingAgentService>(TrainingAgentService);
    claudeClient = module.get<ClaudeClientService>(ClaudeClientService);
    claudeClient.onModuleInit();
  });

  describe('process', () => {
    it('should process workout data and return insights', async () => {
      const trainingData: TrainingData = {
        type: 'strength',
        duration: 60,
        intensity: 'high',
        exercises: [
          { name: 'Bench Press', sets: 4, reps: 10, weight: 80 },
          { name: 'Squats', sets: 4, reps: 8, weight: 100 },
        ],
      };

      const input = {
        context: mockContext,
        message: 'Entrené pecho y piernas hoy',
        extractedData: trainingData,
      };

      const output = await service.process(input);

      expect(output.agentType).toBe('training');
      expect(output.insights).toBeDefined();
      expect(output.insights.length).toBeGreaterThan(0);
      expect(output.recommendations).toBeDefined();
      expect(output.confidence).toBeGreaterThan(0);
    });

    it('should calculate strain score', async () => {
      const trainingData: TrainingData = {
        type: 'strength',
        duration: 75,
        intensity: 'high',
        exercises: [
          { name: 'Exercise 1', sets: 4, reps: 10 },
          { name: 'Exercise 2', sets: 4, reps: 10 },
          { name: 'Exercise 3', sets: 3, reps: 12 },
        ],
      };

      const input = {
        context: mockContext,
        message: 'Entrenamiento de fuerza',
        extractedData: trainingData,
      };

      const output = await service.process(input);

      expect(output.dataPoints).toHaveProperty('strain');
      expect(output.dataPoints.strain).toBeGreaterThan(0);
      expect(output.dataPoints.strain).toBeLessThanOrEqual(21);
    });

    it('should estimate calories burned', async () => {
      const trainingData: TrainingData = {
        type: 'cardio',
        duration: 45,
        intensity: 'moderate',
      };

      const input = {
        context: mockContext,
        message: 'Hice 45 minutos de cardio',
        extractedData: trainingData,
      };

      const output = await service.process(input);

      expect(output.dataPoints).toHaveProperty('caloriesBurned');
      expect(output.dataPoints.caloriesBurned).toBeGreaterThan(0);
    });

    it('should calculate recovery time based on workout intensity', async () => {
      const highIntensityWorkout: TrainingData = {
        type: 'strength',
        duration: 90,
        intensity: 'very_high',
        exercises: [
          { name: 'Deadlift', sets: 5, reps: 5, weight: 150 },
          { name: 'Squats', sets: 5, reps: 5, weight: 120 },
        ],
      };

      const input = {
        context: mockContext,
        message: 'Entrenamiento muy intenso de fuerza',
        extractedData: highIntensityWorkout,
      };

      const output = await service.process(input);

      expect(output.dataPoints).toHaveProperty('recoveryHours');
      expect(output.dataPoints.recoveryHours).toBeGreaterThanOrEqual(48);
    });

    it('should return low confidence without workout data', async () => {
      const input = {
        context: mockContext,
        message: 'No hice ejercicio hoy',
        extractedData: {},
      };

      const output = await service.process(input);

      expect(output.confidence).toBeLessThan(0.5);
    });

    it('should categorize workout type', async () => {
      const mixedWorkout: TrainingData = {
        duration: 60,
        exercises: [
          { name: 'Running', duration: 20 },
          { name: 'Bench Press', sets: 3, reps: 10, weight: 60 },
        ],
      };

      const input = {
        context: mockContext,
        message: 'Hice cardio y pesas',
        extractedData: mixedWorkout,
      };

      const output = await service.process(input);

      expect(output.dataPoints).toHaveProperty('type');
    });
  });

  describe('weekly load analysis', () => {
    it('should consider recent workouts for recovery recommendations', async () => {
      const contextWithHistory: AgentContext = {
        ...mockContext,
        recentEntries: [
          {
            id: 'entry-1',
            userId: 'user-1',
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            type: 'exercise',
            data: { type: 'strength', intensity: 'high' },
            novaPoints: 20,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'entry-2',
            userId: 'user-1',
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            type: 'exercise',
            data: { type: 'strength', intensity: 'high' },
            novaPoints: 20,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'entry-3',
            userId: 'user-1',
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            type: 'exercise',
            data: { type: 'cardio', intensity: 'moderate' },
            novaPoints: 15,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'entry-4',
            userId: 'user-1',
            date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
            type: 'exercise',
            data: { type: 'strength', intensity: 'high' },
            novaPoints: 20,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'entry-5',
            userId: 'user-1',
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            type: 'exercise',
            data: { type: 'strength', intensity: 'moderate' },
            novaPoints: 15,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const trainingData: TrainingData = {
        type: 'strength',
        duration: 60,
        intensity: 'high',
      };

      const input = {
        context: contextWithHistory,
        message: 'Otro día de entrenamiento',
        extractedData: trainingData,
      };

      const output = await service.process(input);

      // Should recommend rest due to high weekly load
      const hasRestRecommendation = output.recommendations.some(
        (rec) =>
          rec.toLowerCase().includes('descanso') ||
          rec.toLowerCase().includes('rest') ||
          rec.toLowerCase().includes('5+'),
      );
      expect(hasRestRecommendation).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle cardio workout without exercises', async () => {
      const trainingData: TrainingData = {
        type: 'cardio',
        duration: 30,
        intensity: 'low',
      };

      const input = {
        context: mockContext,
        message: 'Caminé 30 minutos',
        extractedData: trainingData,
      };

      const output = await service.process(input);

      expect(output).toBeDefined();
      expect(output.dataPoints.type).toBe('cardio');
      expect(output.dataPoints.recoveryHours).toBeLessThan(48);
    });
  });
});
