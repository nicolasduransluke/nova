import { Test, TestingModule } from '@nestjs/testing';
import { MetabolicAgentService } from './metabolic-agent.service';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import type { AgentContext } from '@nova/types';

describe('MetabolicAgentService', () => {
  let service: MetabolicAgentService;
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
      objective: 'weight_loss',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    recentEntries: [
      {
        id: 'entry-1',
        userId: 'user-1',
        date: new Date('2024-01-10'),
        type: 'custom',
        data: { weight: 81 },
        novaPoints: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'entry-2',
        userId: 'user-1',
        date: new Date('2024-01-15'),
        type: 'custom',
        data: { weight: 80 },
        novaPoints: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    conversationHistory: [],
    currentDate: new Date('2024-01-15'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetabolicAgentService, ClaudeClientService],
    }).compile();

    service = module.get<MetabolicAgentService>(MetabolicAgentService);
    claudeClient = module.get<ClaudeClientService>(ClaudeClientService);
    claudeClient.onModuleInit();
  });

  describe('process', () => {
    it('should process weight data and return insights', async () => {
      const input = {
        context: mockContext,
        message: 'I weigh 79 kg today',
        extractedData: { weight: 79, unit: 'kg' },
      };

      const output = await service.process(input);

      expect(output.agentType).toBe('metabolic');
      expect(output.insights).toBeDefined();
      expect(output.recommendations).toBeDefined();
      expect(output.dataPoints).toBeDefined();
      expect(output.confidence).toBeGreaterThan(0);
    });

    it('should calculate BMI when height is available', async () => {
      const input = {
        context: mockContext,
        message: 'Weight check: 75 kg',
        extractedData: { weight: 75, unit: 'kg' },
      };

      const output = await service.process(input);

      expect(output.dataPoints).toHaveProperty('bmi');
      // BMI = 75 / (1.75^2) ≈ 24.5
      expect(output.dataPoints.bmi).toBeCloseTo(24.5, 0);
    });

    it('should detect weight trend from recent entries', async () => {
      const input = {
        context: mockContext,
        message: 'Recording my weight',
        extractedData: { weight: 79, unit: 'kg' },
      };

      const output = await service.process(input);

      expect(output.dataPoints).toHaveProperty('weightTrend');
      const trend = output.dataPoints.weightTrend as {
        direction: string;
        dataPoints: number;
      };
      expect(trend.direction).toBe('down');
      expect(trend.dataPoints).toBe(2);
    });

    it('should generate recommendations based on objective', async () => {
      const input = {
        context: mockContext,
        message: 'Current weight: 79 kg',
        extractedData: { weight: 79, unit: 'kg' },
      };

      const output = await service.process(input);

      expect(output.recommendations.length).toBeGreaterThan(0);
    });

    it('should have higher confidence with more data', async () => {
      const inputWithData = {
        context: mockContext,
        message: 'Weight: 79 kg',
        extractedData: { weight: 79, unit: 'kg' },
      };

      const inputWithoutData = {
        context: {
          ...mockContext,
          profile: undefined,
          recentEntries: [],
        },
        message: 'Weight: 79 kg',
        extractedData: {},
      };

      const outputWithData = await service.process(inputWithData);
      const outputWithoutData = await service.process(inputWithoutData);

      expect(outputWithData.confidence).toBeGreaterThan(
        outputWithoutData.confidence,
      );
    });
  });
});
