import { Test, TestingModule } from '@nestjs/testing';
import { OrchestratorService, OrchestratorDependencies } from './orchestrator.service';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import { MetabolicAgentService } from './metabolic-agent.service';
import { NutritionAgentService } from './nutrition-agent.service';
import { TrainingAgentService } from './training-agent.service';
import { SleepAgentService } from './sleep-agent.service';
import { EnergyAgentService } from './energy-agent.service';
import { IntegratorAgentService } from './integrator-agent.service';
import { AgentRegistryService } from './agent-registry.service';
import type { User, Profile, DailyEntry, Message } from '@nova/types';

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
      novaPoints: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        ClaudeClientService,
        MetabolicAgentService,
        NutritionAgentService,
        TrainingAgentService,
        SleepAgentService,
        EnergyAgentService,
        IntegratorAgentService,
        AgentRegistryService,
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
    claudeClient = module.get<ClaudeClientService>(ClaudeClientService);
    claudeClient.onModuleInit();

    // Reset mocks
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
      expect(result.response.tone).toBe('informative');
    });

    it('should fetch user context', async () => {
      const request = {
        userId: 'user-1',
        content: 'Weight check',
      };

      await service.processMessage(request, mockDependencies);

      expect(mockDependencies.getUser).toHaveBeenCalledWith('user-1');
      expect(mockDependencies.getProfile).toHaveBeenCalledWith('user-1');
      expect(mockDependencies.getRecentEntries).toHaveBeenCalledWith(
        'user-1',
        10,
      );
    });

    it('should save entry for loggable intents', async () => {
      const request = {
        userId: 'user-1',
        content: 'I weigh 79 kg today',
      };

      await service.processMessage(request, mockDependencies);

      expect(mockDependencies.saveEntry).toHaveBeenCalled();
    });

    it('should not save entry for greetings', async () => {
      const request = {
        userId: 'user-1',
        content: 'Hello!',
      };

      await service.processMessage(request, mockDependencies);

      expect(mockDependencies.saveEntry).not.toHaveBeenCalled();
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
      expect(result.response.message).toContain('trouble');
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

    it('should process meal log messages', async () => {
      const request = {
        userId: 'user-1',
        content: 'Had eggs and toast for breakfast',
      };

      const result = await service.processMessage(request, mockDependencies);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('meal_log');
    });

    it('should process workout log messages', async () => {
      const request = {
        userId: 'user-1',
        content: 'Just finished a 30 minute run',
      };

      const result = await service.processMessage(request, mockDependencies);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('workout_log');
    });

    it('should process sleep log messages', async () => {
      const request = {
        userId: 'user-1',
        content: 'Slept 7 hours last night',
      };

      const result = await service.processMessage(request, mockDependencies);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('sleep_log');
    });

    it('should include NOVA points in response', async () => {
      const request = {
        userId: 'user-1',
        content: 'Weight: 79 kg',
      };

      const result = await service.processMessage(request, mockDependencies);

      expect(result.response.novaPointsEarned).toBeDefined();
      expect(result.response.novaPointsEarned).toBeGreaterThanOrEqual(0);
    });
  });
});
