import { Test, TestingModule } from '@nestjs/testing';
import { NutritionAgentService } from './nutrition-agent.service';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import type { AgentContext, NutritionData } from '@nova/types';

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
    it('should process meal data and return insights', async () => {
      const nutritionData: NutritionData = {
        meals: [
          { name: 'Desayuno', calories: 500, protein: 30, carbs: 50, fat: 20 },
          { name: 'Almuerzo', calories: 800, protein: 50, carbs: 80, fat: 30 },
        ],
        totalCalories: 1300,
        totalProtein: 80,
        totalCarbs: 130,
        totalFat: 50,
      };

      const input = {
        context: mockContext,
        message: 'Hoy desayuné huevos y almorcé pollo con arroz',
        extractedData: nutritionData,
      };

      const output = await service.process(input);

      expect(output.agentType).toBe('nutrition');
      expect(output.insights).toBeDefined();
      expect(output.insights.length).toBeGreaterThan(0);
      expect(output.recommendations).toBeDefined();
      expect(output.dataPoints).toHaveProperty('calories');
      expect(output.dataPoints).toHaveProperty('protein');
      expect(output.confidence).toBeGreaterThan(0);
    });

    it('should calculate macro targets based on profile', async () => {
      const nutritionData: NutritionData = {
        totalCalories: 2000,
        totalProtein: 150,
        totalCarbs: 200,
        totalFat: 60,
      };

      const input = {
        context: mockContext,
        message: 'Registro de comidas del día',
        extractedData: nutritionData,
      };

      const output = await service.process(input);

      expect(output.dataPoints).toHaveProperty('targetCalories');
      expect(output.dataPoints).toHaveProperty('targetProtein');
      expect(output.dataPoints.targetCalories).toBeGreaterThan(0);
      expect(output.dataPoints.targetProtein).toBeGreaterThan(0);
    });

    it('should return low confidence without data', async () => {
      const input = {
        context: mockContext,
        message: 'No comí nada hoy',
        extractedData: {},
      };

      const output = await service.process(input);

      expect(output.confidence).toBeLessThan(0.5);
    });

    it('should generate protein recommendations when low', async () => {
      const nutritionData: NutritionData = {
        totalCalories: 1500,
        totalProtein: 50, // Low protein
        totalCarbs: 200,
        totalFat: 50,
      };

      const input = {
        context: mockContext,
        message: 'Comí principalmente carbohidratos hoy',
        extractedData: nutritionData,
      };

      const output = await service.process(input);

      expect(output.recommendations.length).toBeGreaterThan(0);
      // Should have a protein-related recommendation
      const hasProteinRec = output.recommendations.some(
        (rec) => rec.toLowerCase().includes('proteína') || rec.toLowerCase().includes('protein'),
      );
      expect(hasProteinRec).toBe(true);
    });

    it('should track meal distribution', async () => {
      const nutritionData: NutritionData = {
        meals: [
          { name: 'Desayuno', calories: 400, protein: 25 },
          { name: 'Almuerzo', calories: 600, protein: 35 },
          { name: 'Cena', calories: 500, protein: 30 },
        ],
        totalCalories: 1500,
        totalProtein: 90,
      };

      const input = {
        context: mockContext,
        message: 'Tres comidas del día',
        extractedData: nutritionData,
      };

      const output = await service.process(input);

      expect(output.dataPoints).toHaveProperty('mealsCount');
      expect(output.dataPoints.mealsCount).toBe(3);
    });

    it('should calculate adherence percentages', async () => {
      const nutritionData: NutritionData = {
        totalCalories: 2000,
        totalProtein: 150,
      };

      const input = {
        context: mockContext,
        message: 'Comidas del día',
        extractedData: nutritionData,
      };

      const output = await service.process(input);

      expect(output.dataPoints).toHaveProperty('calorieAdherence');
      expect(output.dataPoints).toHaveProperty('proteinAdherence');
    });
  });

  describe('edge cases', () => {
    it('should handle missing profile gracefully', async () => {
      const contextWithoutProfile: AgentContext = {
        ...mockContext,
        profile: undefined,
      };

      const nutritionData: NutritionData = {
        totalCalories: 1800,
        totalProtein: 100,
      };

      const input = {
        context: contextWithoutProfile,
        message: 'Comidas del día',
        extractedData: nutritionData,
      };

      const output = await service.process(input);

      expect(output.agentType).toBe('nutrition');
      expect(output.dataPoints.targetCalories).toBeDefined();
      // Should use default targets
      expect(output.dataPoints.targetCalories).toBe(2000);
    });

    it('should handle zero values', async () => {
      const nutritionData: NutritionData = {
        totalCalories: 0,
        totalProtein: 0,
      };

      const input = {
        context: mockContext,
        message: 'Ayuné hoy',
        extractedData: nutritionData,
      };

      const output = await service.process(input);

      expect(output).toBeDefined();
      // When there's zero data, either calories is 0 or dataPoints may be minimal
      expect(output.dataPoints.calories === 0 || output.dataPoints.calories === undefined).toBe(true);
    });
  });
});
