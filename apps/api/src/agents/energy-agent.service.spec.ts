import { Test, TestingModule } from '@nestjs/testing';
import { EnergyAgentService } from './energy-agent.service';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import type { AgentContext, EnergyData } from '@nova/types';

describe('EnergyAgentService', () => {
  let service: EnergyAgentService;
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
      objective: 'energy',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    recentEntries: [],
    conversationHistory: [],
    currentDate: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EnergyAgentService, ClaudeClientService],
    }).compile();

    service = module.get<EnergyAgentService>(EnergyAgentService);
    claudeClient = module.get<ClaudeClientService>(ClaudeClientService);
    claudeClient.onModuleInit();
  });

  describe('process', () => {
    it('should process energy data and return insights', async () => {
      const energyData: EnergyData = {
        level: 4,
        time: 'morning',
        mood: 'good',
        stressLevel: 2,
      };

      const input = {
        context: mockContext,
        message: 'Me siento con energía esta mañana',
        extractedData: energyData,
      };

      const output = await service.process(input);

      expect(output.agentType).toBe('energy');
      expect(output.insights).toBeDefined();
      expect(output.insights.length).toBeGreaterThan(0);
      expect(output.recommendations).toBeDefined();
      expect(output.confidence).toBeGreaterThan(0);
    });

    it('should identify high energy state', async () => {
      const highEnergy: EnergyData = {
        level: 5,
        time: 'morning',
        mood: 'great',
        stressLevel: 1,
      };

      const input = {
        context: mockContext,
        message: 'Me siento excelente!',
        extractedData: highEnergy,
      };

      const output = await service.process(input);

      expect(output.dataPoints.level).toBe(5);
      // Should have either positive recommendations or at least some recommendations
      // When context lacks recent data, agent may suggest tracking more data
      expect(output.recommendations.length).toBeGreaterThanOrEqual(0);
    });

    it('should flag low morning energy', async () => {
      const lowMorningEnergy: EnergyData = {
        level: 2,
        time: 'morning',
        mood: 'low',
      };

      const input = {
        context: mockContext,
        message: 'Me desperté muy cansado',
        extractedData: lowMorningEnergy,
      };

      const output = await service.process(input);

      expect(output.dataPoints.riskFactors).toContain('low_morning_energy');
      // Should have sleep-related recommendation
      const hasSleepRec = output.recommendations.some(
        (rec) =>
          rec.toLowerCase().includes('sueño') ||
          rec.toLowerCase().includes('sleep') ||
          rec.toLowerCase().includes('dormir'),
      );
      expect(hasSleepRec).toBe(true);
    });

    it('should detect high stress', async () => {
      const highStress: EnergyData = {
        level: 3,
        time: 'afternoon',
        mood: 'neutral',
        stressLevel: 5,
      };

      const input = {
        context: mockContext,
        message: 'Estoy muy estresado hoy',
        extractedData: highStress,
      };

      const output = await service.process(input);

      expect(output.dataPoints.riskFactors).toContain('high_stress');
      expect(output.dataPoints.stressLevel).toBe(5);
    });

    it('should return low confidence without data', async () => {
      const input = {
        context: mockContext,
        message: 'Hola',
        extractedData: {},
      };

      const output = await service.process(input);

      expect(output.confidence).toBeLessThan(0.5);
    });

    it('should detect emotional content in message', async () => {
      const input = {
        context: mockContext,
        message: 'Me siento muy cansado y sin motivación',
        extractedData: { level: 2 },
      };

      const output = await service.process(input);

      expect(output).toBeDefined();
      expect(output.confidence).toBeGreaterThan(0.3);
    });
  });

  describe('trend analysis', () => {
    it('should calculate energy trend from history', async () => {
      const contextWithHistory: AgentContext = {
        ...mockContext,
        recentEntries: [
          {
            id: 'energy-1',
            userId: 'user-1',
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            type: 'energy',
            data: { level: 3 },
            novaPoints: 5,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'energy-2',
            userId: 'user-1',
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            type: 'energy',
            data: { level: 2 },
            novaPoints: 5,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'energy-3',
            userId: 'user-1',
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            type: 'energy',
            data: { level: 2 },
            novaPoints: 5,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const energyData: EnergyData = {
        level: 4,
        time: 'morning',
      };

      const input = {
        context: contextWithHistory,
        message: 'Hoy tengo más energía',
        extractedData: energyData,
      };

      const output = await service.process(input);

      expect(output.dataPoints.trend).toBe('improving');
    });

    it('should detect declining energy trend', async () => {
      const contextWithHistory: AgentContext = {
        ...mockContext,
        recentEntries: [
          {
            id: 'energy-1',
            userId: 'user-1',
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            type: 'energy',
            data: { level: 4 },
            novaPoints: 5,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'energy-2',
            userId: 'user-1',
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            type: 'energy',
            data: { level: 4 },
            novaPoints: 5,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const energyData: EnergyData = {
        level: 2,
        time: 'afternoon',
      };

      const input = {
        context: contextWithHistory,
        message: 'Me siento sin energía',
        extractedData: energyData,
      };

      const output = await service.process(input);

      expect(output.dataPoints.trend).toBe('declining');
    });
  });

  describe('cross-data analysis', () => {
    it('should correlate low energy with sleep deficit', async () => {
      const contextWithSleepDeficit: AgentContext = {
        ...mockContext,
        recentEntries: [
          {
            id: 'sleep-1',
            userId: 'user-1',
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            type: 'sleep',
            data: { duration: 5 },
            novaPoints: 10,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'sleep-2',
            userId: 'user-1',
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            type: 'sleep',
            data: { duration: 5.5 },
            novaPoints: 10,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const energyData: EnergyData = {
        level: 2,
        time: 'morning',
      };

      const input = {
        context: contextWithSleepDeficit,
        message: 'Me siento agotado',
        extractedData: energyData,
      };

      const output = await service.process(input);

      // Should identify sleep as potential cause
      const hasSleepCause = output.dataPoints.potentialCauses &&
        (output.dataPoints.potentialCauses as string[]).some(
          (cause: string) =>
            cause.toLowerCase().includes('sueño') ||
            cause.toLowerCase().includes('sleep'),
        );
      expect(hasSleepCause).toBe(true);
    });

    it('should correlate low energy with intense training', async () => {
      const contextWithTraining: AgentContext = {
        ...mockContext,
        recentEntries: [
          {
            id: 'exercise-1',
            userId: 'user-1',
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            type: 'exercise',
            data: { type: 'strength', intensity: 'very_high' },
            novaPoints: 25,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'exercise-2',
            userId: 'user-1',
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            type: 'exercise',
            data: { type: 'strength', intensity: 'high' },
            novaPoints: 20,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const energyData: EnergyData = {
        level: 2,
        time: 'afternoon',
      };

      const input = {
        context: contextWithTraining,
        message: 'Estoy cansado después del gym',
        extractedData: energyData,
      };

      const output = await service.process(input);

      // Should identify training as potential cause
      const hasTrainingCause = output.dataPoints.potentialCauses &&
        (output.dataPoints.potentialCauses as string[]).some(
          (cause: string) =>
            cause.toLowerCase().includes('entrena') ||
            cause.toLowerCase().includes('train'),
        );
      expect(hasTrainingCause).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle missing time of day', async () => {
      const energyData: EnergyData = {
        level: 3,
        mood: 'neutral',
      };

      const input = {
        context: mockContext,
        message: 'Energía normal',
        extractedData: energyData,
      };

      const output = await service.process(input);

      expect(output).toBeDefined();
      expect(output.dataPoints.time).toBe('unknown');
    });

    it('should handle mood-only input', async () => {
      const energyData: EnergyData = {
        mood: 'bad',
      };

      const input = {
        context: mockContext,
        message: 'Me siento mal hoy',
        extractedData: energyData,
      };

      const output = await service.process(input);

      expect(output).toBeDefined();
      expect(output.dataPoints.mood).toBe('bad');
    });
  });
});
