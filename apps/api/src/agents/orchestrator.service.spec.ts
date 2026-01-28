import { Test, TestingModule } from '@nestjs/testing';
import { OrchestratorService, OrchestratorDependencies } from './orchestrator.service';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import { MetabolicAgentService } from './metabolic-agent.service';
import { NutritionAgentService } from './nutrition-agent.service';
import { ActivityBurnAgentService } from './activity-burn-agent.service';
import { IntegratorAgentService } from './integrator-agent.service';
import { AgentRegistryService } from './agent-registry.service';
import type { User, Profile } from '@nova/types';

describe('OrchestratorService', () => {
  let service: OrchestratorService;
  let claudeClient: ClaudeClientService;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProfile: Profile = {
    id: 'profile-1',
    userId: 'user-1',
    weight: 80,
    height: 175,
    age: 30,
    sex: 'male',
    objective: 'weight_loss',
    activityLevel: 'moderate',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDependencies: OrchestratorDependencies = {
    getUser: jest.fn().mockResolvedValue(mockUser),
    getProfile: jest.fn().mockResolvedValue(mockProfile),
    getRecentEntries: jest.fn().mockResolvedValue([]),
    getConversationHistory: jest.fn().mockResolvedValue([]),
    saveEntry: jest.fn().mockResolvedValue({
      id: 'entry-1',
      userId: 'user-1',
      date: new Date(),
      type: 'custom',
      data: {},
      novaPoints: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    createCalorieEntry: jest.fn().mockResolvedValue({
      id: 'calorie-1',
      userId: 'user-1',
      date: new Date(),
      type: 'intake',
      description: 'test',
      calories: 500,
      items: [{ name: 'test', calories: 500 }],
      confirmed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    getTodayCalorieEntries: jest.fn().mockResolvedValue([]),
    createWeightLog: jest.fn().mockResolvedValue({
      id: 'weight-1',
      userId: 'user-1',
      weight: 79,
      date: new Date(),
      createdAt: new Date(),
    }),
    getRecentWeightLogs: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        ClaudeClientService,
        MetabolicAgentService,
        NutritionAgentService,
        ActivityBurnAgentService,
        IntegratorAgentService,
        AgentRegistryService,
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
    claudeClient = module.get<ClaudeClientService>(ClaudeClientService);
    claudeClient.onModuleInit();

    jest.clearAllMocks();
  });

  describe('processMessage', () => {
    it('should process a weight log message successfully', async () => {
      const request = {
        userId: 'user-1',
        content: 'I weigh 79 kg today',
      };

      const result = await service.processMessage(request, mockDependencies);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('weight_log');
      expect(result.response).toHaveProperty('message');
      expect(result.response).toHaveProperty('tone');
      expect(result.processedAt).toBeInstanceOf(Date);
    });

    it('should process a greeting message', async () => {
      const request = {
        userId: 'user-1',
        content: 'Hello NOVA!',
      };

      const result = await service.processMessage(request, mockDependencies);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('greeting');
    });

    it('should process a question', async () => {
      const request = {
        userId: 'user-1',
        content: 'How am I doing with my goals?',
      };

      const result = await service.processMessage(request, mockDependencies);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('question');
    });

    it('should fetch user context', async () => {
      const request = {
        userId: 'user-1',
        content: 'Weight check: 80 kg',
      };

      await service.processMessage(request, mockDependencies);

      expect(mockDependencies.getUser).toHaveBeenCalledWith('user-1');
      expect(mockDependencies.getProfile).toHaveBeenCalledWith('user-1');
      expect(mockDependencies.getRecentEntries).toHaveBeenCalledWith('user-1', 10);
    });

    it('should handle user not found', async () => {
      const deps = {
        ...mockDependencies,
        getUser: jest.fn().mockResolvedValue(null),
      };

      const request = {
        userId: 'unknown-user',
        content: 'Hello',
      };

      const result = await service.processMessage(request, deps);

      expect(result.success).toBe(false);
    });

    it('should handle processing errors gracefully', async () => {
      const deps = {
        ...mockDependencies,
        getUser: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const request = {
        userId: 'user-1',
        content: 'Weight: 80 kg',
      };

      const result = await service.processMessage(request, deps);

      expect(result.success).toBe(false);
      expect(result.response.tone).toBe('calm');
    });

    it('should process meal log and create confirmed entry', async () => {
      const request = {
        userId: 'user-1',
        content: 'Almorcé pollo con arroz',
      };

      const result = await service.processMessage(request, mockDependencies);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('meal_log');
      expect(mockDependencies.createCalorieEntry).toHaveBeenCalledWith(
        expect.objectContaining({ confirmed: true }),
      );
    });

    it('should process activity log', async () => {
      const request = {
        userId: 'user-1',
        content: 'Corrí 30 minutos',
      };

      const result = await service.processMessage(request, mockDependencies);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('activity_log');
      expect(mockDependencies.createCalorieEntry).toHaveBeenCalled();
    });

    it('should create weight log for weight entries', async () => {
      const request = {
        userId: 'user-1',
        content: 'Peso 79 kg',
      };

      const result = await service.processMessage(request, mockDependencies);

      expect(result.success).toBe(true);
      expect(mockDependencies.createWeightLog).toHaveBeenCalled();
    });

    it('should include daily summary in response', async () => {
      const request = {
        userId: 'user-1',
        content: 'Almorcé pollo con arroz',
      };

      const result = await service.processMessage(request, mockDependencies);

      expect(result.response.dailySummary).toBeDefined();
      expect(result.response.dailySummary).toHaveProperty('intake');
      expect(result.response.dailySummary).toHaveProperty('burn');
      expect(result.response.dailySummary).toHaveProperty('tdee');
      expect(result.response.dailySummary).toHaveProperty('deficit');
    });
  });
});
