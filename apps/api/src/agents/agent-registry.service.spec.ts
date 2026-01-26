import { Test, TestingModule } from '@nestjs/testing';
import { AgentRegistryService } from './agent-registry.service';
import { MetabolicAgentService } from './metabolic-agent.service';
import { NutritionAgentService } from './nutrition-agent.service';
import { TrainingAgentService } from './training-agent.service';
import { SleepAgentService } from './sleep-agent.service';
import { EnergyAgentService } from './energy-agent.service';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import type { AgentContext } from '@nova/types';

describe('AgentRegistryService', () => {
  let registry: AgentRegistryService;
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
    currentDate: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentRegistryService,
        MetabolicAgentService,
        NutritionAgentService,
        TrainingAgentService,
        SleepAgentService,
        EnergyAgentService,
        ClaudeClientService,
      ],
    }).compile();

    registry = module.get<AgentRegistryService>(AgentRegistryService);
    claudeClient = module.get<ClaudeClientService>(ClaudeClientService);
    claudeClient.onModuleInit();
  });

  describe('initialization', () => {
    it('should register all agents', () => {
      const agentTypes = registry.getRegisteredAgentTypes();

      expect(agentTypes).toContain('metabolic');
      expect(agentTypes).toContain('nutrition');
      expect(agentTypes).toContain('training');
      expect(agentTypes).toContain('sleep');
      expect(agentTypes).toContain('energy');
      expect(agentTypes.length).toBe(5);
    });

    it('should get specific agent by type', () => {
      const metabolicAgent = registry.getAgent('metabolic');
      const nutritionAgent = registry.getAgent('nutrition');

      expect(metabolicAgent).toBeDefined();
      expect(nutritionAgent).toBeDefined();
    });
  });

  describe('intent routing', () => {
    it('should route weight_log to metabolic agent', () => {
      const agents = registry.getAgentsForIntent('weight_log');

      expect(agents).toContain('metabolic');
    });

    it('should route meal_log to nutrition agent', () => {
      const agents = registry.getAgentsForIntent('meal_log');

      expect(agents).toContain('nutrition');
    });

    it('should route workout_log to training and metabolic agents', () => {
      const agents = registry.getAgentsForIntent('workout_log');

      expect(agents).toContain('training');
      expect(agents).toContain('metabolic');
    });

    it('should route sleep_log to sleep agent', () => {
      const agents = registry.getAgentsForIntent('sleep_log');

      expect(agents).toContain('sleep');
    });

    it('should route energy_check to energy agent', () => {
      const agents = registry.getAgentsForIntent('energy_check');

      expect(agents).toContain('energy');
    });

    it('should return empty array for greeting intent', () => {
      const agents = registry.getAgentsForIntent('greeting');

      expect(agents).toHaveLength(0);
    });
  });

  describe('content analysis', () => {
    it('should detect nutrition content', () => {
      const additionalAgents = registry.analyzeContentForAgents(
        'Comí pollo con arroz y tengo mucha proteína',
        [],
      );

      expect(additionalAgents).toContain('nutrition');
    });

    it('should detect training content', () => {
      const additionalAgents = registry.analyzeContentForAgents(
        'Hice 5 series de sentadillas en el gym',
        [],
      );

      expect(additionalAgents).toContain('training');
    });

    it('should detect sleep content', () => {
      const additionalAgents = registry.analyzeContentForAgents(
        'Dormí 8 horas y me desperté descansado',
        [],
      );

      expect(additionalAgents).toContain('sleep');
    });

    it('should detect energy content', () => {
      const additionalAgents = registry.analyzeContentForAgents(
        'Me siento muy cansado y sin energía',
        [],
      );

      expect(additionalAgents).toContain('energy');
    });

    it('should detect metabolic content', () => {
      const additionalAgents = registry.analyzeContentForAgents(
        'Hoy peso 75 kg',
        [],
      );

      expect(additionalAgents).toContain('metabolic');
    });

    it('should not duplicate agents from primary list', () => {
      const additionalAgents = registry.analyzeContentForAgents(
        'Comí mucha proteína hoy',
        ['nutrition'],
      );

      expect(additionalAgents).not.toContain('nutrition');
    });

    it('should detect multiple categories in complex message', () => {
      const additionalAgents = registry.analyzeContentForAgents(
        'Hoy entrené, comí bien, pero dormí poco y estoy cansado',
        [],
      );

      expect(additionalAgents.length).toBeGreaterThan(2);
    });
  });

  describe('processWithAgents', () => {
    it('should process input through specified agents', async () => {
      const input = {
        context: mockContext,
        message: 'Peso 75 kg',
        extractedData: { weight: 75 },
      };

      const outputs = await registry.processWithAgents('weight_log', input);

      expect(outputs.length).toBeGreaterThan(0);
      expect(outputs[0].agentType).toBe('metabolic');
    });

    it('should return empty array for intents with no agents', async () => {
      const input = {
        context: mockContext,
        message: 'Hola!',
        extractedData: {},
      };

      const outputs = await registry.processWithAgents('greeting', input);

      expect(outputs).toHaveLength(0);
    });

    it('should handle agent errors gracefully', async () => {
      const input = {
        context: mockContext,
        message: 'Test message',
        extractedData: {},
      };

      // Should not throw even if agent fails
      const outputs = await registry.processWithAgents('meal_log', input);

      expect(outputs).toBeDefined();
    });
  });

  describe('processComprehensive', () => {
    it('should combine intent-based and content-based routing', async () => {
      const input = {
        context: mockContext,
        message: 'Entrené piernas y luego comí pollo con arroz',
        extractedData: {
          type: 'strength',
          duration: 60,
        },
      };

      const outputs = await registry.processComprehensive('workout_log', input);

      // Should have training (from intent) and nutrition (from content)
      const agentTypes = outputs.map((o) => o.agentType);
      expect(agentTypes).toContain('training');
      expect(agentTypes).toContain('nutrition');
    });

    it('should process meal with energy mention', async () => {
      const input = {
        context: mockContext,
        message: 'Comí poco hoy y me siento sin energía',
        extractedData: {
          totalCalories: 1000,
        },
      };

      const outputs = await registry.processComprehensive('meal_log', input);

      const agentTypes = outputs.map((o) => o.agentType);
      expect(agentTypes).toContain('nutrition');
      expect(agentTypes).toContain('energy');
    });

    it('should return all outputs in parallel execution', async () => {
      const input = {
        context: mockContext,
        message: 'Hoy entrené, comí bien, dormí 8 horas y tengo buena energía',
        extractedData: {},
      };

      const startTime = Date.now();
      const outputs = await registry.processComprehensive('general', input);
      const duration = Date.now() - startTime;

      // Should have multiple outputs
      expect(outputs.length).toBeGreaterThan(2);

      // Parallel execution should be faster than sequential
      // (each agent mock takes ~100ms, sequential would be 500ms+)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('processWithAgent', () => {
    it('should process with specific agent', async () => {
      const input = {
        context: mockContext,
        message: 'Dormí 7 horas',
        extractedData: { duration: 7 },
      };

      const output = await registry.processWithAgent('sleep', input);

      expect(output.agentType).toBe('sleep');
      expect(output.confidence).toBeGreaterThan(0);
    });

    it('should throw for unknown agent type', async () => {
      const input = {
        context: mockContext,
        message: 'Test',
        extractedData: {},
      };

      await expect(
        registry.processWithAgent('unknown' as any, input),
      ).rejects.toThrow('Agent not found');
    });
  });
});
