import { Test, TestingModule } from '@nestjs/testing';
import { AgentRegistryService } from './agent-registry.service';
import { MetabolicAgentService } from './metabolic-agent.service';
import { NutritionAgentService } from './nutrition-agent.service';
import { ActivityBurnAgentService } from './activity-burn-agent.service';
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
      activityLevel: 'moderate',
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
        ActivityBurnAgentService,
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
      expect(agentTypes).toContain('activity');
      expect(agentTypes.length).toBe(3);
    });

    it('should get specific agent by type', () => {
      const metabolicAgent = registry.getAgent('metabolic');
      const nutritionAgent = registry.getAgent('nutrition');
      const activityAgent = registry.getAgent('activity');

      expect(metabolicAgent).toBeDefined();
      expect(nutritionAgent).toBeDefined();
      expect(activityAgent).toBeDefined();
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

    it('should route activity_log to activity agent', () => {
      const agents = registry.getAgentsForIntent('activity_log');
      expect(agents).toContain('activity');
    });

    it('should route confirmation to no agents', () => {
      const agents = registry.getAgentsForIntent('confirmation');
      expect(agents).toHaveLength(0);
    });

    it('should route greeting to no agents', () => {
      const agents = registry.getAgentsForIntent('greeting');
      expect(agents).toHaveLength(0);
    });

    it('should route question to metabolic agent', () => {
      const agents = registry.getAgentsForIntent('question');
      expect(agents).toContain('metabolic');
    });
  });

  describe('content analysis', () => {
    it('should detect nutrition content', () => {
      const additionalAgents = registry.analyzeContentForAgents(
        'Comí pollo con arroz',
        [],
      );
      expect(additionalAgents).toContain('nutrition');
    });

    it('should detect activity content', () => {
      const additionalAgents = registry.analyzeContentForAgents(
        'Hice ejercicio en el gimnasio',
        [],
      );
      expect(additionalAgents).toContain('activity');
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
        'Comí pollo',
        ['nutrition'],
      );
      expect(additionalAgents).not.toContain('nutrition');
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
  });

  describe('processComprehensive', () => {
    it('should combine intent-based and content-based routing', async () => {
      const input = {
        context: mockContext,
        message: 'Entrené y luego comí pollo con arroz',
        extractedData: {},
      };

      const outputs = await registry.processComprehensive('activity_log', input);

      const agentTypes = outputs.map((o) => o.agentType);
      expect(agentTypes).toContain('activity');
      expect(agentTypes).toContain('nutrition');
    });
  });

  describe('processWithAgent', () => {
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
