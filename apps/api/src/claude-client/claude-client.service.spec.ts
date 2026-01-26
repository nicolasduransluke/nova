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

    it('should classify workout messages', async () => {
      const intent = await service.classifyIntent('Just finished a 30 min run');
      expect(intent).toBe('workout_log');
    });

    it('should classify sleep messages', async () => {
      const intent = await service.classifyIntent('I slept 8 hours last night');
      expect(intent).toBe('sleep_log');
    });

    it('should classify energy messages', async () => {
      const intent = await service.classifyIntent('Feeling tired today');
      expect(intent).toBe('energy_check');
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

    it('should extract sleep data', async () => {
      const data = await service.extractDataFromMessage(
        'Got 7 hours of sleep',
        'sleep_log',
      );
      expect(data).toHaveProperty('hours');
      expect(data.hours).toBe(7);
    });

    it('should handle weight in pounds', async () => {
      const data = await service.extractDataFromMessage(
        'Weight is 165 lb',
        'weight_log',
      );
      expect(data).toHaveProperty('weight');
      expect(data.weight).toBeCloseTo(74.84, 1); // ~165 * 0.453592
    });

    it('should return empty object for unknown intent', async () => {
      const data = await service.extractDataFromMessage('Hello there', 'greeting');
      expect(data).toEqual({});
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
      expect(response.toLowerCase()).toContain('weight');
    });

    it('should return appropriate response for meal', async () => {
      const response = await service.generateResponse('Had a healthy meal');
      expect(response.toLowerCase()).toContain('meal');
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
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        recentEntries: [],
        conversationHistory: [],
        currentDate: new Date('2024-01-15'),
      };

      const prompt = service.buildContextPrompt(context);

      expect(prompt).toContain('75kg');
      expect(prompt).toContain('weight loss');
    });
  });
});
