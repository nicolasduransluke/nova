import { Test, TestingModule } from '@nestjs/testing';
import { ClaudeClientService } from './claude-client.service';

describe('ClaudeClientService', () => {
  let service: ClaudeClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClaudeClientService],
    }).compile();

    service = module.get<ClaudeClientService>(ClaudeClientService);
    service.onModuleInit();
  });

  describe('classifyIntent', () => {
    it('should classify weight messages', async () => {
      const intent = await service.classifyIntent('I weigh 75 kg today');
      expect(intent).toBe('weight_log');
    });

    it('should classify meal messages', async () => {
      const intent = await service.classifyIntent('I had eggs for breakfast');
      expect(intent).toBe('meal_log');
    });

    it('should classify activity messages', async () => {
      const intent = await service.classifyIntent('Corrí 30 minutos');
      expect(intent).toBe('activity_log');
    });

    it('should classify confirmation messages', async () => {
      const intent = await service.classifyIntent('sí');
      expect(intent).toBe('confirmation');
    });

    it('should classify questions', async () => {
      const intent = await service.classifyIntent('How am I doing?');
      expect(intent).toBe('question');
    });

    it('should classify greetings', async () => {
      const intent = await service.classifyIntent('Hello!');
      expect(intent).toBe('greeting');
    });

    it('should classify general messages', async () => {
      const intent = await service.classifyIntent('Just checking in');
      expect(intent).toBe('general');
    });
  });

  describe('extractDataFromMessage', () => {
    it('should extract weight data', async () => {
      const data = await service.extractDataFromMessage(
        'I weigh 75.5 kg today',
        'weight_log',
      );
      expect(data).toHaveProperty('weight');
      expect(data.weight).toBeCloseTo(75.5, 1);
    });

    it('should extract meal data with items', async () => {
      const data = await service.extractDataFromMessage(
        'Almorcé pollo con arroz',
        'meal_log',
      );
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('totalCalories');
      expect((data.items as Array<unknown>).length).toBeGreaterThan(0);
    });

    it('should extract activity data', async () => {
      const data = await service.extractDataFromMessage(
        'Corrí 30 minutos',
        'activity_log',
      );
      expect(data).toHaveProperty('activity');
      expect(data).toHaveProperty('durationMinutes');
      expect(data).toHaveProperty('caloriesBurned');
    });

    it('should handle weight in pounds', async () => {
      const data = await service.extractDataFromMessage(
        'Weight is 165 lb',
        'weight_log',
      );
      expect(data).toHaveProperty('weight');
      expect(data.weight).toBeCloseTo(74.84, 1);
    });

    it('should return empty object for unknown intent', async () => {
      const data = await service.extractDataFromMessage('Hello there', 'greeting');
      expect(data).toEqual({});
    });
  });

  describe('parseConfirmation', () => {
    const pendingEntry = {
      id: 'test-1',
      type: 'intake' as const,
      description: 'pollo con arroz',
      calories: 450,
      items: [{ name: 'pollo', calories: 250 }, { name: 'arroz', calories: 200 }],
      createdAt: new Date(),
    };

    it('should parse confirmation', async () => {
      const result = await service.parseConfirmation('sí', pendingEntry);
      expect(result.action).toBe('confirm');
    });

    it('should parse rejection', async () => {
      const result = await service.parseConfirmation('no', pendingEntry);
      expect(result.action).toBe('reject');
    });

    it('should parse adjustment', async () => {
      const result = await service.parseConfirmation('ponle 800', pendingEntry);
      expect(result.action).toBe('adjust');
      expect(result.adjustedCalories).toBe(800);
    });
  });

  describe('generateResponse', () => {
    it('should return mock response in development', async () => {
      const response = await service.generateResponse('I weigh 75 kg');
      expect(response).toBeTruthy();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    });

    it('should return appropriate response for weight', async () => {
      const response = await service.generateResponse('I weigh 75 kg today');
      expect(response.toLowerCase()).toMatch(/weight|peso/);
    });

    it('should return appropriate response for meal', async () => {
      const response = await service.generateResponse('Almorcé pollo con arroz');
      expect(response.toLowerCase()).toMatch(/calor|estimad|meal|comida/);
    });
  });

  describe('buildContextPrompt', () => {
    it('should build context prompt with user info', () => {
      const context = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        recentEntries: [],
        conversationHistory: [],
        currentDate: new Date('2024-01-15'),
      };

      const prompt = service.buildContextPrompt(context);

      expect(prompt).toContain('Test User');
      expect(prompt).toContain('User Context');
    });

    it('should include profile data when available', () => {
      const context = {
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
          weight: 75,
          height: 180,
          age: 30,
          sex: 'male' as const,
          objective: 'weight_loss' as const,
          activityLevel: 'moderate' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        recentEntries: [],
        conversationHistory: [],
        currentDate: new Date('2024-01-15'),
      };

      const prompt = service.buildContextPrompt(context);

      expect(prompt).toContain('75kg');
      expect(prompt).toContain('Activity level');
    });
  });
});
