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

## Language Rule (CRITICAL)
- ALWAYS respond in the SAME LANGUAGE as the user's message
- If the user writes in Spanish, respond ENTIRELY in Spanish
- If the user writes in English, respond in English
- Never mix languages in a single response

## Voice Guidelines
- Be calm, data-driven, and supportive
- Keep responses short (6-8 lines maximum)
- Structure: Data Reading → Interpretation → Actionable Step
- Use minimal emojis (only when truly helpful)
- Avoid hype language ("amazing!", "awesome!", "genial!", etc.)
- Make evidence-based statements
- Be direct but warm

## Response Structure
1. Acknowledge the data/input briefly
2. Provide one key insight based on patterns
3. Suggest one specific, actionable next step

## Tone Examples (English)
- Instead of "Great job!" → "That's consistent with your goals."
- Instead of "Amazing progress!" → "Your trend shows steady improvement."

## Tone Examples (Spanish)
- Instead of "¡Excelente!" → "Eso es consistente con tus objetivos."
- Instead of "¡Increíble progreso!" → "Tu tendencia muestra mejora constante."

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
    const isSpanish = this.detectSpanish(lowerPrompt);

    // Weight
    if (lowerPrompt.includes('weight') || lowerPrompt.includes('kg') ||
        lowerPrompt.includes('peso') || lowerPrompt.includes('kilos')) {
      return isSpanish
        ? "He registrado tu peso. Mirando tu tendencia reciente, estás manteniendo un progreso constante hacia tu objetivo. Sigue registrando consistentemente - ayuda a identificar patrones."
        : "I've noted your weight entry. Looking at your recent trend, you're maintaining steady progress toward your goal. Keep tracking consistently - it helps identify patterns.";
    }

    // Meals / Food
    if (lowerPrompt.includes('ate') || lowerPrompt.includes('meal') || lowerPrompt.includes('food') ||
        lowerPrompt.includes('comí') || lowerPrompt.includes('comi') || lowerPrompt.includes('comida') ||
        lowerPrompt.includes('desayuno') || lowerPrompt.includes('almuerzo') || lowerPrompt.includes('cena') ||
        lowerPrompt.includes('torta') || lowerPrompt.includes('pollo') || lowerPrompt.includes('arroz')) {
      return isSpanish
        ? "Gracias por registrar tu comida. Una nutrición balanceada apoya tus niveles de energía durante el día. Considera cómo te hace sentir esta comida en las próximas horas."
        : "Thanks for logging your meal. Balanced nutrition supports your energy levels throughout the day. Consider how this meal makes you feel in the next few hours.";
    }

    // Workout / Exercise
    if (lowerPrompt.includes('workout') || lowerPrompt.includes('exercise') || lowerPrompt.includes('gym') ||
        lowerPrompt.includes('entrené') || lowerPrompt.includes('entrene') || lowerPrompt.includes('ejercicio') ||
        lowerPrompt.includes('running') || lowerPrompt.includes('correr') || lowerPrompt.includes('gimnasio')) {
      return isSpanish
        ? "Buen trabajo manteniéndote activo. Tu cuerpo se beneficia del movimiento constante. Recuerda balancear la intensidad con una recuperación adecuada para resultados óptimos."
        : "Good work on staying active. Your body benefits from consistent movement. Remember to balance intensity with proper recovery for optimal results.";
    }

    // Sleep
    if (lowerPrompt.includes('sleep') || lowerPrompt.includes('slept') ||
        lowerPrompt.includes('dormí') || lowerPrompt.includes('dormi') || lowerPrompt.includes('sueño')) {
      return isSpanish
        ? "El sueño es fundamental para tus niveles de energía. Basándome en tu registro, considera mantener un horario de sueño consistente. Un descanso de calidad apoya tanto el rendimiento físico como mental."
        : "Sleep is foundational to your energy levels. Based on your entry, consider maintaining a consistent sleep schedule. Quality rest supports both physical and mental performance.";
    }

    // Energy / Tiredness
    if (lowerPrompt.includes('energy') || lowerPrompt.includes('tired') ||
        lowerPrompt.includes('energía') || lowerPrompt.includes('energia') || lowerPrompt.includes('cansado') ||
        lowerPrompt.includes('cansada') || lowerPrompt.includes('agotado')) {
      return isSpanish
        ? "He registrado tu nivel de energía. Tus niveles pueden ser influenciados por el sueño, la nutrición y la actividad. Analizar patrones a lo largo del tiempo nos ayudará a identificar qué funciona mejor para ti."
        : "I've recorded your energy check. Your levels can be influenced by sleep, nutrition, and activity. Looking at patterns over time will help us identify what works best for you.";
    }

    // Pain / Health concerns
    if (lowerPrompt.includes('duele') || lowerPrompt.includes('dolor') || lowerPrompt.includes('hurt') ||
        lowerPrompt.includes('pain') || lowerPrompt.includes('guata') || lowerPrompt.includes('estómago') ||
        lowerPrompt.includes('stomach') || lowerPrompt.includes('mal')) {
      return isSpanish
        ? "Lamento escuchar que no te sientes bien. Si el malestar persiste, considera consultar a un profesional de salud. Mientras tanto, descansa y mantente hidratado. ¿Hay algo específico que crees que pudo haberlo causado?"
        : "I'm sorry to hear you're not feeling well. If the discomfort persists, consider consulting a health professional. In the meantime, rest and stay hydrated. Is there anything specific you think might have caused it?";
    }

    // Question about capabilities
    if (lowerPrompt.includes('qué puedes') || lowerPrompt.includes('que puedes') ||
        lowerPrompt.includes('what can you') || lowerPrompt.includes('help me')) {
      return isSpanish
        ? "Soy NOVA, tu coach de salud personal. Puedo ayudarte a:\n\n• Registrar tu peso y ver tendencias\n• Analizar tus comidas y nutrición\n• Dar seguimiento a tus entrenamientos\n• Monitorear tu sueño y energía\n• Identificar patrones para optimizar tu bienestar\n\n¿Qué te gustaría registrar hoy?"
        : "I'm NOVA, your personal health coach. I can help you:\n\n• Track your weight and see trends\n• Analyze your meals and nutrition\n• Monitor your workouts\n• Track your sleep and energy\n• Identify patterns to optimize your wellbeing\n\nWhat would you like to log today?";
    }

    // Greetings
    if (lowerPrompt.includes('hello') || lowerPrompt.includes('hi') || lowerPrompt.includes('hey') ||
        lowerPrompt.includes('hola') || lowerPrompt.includes('buenos') || lowerPrompt.includes('buenas')) {
      return isSpanish
        ? "¡Hola! Soy NOVA, tu coach de energía y bienestar. ¿Cómo puedo ayudarte hoy? Puedes compartirme tu peso, comidas, entrenamientos, sueño o cómo te sientes."
        : "Hello! I'm NOVA, your energy and wellness coach. How can I help you today? You can share your weight, meals, workouts, sleep, or how you're feeling.";
    }

    // Default
    return isSpanish
      ? "Estoy aquí para apoyar tu bienestar. Comparte tus comidas, entrenamientos, sueño o niveles de energía, y te ayudaré a entender patrones y avanzar hacia tus objetivos."
      : "I'm here to support your wellness journey. Share your meals, workouts, sleep, or energy levels, and I'll help you understand patterns and make progress toward your goals.";
  }

  private detectSpanish(text: string): boolean {
    const spanishIndicators = [
      'hola', 'cómo', 'como', 'qué', 'que', 'hoy', 'día', 'dia',
      'comí', 'comi', 'entrené', 'entrene', 'dormí', 'dormi',
      'peso', 'energía', 'energia', 'sueño', 'buenos', 'buenas',
      'gracias', 'por favor', 'ayuda', 'puedes', 'tengo', 'estoy',
      'duele', 'guata', 'bien', 'mal', 'mucho', 'poco',
      'desayuno', 'almuerzo', 'cena', 'comida', 'torta',
      'correr', 'gimnasio', 'ejercicio', 'cansado', 'cansada',
    ];
    return spanishIndicators.some((word) => text.includes(word));
  }

  private getMockIntent(message: string): MessageIntent {
    const lower = message.toLowerCase();

    // Weight logging (English + Spanish)
    if (lower.includes('kg') || lower.includes('lb') || lower.includes('weigh') ||
        lower.includes('peso') || lower.includes('kilos'))
      return 'weight_log';

    // Meal logging (English + Spanish)
    if (lower.includes('ate') || lower.includes('meal') || lower.includes('food') ||
        lower.includes('breakfast') || lower.includes('lunch') || lower.includes('dinner') ||
        lower.includes('comí') || lower.includes('comi') || lower.includes('comida') ||
        lower.includes('desayuno') || lower.includes('almuerzo') || lower.includes('cena') ||
        lower.includes('torta') || lower.includes('pollo') || lower.includes('arroz') ||
        lower.includes('huevos') || lower.includes('pan'))
      return 'meal_log';

    // Workout logging (English + Spanish)
    if (lower.includes('workout') || lower.includes('exercise') || lower.includes('gym') ||
        lower.includes('run') || lower.includes('running') ||
        lower.includes('entrené') || lower.includes('entrene') || lower.includes('ejercicio') ||
        lower.includes('correr') || lower.includes('gimnasio') || lower.includes('pesas') ||
        lower.includes('cardio'))
      return 'workout_log';

    // Sleep logging (English + Spanish)
    if (lower.includes('sleep') || lower.includes('slept') ||
        lower.includes('dormí') || lower.includes('dormi') || lower.includes('sueño') ||
        lower.includes('horas de sueño') || lower.includes('desperté') || lower.includes('desperte'))
      return 'sleep_log';

    // Energy check (English + Spanish)
    if (lower.includes('energy') || lower.includes('tired') ||
        lower.includes('energía') || lower.includes('energia') ||
        lower.includes('cansado') || lower.includes('cansada') ||
        lower.includes('agotado') || lower.includes('agotada') ||
        lower.includes('animado') || lower.includes('bien') ||
        (lower.includes('me siento') && !lower.includes('duele')))
      return 'energy_check';

    // Questions (both languages)
    if (lower.includes('?') ||
        lower.includes('qué puedes') || lower.includes('que puedes') ||
        lower.includes('cómo') || lower.includes('como funciona') ||
        lower.includes('what can') || lower.includes('how do'))
      return 'question';

    // Greetings (English + Spanish)
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') ||
        lower.includes('hola') || lower.includes('buenos días') || lower.includes('buenos dias') ||
        lower.includes('buenas tardes') || lower.includes('buenas noches'))
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
        const match = message.match(/(\d+\.?\d*)\s*(kg|lb|kilos)?/i);
        if (match) {
          const weight = parseFloat(match[1]);
          const unit = match[2]?.toLowerCase() || 'kg';
          return { weight: unit === 'lb' ? weight * 0.453592 : weight, unit: 'kg' };
        }
        return { weight: null, unit: 'kg' };
      }

      case 'sleep_log': {
        // Match both "7 hours" and "7 horas"
        const match = message.match(/(\d+\.?\d*)\s*(hours?|horas?)/i);
        return {
          hours: match ? parseFloat(match[1]) : null,
          quality: (lower.includes('great') || lower.includes('good') ||
                   lower.includes('bien') || lower.includes('excelente'))
            ? 'good'
            : (lower.includes('bad') || lower.includes('poor') ||
               lower.includes('mal') || lower.includes('terrible'))
              ? 'poor'
              : 'fair',
        };
      }

      case 'workout_log': {
        // Detect workout type (English + Spanish)
        let type = 'general';
        if (lower.includes('run') || lower.includes('running') || lower.includes('correr') || lower.includes('corrí')) {
          type = 'cardio';
        } else if (lower.includes('gym') || lower.includes('gimnasio') || lower.includes('pesas') || lower.includes('strength')) {
          type = 'strength';
        } else if (lower.includes('yoga') || lower.includes('stretching') || lower.includes('estirar')) {
          type = 'flexibility';
        } else if (lower.includes('swim') || lower.includes('nadar') || lower.includes('natación')) {
          type = 'cardio';
        } else if (lower.includes('bike') || lower.includes('bici') || lower.includes('ciclismo')) {
          type = 'cardio';
        }

        // Try to extract duration
        const durationMatch = message.match(/(\d+)\s*(min|minutes?|minutos?)/i);
        const duration = durationMatch ? parseInt(durationMatch[1], 10) : 30;

        // Detect intensity
        let intensity: 'low' | 'medium' | 'high' = 'medium';
        if (lower.includes('intense') || lower.includes('intenso') || lower.includes('fuerte') || lower.includes('hard')) {
          intensity = 'high';
        } else if (lower.includes('light') || lower.includes('suave') || lower.includes('ligero') || lower.includes('easy')) {
          intensity = 'low';
        }

        return { type, duration, intensity };
      }

      case 'meal_log': {
        // Detect meal type (English + Spanish)
        let mealType = 'snack';
        if (lower.includes('breakfast') || lower.includes('desayuno')) {
          mealType = 'breakfast';
        } else if (lower.includes('lunch') || lower.includes('almuerzo')) {
          mealType = 'lunch';
        } else if (lower.includes('dinner') || lower.includes('cena')) {
          mealType = 'dinner';
        }

        // Extract food items mentioned
        const foods: string[] = [];
        const foodKeywords = [
          'eggs', 'huevos', 'toast', 'tostada', 'pan',
          'chicken', 'pollo', 'rice', 'arroz', 'pasta',
          'salad', 'ensalada', 'torta', 'cake', 'pizza',
          'fish', 'pescado', 'beef', 'carne', 'vegetables', 'verduras',
          'fruit', 'fruta', 'yogurt', 'cereal', 'sandwich',
        ];
        foodKeywords.forEach(food => {
          if (lower.includes(food)) {
            foods.push(food);
          }
        });

        return {
          mealType,
          foods,
          estimatedCalories: null,
        };
      }

      case 'energy_check': {
        let level = 5;
        // High energy indicators (English + Spanish)
        if (lower.includes('great') || lower.includes('high') || lower.includes('excellent') ||
            lower.includes('genial') || lower.includes('excelente') || lower.includes('mucha energía') ||
            lower.includes('muy bien') || lower.includes('animado')) {
          level = 8;
        }
        // Low energy indicators (English + Spanish)
        if (lower.includes('low') || lower.includes('tired') || lower.includes('exhausted') ||
            lower.includes('cansado') || lower.includes('cansada') || lower.includes('agotado') ||
            lower.includes('agotada') || lower.includes('sin energía') || lower.includes('mal')) {
          level = 3;
        }

        const factors: string[] = [];
        if (lower.includes('sleep') || lower.includes('sueño') || lower.includes('dormí')) {
          factors.push('sleep');
        }
        if (lower.includes('stress') || lower.includes('estrés') || lower.includes('estresado')) {
          factors.push('stress');
        }
        if (lower.includes('work') || lower.includes('trabajo')) {
          factors.push('work');
        }

        return { level, factors };
      }

      default:
        return {};
    }
  }
}
