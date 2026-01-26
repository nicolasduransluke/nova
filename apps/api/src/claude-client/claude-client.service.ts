import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type {
  MessageIntent,
  AgentContext,
  Message,
} from '@nova/types';
import { retry, sleep } from '@nova/utils';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  conversationHistory?: ClaudeMessage[];
}

@Injectable()
export class ClaudeClientService implements OnModuleInit {
  private client: Anthropic;
  private readonly logger = new Logger(ClaudeClientService.name);
  private readonly model = 'claude-sonnet-4-20250514';
  private readonly maxRetries = 3;
  private readonly baseDelayMs = 1000;

  onModuleInit() {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not set. Claude client will operate in mock mode.',
      );
    }

    this.client = new Anthropic({
      apiKey: apiKey || 'mock-key',
    });
  }

  private get novaSystemPrompt(): string {
    return `You are NOVA, a calm and intelligent AI health coach focused on human energy optimization.

## Voice Guidelines
- Be calm, data-driven, and supportive
- Keep responses short (6-8 lines maximum)
- Structure: Data Reading → Interpretation → Actionable Step
- Use minimal emojis (only when truly helpful)
- Avoid hype language ("amazing!", "awesome!", etc.)
- Make evidence-based statements
- Be direct but warm

## Response Structure
1. Acknowledge the data/input briefly
2. Provide one key insight based on patterns
3. Suggest one specific, actionable next step

## Tone Examples
- Instead of "Great job!" → "That's consistent with your goals."
- Instead of "Amazing progress!" → "Your trend shows steady improvement."
- Instead of "You should totally try..." → "Consider..."

Always prioritize the user's wellbeing and provide personalized guidance based on their data and goals.`;
  }

  async generateResponse(
    prompt: string,
    options: GenerateOptions = {},
  ): Promise<string> {
    const {
      systemPrompt = this.novaSystemPrompt,
      maxTokens = 500,
      temperature = 0.7,
      conversationHistory = [],
    } = options;

    // Check if we're in mock mode
    if (!process.env.ANTHROPIC_API_KEY) {
      return this.getMockResponse(prompt);
    }

    return retry(
      async () => {
        try {
          const messages: Anthropic.MessageParam[] = [
            ...conversationHistory.map((msg) => ({
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
            })),
            { role: 'user' as const, content: prompt },
          ];

          const response = await this.client.messages.create({
            model: this.model,
            max_tokens: maxTokens,
            temperature,
            system: systemPrompt,
            messages,
          });

          const textBlock = response.content.find(
            (block) => block.type === 'text',
          );

          return textBlock && 'text' in textBlock ? textBlock.text : '';
        } catch (error) {
          this.logger.error(`Claude API error: ${error}`);
          throw error;
        }
      },
      this.maxRetries,
      this.baseDelayMs,
    );
  }

  async classifyIntent(message: string): Promise<MessageIntent> {
    // Check if we're in mock mode
    if (!process.env.ANTHROPIC_API_KEY) {
      return this.getMockIntent(message);
    }

    const prompt = `Classify the following user message into exactly ONE of these categories:
- weight_log: User is reporting their weight
- meal_log: User is sharing what they ate
- workout_log: User is reporting exercise/workout
- sleep_log: User is reporting sleep data
- energy_check: User is describing their energy levels
- question: User is asking a question
- greeting: User is saying hello or greeting
- general: Any other type of message

User message: "${message}"

Respond with ONLY the category name, nothing else.`;

    try {
      const response = await this.generateResponse(prompt, {
        systemPrompt:
          'You are a message classifier. Respond with only the category name.',
        maxTokens: 20,
        temperature: 0,
      });

      const intent = response.trim().toLowerCase() as MessageIntent;
      const validIntents: MessageIntent[] = [
        'weight_log',
        'meal_log',
        'workout_log',
        'sleep_log',
        'energy_check',
        'question',
        'greeting',
        'general',
      ];

      return validIntents.includes(intent) ? intent : 'general';
    } catch (error) {
      this.logger.error(`Intent classification failed: ${error}`);
      return 'general';
    }
  }

  async extractDataFromMessage(
    message: string,
    intent: MessageIntent,
  ): Promise<Record<string, unknown>> {
    // Check if we're in mock mode
    if (!process.env.ANTHROPIC_API_KEY) {
      return this.getMockExtractedData(message, intent);
    }

    const extractionPrompts: Record<string, string> = {
      weight_log: `Extract weight data from this message. Return JSON with: { "weight": number (in kg), "unit": "kg" or "lb" }`,
      meal_log: `Extract meal data from this message. Return JSON with: { "mealType": "breakfast"|"lunch"|"dinner"|"snack", "foods": string[], "estimatedCalories": number or null }`,
      workout_log: `Extract workout data from this message. Return JSON with: { "type": string, "duration": number (minutes), "intensity": "low"|"medium"|"high" }`,
      sleep_log: `Extract sleep data from this message. Return JSON with: { "hours": number, "quality": "poor"|"fair"|"good"|"excellent" or null }`,
      energy_check: `Extract energy level from this message. Return JSON with: { "level": 1-10, "factors": string[] }`,
    };

    const extractionPrompt = extractionPrompts[intent];
    if (!extractionPrompt) {
      return {};
    }

    const prompt = `${extractionPrompt}

User message: "${message}"

Respond with ONLY valid JSON, nothing else.`;

    try {
      const response = await this.generateResponse(prompt, {
        systemPrompt: 'You are a data extractor. Respond with only valid JSON.',
        maxTokens: 200,
        temperature: 0,
      });

      return JSON.parse(response.trim());
    } catch (error) {
      this.logger.error(`Data extraction failed: ${error}`);
      return {};
    }
  }

  buildContextPrompt(context: AgentContext): string {
    const { user, profile, recentEntries, conversationHistory } = context;

    let contextStr = `## User Context
- Name: ${user.name}
- Date: ${context.currentDate.toLocaleDateString()}
`;

    if (profile) {
      contextStr += `- Goal: ${profile.objective.replace('_', ' ')}
- Current weight: ${profile.weight}kg
- Age: ${profile.age}
`;
    }

    if (recentEntries.length > 0) {
      contextStr += `\n## Recent Activity (last ${recentEntries.length} entries)\n`;
      recentEntries.slice(0, 5).forEach((entry) => {
        contextStr += `- ${entry.type}: ${JSON.stringify(entry.data)} (${entry.novaPoints} points)\n`;
      });
    }

    if (conversationHistory.length > 0) {
      contextStr += `\n## Conversation History\n`;
      conversationHistory.slice(-10).forEach((msg) => {
        contextStr += `${msg.sender}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}\n`;
      });
    }

    return contextStr;
  }

  // Mock responses for development without API key
  private getMockResponse(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('weight') || lowerPrompt.includes('kg')) {
      return "I've noted your weight entry. Looking at your recent trend, you're maintaining steady progress toward your goal. Keep tracking consistently - it helps identify patterns.";
    }

    if (
      lowerPrompt.includes('ate') ||
      lowerPrompt.includes('meal') ||
      lowerPrompt.includes('food')
    ) {
      return "Thanks for logging your meal. Balanced nutrition supports your energy levels throughout the day. Consider how this meal makes you feel in the next few hours.";
    }

    if (
      lowerPrompt.includes('workout') ||
      lowerPrompt.includes('exercise') ||
      lowerPrompt.includes('gym')
    ) {
      return "Good work on staying active. Your body benefits from consistent movement. Remember to balance intensity with proper recovery for optimal results.";
    }

    if (
      lowerPrompt.includes('sleep') ||
      lowerPrompt.includes('slept') ||
      lowerPrompt.includes('tired')
    ) {
      return "Sleep is foundational to your energy levels. Based on your entry, consider maintaining a consistent sleep schedule. Quality rest supports both physical and mental performance.";
    }

    if (
      lowerPrompt.includes('energy') ||
      lowerPrompt.includes('feel') ||
      lowerPrompt.includes('tired')
    ) {
      return "I've recorded your energy check. Your levels can be influenced by sleep, nutrition, and activity. Looking at patterns over time will help us identify what works best for you.";
    }

    return "I'm here to support your wellness journey. Share your meals, workouts, sleep, or energy levels, and I'll help you understand patterns and make progress toward your goals.";
  }

  private getMockIntent(message: string): MessageIntent {
    const lower = message.toLowerCase();

    if (lower.includes('kg') || lower.includes('lb') || lower.includes('weigh'))
      return 'weight_log';
    if (
      lower.includes('ate') ||
      lower.includes('meal') ||
      lower.includes('food') ||
      lower.includes('breakfast') ||
      lower.includes('lunch') ||
      lower.includes('dinner')
    )
      return 'meal_log';
    if (
      lower.includes('workout') ||
      lower.includes('exercise') ||
      lower.includes('gym') ||
      lower.includes('run')
    )
      return 'workout_log';
    if (
      lower.includes('sleep') ||
      lower.includes('slept') ||
      lower.includes('hours')
    )
      return 'sleep_log';
    if (
      lower.includes('energy') ||
      lower.includes('tired') ||
      lower.includes('feel')
    )
      return 'energy_check';
    if (lower.includes('?')) return 'question';
    if (
      lower.includes('hello') ||
      lower.includes('hi') ||
      lower.includes('hey')
    )
      return 'greeting';

    return 'general';
  }

  private getMockExtractedData(
    message: string,
    intent: MessageIntent,
  ): Record<string, unknown> {
    const lower = message.toLowerCase();

    switch (intent) {
      case 'weight_log': {
        const match = message.match(/(\d+\.?\d*)\s*(kg|lb)?/i);
        if (match) {
          const weight = parseFloat(match[1]);
          const unit = match[2]?.toLowerCase() || 'kg';
          return { weight: unit === 'lb' ? weight * 0.453592 : weight, unit };
        }
        return { weight: null, unit: 'kg' };
      }

      case 'sleep_log': {
        const match = message.match(/(\d+\.?\d*)\s*hours?/i);
        return {
          hours: match ? parseFloat(match[1]) : null,
          quality: lower.includes('great') || lower.includes('good')
            ? 'good'
            : lower.includes('bad') || lower.includes('poor')
              ? 'poor'
              : 'fair',
        };
      }

      case 'workout_log': {
        return {
          type: lower.includes('run')
            ? 'running'
            : lower.includes('gym')
              ? 'strength'
              : 'general',
          duration: 30,
          intensity: 'medium',
        };
      }

      case 'meal_log': {
        return {
          mealType: lower.includes('breakfast')
            ? 'breakfast'
            : lower.includes('lunch')
              ? 'lunch'
              : lower.includes('dinner')
                ? 'dinner'
                : 'snack',
          foods: [],
          estimatedCalories: null,
        };
      }

      case 'energy_check': {
        let level = 5;
        if (lower.includes('great') || lower.includes('high')) level = 8;
        if (lower.includes('low') || lower.includes('tired')) level = 3;
        return { level, factors: [] };
      }

      default:
        return {};
    }
  }
}
