import { Test, TestingModule } from '@nestjs/testing';
import { NutritionAgentService } from './nutrition-agent.service';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import type { AgentContext } from '@nova/types';

describe('NutritionAgentService', () => {
  let service: NutritionAgentService;
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
      providers: [NutritionAgentService, ClaudeClientService],
    }).compile();

    service = module.get<NutritionAgentService>(NutritionAgentService);
    claudeClient = module.get<ClaudeClientService>(ClaudeClientService);
    claudeClient.onModuleInit();
  });

  describe('process', () => {
    it('should process meal description and return calorie estimate', async () => {
      const input = {
        context: mockContext,
        message: 'Almorcé pollo con arroz',
        extractedData: {},
      };

      const output = await service.process(input);

      expect(output.agentType).toBe('nutrition');
      expect(output.insights).toBeDefined();
      expect(output.insights.length).toBeGreaterThan(0);
      expect(output.dataPoints).toHaveProperty('totalCalories');
      expect(output.dataPoints).toHaveProperty('items');
      expect(output.confidence).toBeGreaterThan(0);
    });

    it('should return low confidence for empty messages', async () => {
      const input = {
        context: mockContext,
        message: 'ab',
        extractedData: {},
      };

      const output = await service.process(input);

      expect(output.confidence).toBeLessThanOrEqual(0.3);
    });
  });

  describe('calculateTDEE', () => {
    it('should calculate TDEE with Mifflin-St Jeor for male', () => {
      const tdee = service.calculateTDEE(mockContext.profile);

      // BMR for male: 10*80 + 6.25*175 - 5*30 + 5 = 800 + 1093.75 - 150 + 5 = 1748.75
      // TDEE with moderate (1.55): 1748.75 * 1.55 = 2710.56
      expect(tdee).toBeCloseTo(2710.56, 0);
    });

    it('should calculate TDEE for female', () => {
      const femaleProfile = { ...mockContext.profile!, sex: 'female' as const };
      const tdee = service.calculateTDEE(femaleProfile);

      // BMR for female: 10*80 + 6.25*175 - 5*30 - 161 = 800 + 1093.75 - 150 - 161 = 1582.75
      // TDEE with moderate (1.55): 1582.75 * 1.55 = 2453.26
      expect(tdee).toBeCloseTo(2453.26, 0);
    });

    it('should return default 2000 without profile', () => {
      const tdee = service.calculateTDEE(undefined);
      expect(tdee).toBe(2000);
    });
  });

  describe('estimateCalories', () => {
    it('should estimate calories from food description', async () => {
      const result = await service.estimateCalories('pollo con arroz');

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.totalCalories).toBeGreaterThan(0);
    });
  });
});
