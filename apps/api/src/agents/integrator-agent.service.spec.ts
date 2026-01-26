import { Test, TestingModule } from '@nestjs/testing';
import { IntegratorAgentService, IntegratorInput } from './integrator-agent.service';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import type { AgentContext, AgentOutput } from '@nova/types';

describe('IntegratorAgentService', () => {
  let service: IntegratorAgentService;
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
    recentEntries: [],
    conversationHistory: [],
    currentDate: new Date('2024-01-15'),
  };

  const mockAgentOutput: AgentOutput = {
    agentType: 'metabolic',
    insights: ['Weight is trending down', 'BMI is within healthy range'],
    recommendations: ['Maintain current approach'],
    dataPoints: { weight: 79, bmi: 25.8 },
    confidence: 0.8,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IntegratorAgentService, ClaudeClientService],
    }).compile();

    service = module.get<IntegratorAgentService>(IntegratorAgentService);
    claudeClient = module.get<ClaudeClientService>(ClaudeClientService);
    claudeClient.onModuleInit();
  });

  describe('integrate', () => {
    it('should integrate agent outputs into a final response', async () => {
      const input: IntegratorInput = {
        context: mockContext,
        message: 'I weigh 79 kg today',
        extractedData: { weight: 79 },
        intent: 'weight_log',
        agentOutputs: [mockAgentOutput],
      };

      const response = await service.integrate(input);

      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('tone');
      expect(response.message).toBeTruthy();
      expect(['calm', 'encouraging', 'informative']).toContain(response.tone);
    });

    it('should determine encouraging tone for progress', async () => {
      const progressOutput: AgentOutput = {
        ...mockAgentOutput,
        insights: ['Great progress toward your goal'],
      };

      const input: IntegratorInput = {
        context: mockContext,
        message: 'Weight update',
        extractedData: {},
        intent: 'weight_log',
        agentOutputs: [progressOutput],
      };

      const response = await service.integrate(input);

      expect(response.tone).toBe('encouraging');
    });

    it('should determine informative tone for questions', async () => {
      const input: IntegratorInput = {
        context: mockContext,
        message: 'How am I doing with my weight loss?',
        extractedData: {},
        intent: 'question',
        agentOutputs: [],
      };

      const response = await service.integrate(input);

      expect(response.tone).toBe('informative');
    });

    it('should determine calm tone for routine logging', async () => {
      const input: IntegratorInput = {
        context: mockContext,
        message: 'Logging weight',
        extractedData: {},
        intent: 'weight_log',
        agentOutputs: [],
      };

      const response = await service.integrate(input);

      expect(response.tone).toBe('calm');
    });

    it('should calculate NOVA points earned', async () => {
      const input: IntegratorInput = {
        context: mockContext,
        message: 'Weight: 79 kg',
        extractedData: { weight: 79 },
        intent: 'weight_log',
        agentOutputs: [],
      };

      const response = await service.integrate(input);

      expect(response).toHaveProperty('novaPointsEarned');
      expect(response.novaPointsEarned).toBeGreaterThan(0);
    });

    it('should award bonus points for image upload', async () => {
      const inputWithImage: IntegratorInput = {
        context: mockContext,
        message: 'Weight check',
        extractedData: { imageUrl: 'http://example.com/scale.jpg' },
        intent: 'weight_log',
        agentOutputs: [],
      };

      const inputWithoutImage: IntegratorInput = {
        context: mockContext,
        message: 'Weight check',
        extractedData: {},
        intent: 'weight_log',
        agentOutputs: [],
      };

      const responseWithImage = await service.integrate(inputWithImage);
      const responseWithoutImage = await service.integrate(inputWithoutImage);

      expect(responseWithImage.novaPointsEarned).toBeGreaterThan(
        responseWithoutImage.novaPointsEarned!,
      );
    });

    it('should handle empty agent outputs', async () => {
      const input: IntegratorInput = {
        context: mockContext,
        message: 'Hello!',
        extractedData: {},
        intent: 'greeting',
        agentOutputs: [],
      };

      const response = await service.integrate(input);

      expect(response.message).toBeTruthy();
    });

    it('should include action items when present', async () => {
      const input: IntegratorInput = {
        context: mockContext,
        message: 'What should I do next?',
        extractedData: {},
        intent: 'question',
        agentOutputs: [mockAgentOutput],
      };

      const response = await service.integrate(input);

      expect(response).toHaveProperty('actionItems');
      // actionItems may be empty but should be an array
      expect(Array.isArray(response.actionItems)).toBe(true);
    });
  });
});
