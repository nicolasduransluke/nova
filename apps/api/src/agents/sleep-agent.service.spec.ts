import { Test, TestingModule } from '@nestjs/testing';
import { SleepAgentService } from './sleep-agent.service';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import type { AgentContext, SleepData } from '@nova/types';

describe('SleepAgentService', () => {
  let service: SleepAgentService;
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
      providers: [SleepAgentService, ClaudeClientService],
    }).compile();

    service = module.get<SleepAgentService>(SleepAgentService);
    claudeClient = module.get<ClaudeClientService>(ClaudeClientService);
    claudeClient.onModuleInit();
  });

  describe('process', () => {
    it('should process sleep data and return insights', async () => {
      const sleepData: SleepData = {
        duration: 7.5,
        quality: 4,
        bedtime: '23:00',
        wakeTime: '06:30',
      };

      const input = {
        context: mockContext,
        message: 'Dormí 7.5 horas anoche',
        extractedData: sleepData,
      };

      const output = await service.process(input);

      expect(output.agentType).toBe('sleep');
      expect(output.insights).toBeDefined();
      expect(output.insights.length).toBeGreaterThan(0);
      expect(output.recommendations).toBeDefined();
      expect(output.confidence).toBeGreaterThan(0);
    });

    it('should identify optimal sleep duration', async () => {
      const optimalSleep: SleepData = {
        duration: 8,
        quality: 5,
        bedtime: '22:30',
        wakeTime: '06:30',
      };

      const input = {
        context: mockContext,
        message: 'Dormí 8 horas',
        extractedData: optimalSleep,
      };

      const output = await service.process(input);

      expect(output.dataPoints.durationScore).toBeGreaterThanOrEqual(90);
      // Should have positive insight
      const hasPositiveInsight = output.insights.some(
        (insight) =>
          insight.toLowerCase().includes('excelente') ||
          insight.toLowerCase().includes('óptimo') ||
          insight.toLowerCase().includes('optimal'),
      );
      expect(hasPositiveInsight).toBe(true);
    });

    it('should flag insufficient sleep', async () => {
      const shortSleep: SleepData = {
        duration: 5,
        quality: 3,
        bedtime: '01:00',
        wakeTime: '06:00',
      };

      const input = {
        context: mockContext,
        message: 'Dormí solo 5 horas',
        extractedData: shortSleep,
      };

      const output = await service.process(input);

      expect(output.dataPoints.durationScore).toBeLessThan(80);
      expect(output.dataPoints.deficit).toBeGreaterThan(0);
      // Should have sleep deficit related insight
      const hasDeficitInsight = output.insights.some(
        (insight) =>
          insight.toLowerCase().includes('por debajo') ||
          insight.toLowerCase().includes('insuficiente') ||
          insight.includes('5'),
      );
      expect(hasDeficitInsight).toBe(true);
    });

    it('should analyze late bedtime', async () => {
      const lateSleep: SleepData = {
        duration: 7,
        quality: 3,
        bedtime: '02:00',
        wakeTime: '09:00',
      };

      const input = {
        context: mockContext,
        message: 'Me acosté tarde pero dormí 7 horas',
        extractedData: lateSleep,
      };

      const output = await service.process(input);

      expect(output.dataPoints.timingScore).toBeLessThan(70);
      // Should mention late bedtime
      const hasTimingInsight = output.insights.some(
        (insight) =>
          insight.toLowerCase().includes('tarde') ||
          insight.toLowerCase().includes('late') ||
          insight.includes('02:00'),
      );
      expect(hasTimingInsight).toBe(true);
    });

    it('should return low confidence without data', async () => {
      const input = {
        context: mockContext,
        message: 'No dormí bien',
        extractedData: {},
      };

      const output = await service.process(input);

      expect(output.confidence).toBeLessThan(0.5);
    });

    it('should calculate overall sleep score', async () => {
      const sleepData: SleepData = {
        duration: 7,
        quality: 4,
        bedtime: '23:00',
        wakeTime: '06:00',
      };

      const input = {
        context: mockContext,
        message: 'Registro de sueño',
        extractedData: sleepData,
      };

      const output = await service.process(input);

      expect(output.dataPoints).toHaveProperty('overallScore');
      expect(output.dataPoints.overallScore).toBeGreaterThan(0);
      expect(output.dataPoints.overallScore).toBeLessThanOrEqual(100);
    });
  });

  describe('weekly analysis', () => {
    it('should calculate weekly average from history', async () => {
      const contextWithHistory: AgentContext = {
        ...mockContext,
        recentEntries: [
          {
            id: 'sleep-1',
            userId: 'user-1',
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            type: 'sleep',
            data: { duration: 7 },
            novaPoints: 15,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'sleep-2',
            userId: 'user-1',
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            type: 'sleep',
            data: { duration: 6 },
            novaPoints: 10,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'sleep-3',
            userId: 'user-1',
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            type: 'sleep',
            data: { duration: 8 },
            novaPoints: 15,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const sleepData: SleepData = {
        duration: 7,
        quality: 4,
      };

      const input = {
        context: contextWithHistory,
        message: 'Dormí 7 horas',
        extractedData: sleepData,
      };

      const output = await service.process(input);

      expect(output.dataPoints).toHaveProperty('weeklyAverage');
      expect(output.dataPoints.weeklyAverage).toBe(7); // Average of 7, 6, 8
    });
  });

  describe('time parsing', () => {
    it('should handle 24h time format', async () => {
      const sleepData: SleepData = {
        duration: 8,
        bedtime: '22:30',
        wakeTime: '06:30',
      };

      const input = {
        context: mockContext,
        message: 'Dormí de 22:30 a 06:30',
        extractedData: sleepData,
      };

      const output = await service.process(input);

      expect(output.dataPoints.bedtime).toBe('22:30');
      expect(output.dataPoints.wakeTime).toBe('06:30');
    });

    it('should handle AM/PM time format', async () => {
      const sleepData: SleepData = {
        duration: 7,
        bedtime: '11:00 PM',
        wakeTime: '6:00 AM',
      };

      const input = {
        context: mockContext,
        message: 'Dormí de 11 PM a 6 AM',
        extractedData: sleepData,
      };

      const output = await service.process(input);

      expect(output).toBeDefined();
      expect(output.dataPoints.timingScore).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle oversleeping', async () => {
      const longSleep: SleepData = {
        duration: 11,
        quality: 3,
      };

      const input = {
        context: mockContext,
        message: 'Dormí 11 horas',
        extractedData: longSleep,
      };

      const output = await service.process(input);

      expect(output.dataPoints.durationScore).toBeLessThan(100);
    });

    it('should handle interruptions', async () => {
      const interruptedSleep: SleepData = {
        duration: 7,
        quality: 2,
        interruptions: 3,
      };

      const input = {
        context: mockContext,
        message: 'Me desperté 3 veces anoche',
        extractedData: interruptedSleep,
      };

      const output = await service.process(input);

      expect(output.dataPoints.interruptions).toBe(3);
    });
  });
});
