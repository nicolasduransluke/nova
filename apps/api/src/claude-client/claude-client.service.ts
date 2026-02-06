import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import type {
  MessageIntent,
  AgentContext,
  PendingEntry,
  CalorieEntryItem,
} from '@nova/types';
import { retry } from '@nova/utils';
import { NutritionService } from '../nutrition/nutrition.service';

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

export interface ConfirmationResult {
  action: 'confirm' | 'adjust' | 'reject';
  adjustedCalories?: number;
  adjustedItems?: CalorieEntryItem[];
}

@Injectable()
export class ClaudeClientService implements OnModuleInit {
  private client: GoogleGenerativeAI;
  private readonly logger = new Logger(ClaudeClientService.name);
  private readonly model = 'gemini-2.0-flash';
  private readonly maxRetries = 3;
  private readonly baseDelayMs = 1000;

  constructor(private readonly nutritionService: NutritionService) {}

  onModuleInit() {
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      this.logger.warn(
        'GOOGLE_API_KEY not set. LLM client will operate in mock mode.',
      );
    }

    this.client = new GoogleGenerativeAI(apiKey || 'mock-key');
  }

  private get novaSystemPrompt(): string {
    return `You are NOVA, a calorie deficit coach that helps users lose weight by tracking meals and physical activity.

## Language Rule (CRITICAL)
- ALWAYS respond in the SAME LANGUAGE as the user's message
- If the user writes in Spanish, respond ENTIRELY in Spanish
- If the user writes in English, respond in English

## Voice Guidelines
- Be calm, data-driven, and supportive
- Keep responses short (4-6 lines maximum)
- Entries are auto-registered, do NOT ask for confirmation
- Focus on deficit tracking and weight loss progress
- Be direct but warm`;
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

    if (!process.env.GOOGLE_API_KEY) {
      return this.getMockResponse(prompt);
    }

    return retry(
      async () => {
        try {
          const model = this.client.getGenerativeModel({
            model: this.model,
            systemInstruction: systemPrompt,
          });

          const contents: Content[] = [
            ...conversationHistory.map((msg) => ({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }],
            } as Content)),
            { role: 'user', parts: [{ text: prompt }] },
          ];

          const result = await model.generateContent({
            contents,
            generationConfig: {
              maxOutputTokens: maxTokens,
              temperature,
            },
          });

          return result.response.text();
        } catch (error) {
          this.logger.error(`Gemini API error: ${error}`);
          throw error;
        }
      },
      this.maxRetries,
      this.baseDelayMs,
    );
  }

  async classifyIntent(message: string): Promise<MessageIntent> {
    // Always use keyword-based classifier first — it's reliable for meal/activity/weight
    const keywordIntent = this.getMockIntent(message);
    this.logger.debug(`Keyword intent: ${keywordIntent} for "${message}"`);

    // For data-logging intents and explicit questions, keywords are reliable — use them directly
    if (['meal_log', 'activity_log', 'weight_log', 'goal_set', 'profile_setup', 'confirmation', 'question'].includes(keywordIntent)) {
      return keywordIntent;
    }

    // For ambiguous intents (question, greeting, general), try Gemini for better classification
    if (!process.env.GOOGLE_API_KEY) {
      return keywordIntent;
    }

    const prompt = `Classify the following user message into exactly ONE of these categories:
- meal_log: User is sharing what they ate or drank
- activity_log: User is reporting exercise/physical activity
- weight_log: User is reporting their weight
- goal_set: User is setting or changing their weight goal or weekly loss target
- question: User is asking a question about their progress or the system
- greeting: User is saying hello or greeting
- general: Any other type of message

User message: "${message}"

Respond with ONLY the category name, nothing else.`;

    try {
      const response = await this.generateResponse(prompt, {
        systemPrompt: 'You are a message classifier. Respond with only the category name.',
        maxTokens: 20,
        temperature: 0,
      });

      const cleaned = response.trim().toLowerCase().replace(/[^a-z_]/g, '');
      this.logger.debug(`Gemini intent: raw="${response.trim()}" cleaned="${cleaned}"`);

      const validIntents: MessageIntent[] = [
        'meal_log', 'activity_log', 'weight_log', 'goal_set',
        'question', 'greeting', 'general',
      ];

      if (validIntents.includes(cleaned as MessageIntent)) {
        return cleaned as MessageIntent;
      }

      const found = validIntents.find((vi) => cleaned.includes(vi));
      if (found) return found;
    } catch (error) {
      this.logger.error(`Gemini intent classification failed: ${error}`);
    }

    return keywordIntent;
  }

  async extractDataFromMessage(
    message: string,
    intent: MessageIntent,
  ): Promise<Record<string, unknown>> {
    if (!process.env.GOOGLE_API_KEY) {
      return this.getMockExtractedData(message, intent);
    }

    const extractionPrompts: Record<string, string> = {
      weight_log: `Extract weight data from this message. Return JSON with: { "weight": number (in kg), "unit": "kg" or "lb" }`,
      meal_log: `Extract meal data from this message. Return JSON with: { "items": [{"name": "food item with modifiers", "quantity": number or null, "unit": "g" or "oz" or "portion" or null}], "totalCalories": null }. IMPORTANT: Preserve all modifiers and descriptors in the item name (e.g. "café sin azúcar" NOT just "café", "pollo a la plancha" NOT just "pollo", "leche descremada" NOT just "leche"). Just identify the food items, we will look up calories separately.`,
      activity_log: `Extract activity data from this message. Return JSON with: { "activity": "activity name", "durationMinutes": number, "caloriesBurned": estimated_calories_burned }`,
      goal_set: `Extract weight goal data from this message. Return JSON with: { "goalWeight": number or null (target weight in kg), "weeklyGoal": number or null (kg per week to lose), "targetWeeks": number or null (weeks to reach goal) }. If the user mentions pounds, convert to kg.`,
      profile_setup: `Extract profile data from this message. Return JSON with: { "weight": number or null (kg), "height": number or null (cm), "age": number or null, "sex": "male" or "female" or null, "goalWeight": number or null (kg) }. Convert meters to cm for height. Convert pounds to kg for weight.`,
    };

    const extractionPrompt = extractionPrompts[intent];
    if (!extractionPrompt) {
      // Fallback to mock extraction for intents not covered by API
      return this.getMockExtractedData(message, intent);
    }

    const prompt = `${extractionPrompt}

User message: "${message}"

Respond with ONLY valid JSON, nothing else.`;

    try {
      const response = await this.generateResponse(prompt, {
        systemPrompt: 'You are a data extractor. Respond with only valid JSON.',
        maxTokens: 300,
        temperature: 0,
      });

      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      let parsed = JSON.parse(cleaned);
      this.logger.debug(`Extracted data via API: ${JSON.stringify(parsed)}`);

      // For meal_log, enrich with USDA nutrition data
      if (intent === 'meal_log' && parsed.items && Array.isArray(parsed.items)) {
        parsed = await this.enrichMealWithUSDA(parsed, message);
      }

      return parsed;
    } catch (error) {
      this.logger.error(`Data extraction via API failed: ${error}`);
      // Fallback to mock extractor
      this.logger.debug(`Falling back to keyword-based data extraction`);
      return this.getMockExtractedData(message, intent);
    }
  }

  /**
   * Enrich meal data with USDA nutrition information
   */
  private async enrichMealWithUSDA(
    mealData: { items: Array<{ name: string; quantity?: number; unit?: string; calories?: number }>; totalCalories?: number },
    originalMessage: string,
  ): Promise<Record<string, unknown>> {
    if (!this.nutritionService.isAvailable()) {
      // USDA not configured, fall back to Gemini estimation
      return this.estimateMealCaloriesWithGemini(mealData, originalMessage);
    }

    const enrichedItems: CalorieEntryItem[] = [];
    let totalCalories = 0;
    let usedUSDA = false;

    for (const item of mealData.items) {
      const usdaResult = await this.nutritionService.estimateCalories(
        item.name,
        item.quantity,
        item.unit,
      );

      if (usdaResult && usdaResult.source === 'usda') {
        // USDA found a match
        usedUSDA = true;
        const calories = usdaResult.calories;
        enrichedItems.push({
          name: `${item.name} (USDA: ${usdaResult.match?.description})`,
          calories,
        });
        totalCalories += calories;
        this.logger.debug(`USDA match for "${item.name}": ${calories} kcal`);
      } else {
        // No USDA match, will estimate later
        enrichedItems.push({
          name: item.name,
          calories: item.calories || 0,
        });
      }
    }

    // If we didn't get USDA data for all items, use Gemini for the remaining
    if (!usedUSDA || enrichedItems.some(i => i.calories === 0)) {
      return this.estimateMealCaloriesWithGemini(
        { items: enrichedItems, totalCalories },
        originalMessage,
      );
    }

    return {
      items: enrichedItems,
      totalCalories,
      source: 'usda',
    };
  }

  /**
   * Fall back to Gemini for calorie estimation when USDA doesn't have data
   */
  private async estimateMealCaloriesWithGemini(
    mealData: { items: Array<{ name: string; calories?: number }>; totalCalories?: number },
    originalMessage: string,
  ): Promise<Record<string, unknown>> {
    const itemsNeedingEstimate = mealData.items.filter(i => !i.calories || i.calories === 0);

    if (itemsNeedingEstimate.length === 0) {
      return mealData;
    }

    const prompt = `Estimate calories for these food items using Latin American portion sizes. Be conservative (slightly overestimate).

Items: ${itemsNeedingEstimate.map(i => i.name).join(', ')}
Original message for context: "${originalMessage}"

IMPORTANT: Pay close attention to modifiers in the original message like "sin azúcar" (no sugar), "negro" (black), "con leche" (with milk), "descremado" (skim), etc. These significantly affect calorie counts. For example, "café sin azúcar" is ~5 kcal, while "café con azúcar" is ~30-50 kcal.

Return ONLY valid JSON:
{
  "items": [{"name": "item name", "calories": estimated_calories}],
  "totalCalories": sum_of_all_calories
}`;

    try {
      const response = await this.generateResponse(prompt, {
        systemPrompt: 'You are a nutrition expert. Respond with only valid JSON.',
        maxTokens: 300,
        temperature: 0,
      });

      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const estimated = JSON.parse(cleaned);

      // Merge estimated calories with existing items
      const finalItems = mealData.items.map(item => {
        if (item.calories && item.calories > 0) {
          return item;
        }
        const estimated_item = estimated.items?.find(
          (e: { name: string; calories: number }) =>
            e.name.toLowerCase().includes(item.name.toLowerCase()) ||
            item.name.toLowerCase().includes(e.name.toLowerCase())
        );
        return {
          name: item.name,
          calories: estimated_item?.calories || 200, // Default fallback
        };
      });

      const total = finalItems.reduce((sum, i) => sum + (i.calories || 0), 0);

      return {
        items: finalItems,
        totalCalories: total,
        source: 'gemini',
      };
    } catch (error) {
      this.logger.error(`Gemini calorie estimation failed: ${error}`);
      // Last resort: return with default estimates
      return {
        items: mealData.items.map(i => ({
          name: i.name,
          calories: i.calories || 200,
        })),
        totalCalories: mealData.items.reduce((sum, i) => sum + (i.calories || 200), 0),
        source: 'fallback',
      };
    }
  }

  async parseConfirmation(
    message: string,
    pendingEntry: PendingEntry,
  ): Promise<ConfirmationResult> {
    if (!process.env.GOOGLE_API_KEY) {
      return this.getMockConfirmation(message);
    }

    const prompt = `The user has a pending calorie entry:
- Type: ${pendingEntry.type}
- Description: ${pendingEntry.description}
- Estimated calories: ${pendingEntry.calories}
- Items: ${JSON.stringify(pendingEntry.items)}

The user responded: "${message}"

Determine the user's intention. Return ONLY valid JSON:
{
  "action": "confirm" | "adjust" | "reject",
  "adjustedCalories": number or null,
  "adjustedItems": [{name, calories}] or null
}

- "confirm": user agrees (sí, ok, dale, yes, perfecto, está bien)
- "adjust": user wants to change the calories (ponle X, cámbialo a X, son X)
- "reject": user wants to delete it (no, bórralo, quítalo, cancel)`;

    try {
      const response = await this.generateResponse(prompt, {
        systemPrompt: 'You are a confirmation parser. Respond with only valid JSON.',
        maxTokens: 100,
        temperature: 0,
      });

      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      this.logger.error(`Confirmation parsing failed: ${error}`);
      return { action: 'confirm' }; // Default to confirm on parse failure
    }
  }

  buildContextPrompt(context: AgentContext): string {
    const { user, profile, recentEntries, conversationHistory } = context;

    let contextStr = `## User Context
- Name: ${user.name}
- Date: ${context.currentDate.toLocaleDateString()}
`;

    if (profile) {
      contextStr += `- Weight: ${profile.weight}kg
- Height: ${profile.height}cm
- Age: ${profile.age}
- Activity level: ${profile.activityLevel}
`;
    }

    if (recentEntries.length > 0) {
      contextStr += `\n## Recent Activity (last ${recentEntries.length} entries)\n`;
      recentEntries.slice(0, 5).forEach((entry) => {
        contextStr += `- ${entry.type}: ${JSON.stringify(entry.data)}\n`;
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

    // Calorie estimation requests (JSON)
    if (lowerPrompt.includes('estimate calories') || lowerPrompt.includes('return only valid json')) {
      if (lowerPrompt.includes('meal') || lowerPrompt.includes('food') || lowerPrompt.includes('comí') || lowerPrompt.includes('comida')) {
        return JSON.stringify({
          items: [
            { name: 'plato principal', calories: 450 },
            { name: 'acompañamiento', calories: 150 },
          ],
          totalCalories: 600,
        });
      }
      if (lowerPrompt.includes('activity') || lowerPrompt.includes('exercise') || lowerPrompt.includes('corrí') || lowerPrompt.includes('correr')) {
        return JSON.stringify({
          activity: 'ejercicio',
          durationMinutes: 30,
          met: 6,
        });
      }
      if (lowerPrompt.includes('weight') || lowerPrompt.includes('peso')) {
        const match = prompt.match(/(\d+\.?\d*)\s*(kg|lb|kilos)?/i);
        const weight = match ? parseFloat(match[1]) : 70;
        return JSON.stringify({ weight, unit: 'kg' });
      }
      if (lowerPrompt.includes('confirmation') || lowerPrompt.includes('confirm')) {
        return JSON.stringify({ action: 'confirm' });
      }
    }

    // Meals / Food — extract actual data from the integration prompt
    if (lowerPrompt.includes('meal_log') || lowerPrompt.includes('comí') || lowerPrompt.includes('comi') ||
        lowerPrompt.includes('comida') || lowerPrompt.includes('desayuno') || lowerPrompt.includes('almuerzo') ||
        lowerPrompt.includes('almor') || lowerPrompt.includes('cena') ||
        lowerPrompt.includes('pollo') || lowerPrompt.includes('arroz') ||
        lowerPrompt.includes('ate') || lowerPrompt.includes('meal') || lowerPrompt.includes('food')) {
      const itemsData = this.extractItemsFromPrompt(prompt);
      const summaryData = this.extractSummaryFromPrompt(prompt);
      if (itemsData.items.length > 0) {
        const itemLines = itemsData.items.map((item) => `- ${item.name}: ~${item.calories} kcal`).join('\n');
        const summaryLine = summaryData
          ? (isSpanish
            ? `\nHoy llevas ${summaryData.intake} kcal consumidas | ${summaryData.burn} kcal quemadas | Déficit: ${summaryData.deficit} kcal`
            : `\nToday: ${summaryData.intake} kcal consumed | ${summaryData.burn} kcal burned | Deficit: ${summaryData.deficit} kcal`)
          : '';
        return isSpanish
          ? `He registrado tu comida:\n\n${itemLines}\n\nTotal: ~${itemsData.total} kcal${summaryLine}`
          : `Meal logged:\n\n${itemLines}\n\nTotal: ~${itemsData.total} kcal${summaryLine}`;
      }
      return isSpanish
        ? "He registrado tu comida con un estimado de ~500 kcal."
        : "Meal logged with an estimate of ~500 kcal.";
    }

    // Exercise / Activity — extract actual data from the integration prompt
    if (lowerPrompt.includes('activity_log') || lowerPrompt.includes('entrené') || lowerPrompt.includes('entrene') ||
        lowerPrompt.includes('ejercicio') || lowerPrompt.includes('corrí') || lowerPrompt.includes('correr') ||
        lowerPrompt.includes('gimnasio') || lowerPrompt.includes('workout') || lowerPrompt.includes('exercise') ||
        lowerPrompt.includes('gym') || lowerPrompt.includes('running') || lowerPrompt.includes('run')) {
      const itemsData = this.extractItemsFromPrompt(prompt);
      const summaryData = this.extractSummaryFromPrompt(prompt);
      if (itemsData.items.length > 0) {
        const itemLines = itemsData.items.map((item) => `- ${item.name}: ~${item.calories} kcal`).join('\n');
        const summaryLine = summaryData
          ? (isSpanish
            ? `\nHoy llevas ${summaryData.intake} kcal consumidas | ${summaryData.burn} kcal quemadas | Déficit: ${summaryData.deficit} kcal`
            : `\nToday: ${summaryData.intake} kcal consumed | ${summaryData.burn} kcal burned | Deficit: ${summaryData.deficit} kcal`)
          : '';
        return isSpanish
          ? `He registrado tu actividad:\n\n${itemLines}\n\nTotal quemado: ~${itemsData.total} kcal${summaryLine}`
          : `Activity logged:\n\n${itemLines}\n\nTotal burned: ~${itemsData.total} kcal${summaryLine}`;
      }
      return isSpanish
        ? "He registrado tu actividad con un estimado de ~250 kcal quemadas."
        : "Activity logged with an estimate of ~250 kcal burned.";
    }

    // Weight
    if (lowerPrompt.includes('weight') || lowerPrompt.includes('kg') ||
        lowerPrompt.includes('peso') || lowerPrompt.includes('kilos')) {
      return isSpanish
        ? "Peso registrado. Tu tendencia reciente muestra progreso constante. Sigue registrando para ver el patrón completo."
        : "Weight logged. Your recent trend shows steady progress. Keep tracking to see the full pattern.";
    }

    // Progress question
    if (lowerPrompt.includes('cómo voy') || lowerPrompt.includes('como voy') ||
        lowerPrompt.includes('progress') || lowerPrompt.includes('deficit') || lowerPrompt.includes('déficit') ||
        lowerPrompt.includes('how am i')) {
      return isSpanish
        ? "Hoy llevas un buen ritmo. Tu déficit actual está en línea con tu meta de perder ~0.5 kg/semana. Sigue registrando tus comidas para mantener el control."
        : "You're on a good pace today. Your current deficit is in line with your goal of losing ~0.5 kg/week. Keep logging your meals to stay on track.";
    }

    // Greetings
    if (lowerPrompt.includes('hello') || lowerPrompt.includes('hi') || lowerPrompt.includes('hey') ||
        lowerPrompt.includes('hola') || lowerPrompt.includes('buenos') || lowerPrompt.includes('buenas')) {
      return isSpanish
        ? "Hola. Soy NOVA, tu coach de déficit calórico. Puedes contarme qué comiste, qué ejercicio hiciste, o registrar tu peso. ¿En qué te ayudo?"
        : "Hello. I'm NOVA, your calorie deficit coach. You can tell me what you ate, what exercise you did, or log your weight. How can I help?";
    }

    // Default
    return isSpanish
      ? "Estoy aquí para ayudarte con tu déficit calórico. Cuéntame qué comiste o qué actividad hiciste, y te ayudo a calcular las calorías."
      : "I'm here to help with your calorie deficit. Tell me what you ate or what activity you did, and I'll help calculate the calories.";
  }

  private detectSpanish(text: string): boolean {
    const spanishIndicators = [
      'hola', 'cómo', 'como', 'qué', 'que', 'hoy', 'día', 'dia',
      'comí', 'comi', 'entrené', 'entrene', 'dormí', 'dormi',
      'peso', 'energía', 'energia', 'buenos', 'buenas',
      'gracias', 'por favor', 'ayuda', 'puedes', 'tengo', 'estoy',
      'bien', 'mal', 'mucho', 'poco',
      'desayuno', 'almuerzo', 'almor', 'cena', 'comida',
      'correr', 'gimnasio', 'ejercicio', 'cansado', 'cansada',
      'sí', 'dale', 'ponle', 'bórralo', 'borralo',
    ];
    return spanishIndicators.some((word) => text.includes(word));
  }

  private getMockIntent(message: string): MessageIntent {
    const lower = message.toLowerCase();

    // Confirmation detection (check first as it's context-sensitive)
    const confirmWords = ['sí', 'si', 'ok', 'dale', 'perfecto', 'está bien', 'esta bien', 'yes', 'confirm', 'ponle', 'cámbialo', 'cambialo', 'no', 'bórralo', 'borralo', 'quítalo', 'quitalo', 'cancel'];
    if (confirmWords.some((w) => lower === w || lower.startsWith(w + ' ') || lower.startsWith(w + ','))) {
      return 'confirmation';
    }

    // Questions about food/exercise (check BEFORE meal/activity detection)
    const questionPatterns = [
      'qué podría', 'que podría', 'qué podria', 'que podria',
      'qué debería', 'que debería', 'qué deberia', 'que deberia',
      'qué puedo', 'que puedo', 'qué como', 'que como',
      'what should', 'what could', 'what can i', 'how much should',
      'cuánto puedo', 'cuanto puedo', 'cuántas calorías', 'cuantas calorias',
      'recomienda', 'me recomiendas', 'sugieres', 'suggest', 'recommend',
      'qué porción', 'que porción', 'qué porcion', 'que porcion',
      'cuánto debería', 'cuanto debería', 'cuánto deberia', 'cuanto deberia',
      'es buena idea', 'is it ok', 'está bien si', 'esta bien si',
      'puedo comer', 'debería comer', 'deberia comer',
    ];
    if (questionPatterns.some((p) => lower.includes(p)))
      return 'question';

    // Profile setup - user providing multiple profile fields (height, weight, age, sex)
    // Check if message contains at least 3 of: height (cm/mido), weight (kg/peso), age (años), sex (hombre/mujer)
    const hasHeight = /\d+\s*(cm|centimetros?)|mido\s*\d+/i.test(message);
    const hasWeight = /\d+\s*(kg|kilos?)|peso\s*\d+/i.test(message);
    const hasAge = /\d+\s*años?|tengo\s*\d+/i.test(message);
    const hasSex = /(soy\s*)?(hombre|mujer|masculino|femenino|male|female)/i.test(message);
    const profileFieldCount = [hasHeight, hasWeight, hasAge, hasSex].filter(Boolean).length;
    if (profileFieldCount >= 3) {
      return 'profile_setup';
    }

    // Goal setting (check before weight_log since both may contain "kg")
    const goalPatterns = ['mi meta', 'my goal', 'quiero llegar', 'quiero pesar', 'goal weight',
      'target weight', 'quiero perder', 'want to lose', 'por semana', 'per week',
      'weekly goal', 'meta de peso', 'objetivo de peso'];
    if (goalPatterns.some((p) => lower.includes(p)))
      return 'goal_set';

    // Weight logging
    if (lower.includes('kg') || lower.includes('lb') || lower.includes('weigh') ||
        lower.includes('peso') || lower.includes('kilos'))
      return 'weight_log';

    // Activity logging (check BEFORE meal_log to avoid "camine despues de almuerzo" being classified as meal)
    if (lower.includes('workout') || lower.includes('exercise') || lower.includes('gym') ||
        lower.includes('run') || lower.includes('running') ||
        lower.includes('entrené') || lower.includes('entrene') || lower.includes('ejercicio') ||
        lower.includes('correr') || lower.includes('corrí') || lower.includes('gimnasio') ||
        lower.includes('pesas') || lower.includes('cardio') || lower.includes('nadar') ||
        lower.includes('bici') || lower.includes('caminé') || lower.includes('camine'))
      return 'activity_log';

    // Meal logging
    const mealVerbs = [
      'ate', 'eaten', 'eating', 'meal', 'food', 'snack',
      'breakfast', 'lunch', 'dinner',
      'comí', 'comi', 'comida', 'comiendo', 'merendé', 'merende',
      'desayuné', 'desayune', 'desayuno', 'almorcé', 'almorce', 'almuerzo', 'almor',
      'cené', 'cene', 'cena', 'merienda', 'tomé', 'tome',
    ];
    const foodItems = [
      'pollo', 'arroz', 'huevos', 'pan', 'pasta', 'pizza', 'tortilla',
      'carne', 'pescado', 'ensalada', 'sopa', 'frijoles', 'sandwich',
      'torta', 'yogurt', 'cereal', 'fruta', 'leche', 'queso', 'café',
      'plátano', 'platano', 'banana', 'manzana', 'naranja', 'avena',
      'tacos', 'burrito', 'empanada', 'arepa', 'pupusa', 'tamales',
      'galletas', 'chocolate', 'helado', 'jugo', 'licuado', 'batido',
      'aguacate', 'avocado', 'atún', 'atun', 'tuna', 'jamón', 'jamon',
      'papas', 'papa', 'patata', 'camote', 'yuca', 'choclo', 'elote',
      'lentejas', 'garbanzos', 'quinoa', 'granola', 'nueces', 'almendras',
      'mantequilla', 'mermelada', 'miel', 'azúcar', 'azucar',
      'chicken', 'rice', 'eggs', 'bread', 'salad', 'soup', 'beans',
      'beef', 'fish', 'fruit', 'cake', 'oatmeal', 'cheese', 'milk',
    ];
    if (mealVerbs.some((w) => lower.includes(w)) || foodItems.some((w) => lower.includes(w)))
      return 'meal_log';

    // Questions
    if (lower.includes('?') || lower.includes('cómo voy') || lower.includes('como voy') ||
        lower.includes('qué puedes') || lower.includes('que puedes') ||
        lower.includes('how am') || lower.includes('what can'))
      return 'question';

    // Greetings
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

      case 'meal_log': {
        const items: CalorieEntryItem[] = [];
        const foodCalories: Record<string, number> = {
          pollo: 250, chicken: 250,
          arroz: 200, rice: 200,
          ensalada: 80, salad: 80,
          huevos: 150, eggs: 150, huevo: 80,
          pan: 120, bread: 120,
          pasta: 350, fideos: 350,
          torta: 400, cake: 400,
          pizza: 300,
          pescado: 200, fish: 200,
          carne: 300, beef: 300, meat: 300,
          frijoles: 150, beans: 150,
          tortilla: 100,
          sandwich: 350,
          sopa: 150, soup: 150,
          fruta: 80, fruit: 80,
          yogurt: 120,
          cereal: 200,
          // Frutas
          'plátano': 105, platano: 105, banana: 105,
          manzana: 95, apple: 95,
          naranja: 65, orange: 65,
          uvas: 70, grapes: 70,
          piña: 80, pineapple: 80,
          mango: 100, papaya: 60, sandía: 50, melón: 50,
          fresa: 50, strawberry: 50, durazno: 60, pera: 60,
          // Lácteos
          leche: 120, milk: 120, queso: 110, cheese: 110,
          'café': 5, cafe: 5, coffee: 5,
          // Granos y cereales
          avena: 150, oatmeal: 150, granola: 200,
          quinoa: 180,
          // Comida latina
          tacos: 250, burrito: 400, empanada: 300,
          arepa: 200, pupusa: 250, tamales: 300, tostada: 150,
          // Snacks y postres
          galletas: 150, chocolate: 200, helado: 250,
          // Bebidas
          jugo: 120, licuado: 200, batido: 250, smoothie: 250,
          // Vegetales y otros
          aguacate: 160, avocado: 160,
          'atún': 150, atun: 150, tuna: 150,
          'jamón': 150, jamon: 150,
          papas: 200, papa: 130, patata: 130,
          camote: 120, yuca: 150,
          lentejas: 180, garbanzos: 180,
          nueces: 200, almendras: 170,
          mantequilla: 100, butter: 100,
          miel: 60, honey: 60,
        };

        for (const [food, cal] of Object.entries(foodCalories)) {
          if (lower.includes(food)) {
            items.push({ name: food, calories: cal });
          }
        }

        if (items.length === 0) {
          items.push({ name: 'comida', calories: 500 });
        }

        const totalCalories = items.reduce((sum, item) => sum + item.calories, 0);
        return { items, totalCalories };
      }

      case 'activity_log': {
        // Extract duration
        const durationMatch = message.match(/(\d+)\s*(min|minutos?|minutes?|hrs?|horas?|hours?)/i);
        let durationMinutes = 30;
        if (durationMatch) {
          const value = parseInt(durationMatch[1], 10);
          const unit = durationMatch[2].toLowerCase();
          durationMinutes = unit.startsWith('h') ? value * 60 : value;
        }

        // Estimate MET based on activity
        let met = 5;
        let activity = 'ejercicio general';
        if (lower.includes('corr') || lower.includes('run')) { met = 8; activity = 'correr'; }
        else if (lower.includes('pesas') || lower.includes('gym') || lower.includes('gimnasio') || lower.includes('weights')) { met = 5.5; activity = 'pesas'; }
        else if (lower.includes('nadar') || lower.includes('swim')) { met = 7; activity = 'nadar'; }
        else if (lower.includes('bici') || lower.includes('cycl')) { met = 7; activity = 'ciclismo'; }
        else if (lower.includes('camin') || lower.includes('walk')) { met = 3.5; activity = 'caminar'; }
        else if (lower.includes('yoga')) { met = 3; activity = 'yoga'; }

        const weight = 70; // default
        const caloriesBurned = Math.round(met * weight * (durationMinutes / 60));

        return {
          activity,
          durationMinutes,
          caloriesBurned,
          items: [{ name: `${activity} (${durationMinutes} min)`, calories: caloriesBurned }],
        };
      }

      case 'goal_set': {
        let goalWeight: number | null = null;
        let weeklyGoal: number | null = null;
        let targetWeeks: number | null = null;

        // Try to extract goal weight: "llegar a 70 kg", "goal weight 70", "quiero pesar 65"
        const goalWeightMatch = message.match(/(?:llegar a|pesar|goal weight|target weight|meta.*?)\s*(\d+\.?\d*)\s*(kg|lb|kilos)?/i);
        if (goalWeightMatch) {
          const val = parseFloat(goalWeightMatch[1]);
          const unit = goalWeightMatch[2]?.toLowerCase();
          goalWeight = unit === 'lb' ? val * 0.453592 : val;
        }

        // Try to extract weekly goal: "perder 0.5 por semana", "lose 1 kg per week"
        const weeklyMatch = message.match(/(?:perder|lose|bajar)\s*(\d+\.?\d*)\s*(?:kg|kilos?)?\s*(?:por semana|per week|a la semana|semanal)/i);
        if (weeklyMatch) {
          weeklyGoal = parseFloat(weeklyMatch[1]);
        }

        // Try to extract target weeks: "en 20 semanas", "in 20 weeks"
        const weeksMatch = message.match(/(?:en\s+)?(\d+)\s*semanas?|(\d+)\s*weeks?/i);
        if (weeksMatch) {
          targetWeeks = parseInt(weeksMatch[1] || weeksMatch[2], 10);
        }

        return { goalWeight, weeklyGoal, targetWeeks };
      }

      case 'profile_setup': {
        let weight: number | null = null;
        let height: number | null = null;
        let age: number | null = null;
        let sex: 'male' | 'female' | null = null;
        let goalWeight: number | null = null;

        // Extract weight: "peso 85 kg", "85 kg", "85 kilos"
        const weightMatch = message.match(/(?:peso\s*)?(\d+\.?\d*)\s*(kg|kilos?)/i);
        if (weightMatch) {
          weight = parseFloat(weightMatch[1]);
        }

        // Extract height: "mido 175 cm", "175 cm", "1.75 m"
        const heightMatch = message.match(/(?:mido\s*)?(\d+\.?\d*)\s*(cm|centimetros?|m(?:etros?)?)/i);
        if (heightMatch) {
          let h = parseFloat(heightMatch[1]);
          const unit = heightMatch[2].toLowerCase();
          if (unit === 'm' || unit === 'metros' || unit === 'metro') {
            h = h * 100; // Convert meters to cm
          }
          height = Math.round(h);
        }

        // Extract age: "tengo 32 años", "32 años"
        const ageMatch = message.match(/(?:tengo\s*)?(\d+)\s*años?/i);
        if (ageMatch) {
          age = parseInt(ageMatch[1], 10);
        }

        // Extract sex: "soy hombre", "mujer", "masculino", "femenino"
        const sexMatch = message.match(/(?:soy\s*)?(hombre|mujer|masculino|femenino|male|female)/i);
        if (sexMatch) {
          const s = sexMatch[1].toLowerCase();
          sex = (s === 'hombre' || s === 'masculino' || s === 'male') ? 'male' : 'female';
        }

        // Extract goal weight: "quiero llegar a 75 kg", "meta 75", "llegar a 75"
        const goalMatch = message.match(/(?:quiero\s+)?(?:llegar\s+a|pesar|meta)\s*(\d+\.?\d*)\s*(kg|kilos?)?/i);
        if (goalMatch) {
          goalWeight = parseFloat(goalMatch[1]);
        }

        return { weight, height, age, sex, goalWeight };
      }

      default:
        return {};
    }
  }

  private extractItemsFromPrompt(prompt: string): { items: CalorieEntryItem[]; total: number } {
    const items: CalorieEntryItem[] = [];
    // Look for "Estimado: item: ~X kcal" patterns from agent insights
    const estimadoMatches = prompt.matchAll(/(?:Estimado|Data).*?(\{[^}]*"items"\s*:\s*\[.*?\].*?\})/gs);
    for (const match of estimadoMatches) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.items) {
          return { items: parsed.items, total: parsed.totalCalories || parsed.items.reduce((s: number, i: CalorieEntryItem) => s + i.calories, 0) };
        }
      } catch { /* ignore parse errors */ }
    }

    // Try extracting from Data: JSON blocks
    const dataMatch = prompt.match(/Data:\s*(\{[\s\S]*?\})\n/);
    if (dataMatch) {
      try {
        const parsed = JSON.parse(dataMatch[1]);
        if (parsed.items && Array.isArray(parsed.items)) {
          const total = parsed.totalCalories || parsed.caloriesBurned || parsed.items.reduce((s: number, i: CalorieEntryItem) => s + i.calories, 0);
          return { items: parsed.items, total };
        }
      } catch { /* ignore parse errors */ }
    }

    // Try extracting individual "- item: ~X kcal" lines from insights
    const insightMatches = prompt.matchAll(/- Estimado:\s*(.+?):\s*~?(\d+)\s*kcal/g);
    for (const match of insightMatches) {
      items.push({ name: match[1].trim(), calories: parseInt(match[2], 10) });
    }

    // Try extracting "Total estimado: X kcal"
    const totalMatch = prompt.match(/Total estimado:\s*(\d+)\s*kcal/);
    const total = totalMatch ? parseInt(totalMatch[1], 10) : items.reduce((s, i) => s + i.calories, 0);

    return { items, total };
  }

  private extractSummaryFromPrompt(prompt: string): { intake: number; burn: number; deficit: number } | null {
    const intakeMatch = prompt.match(/Consumed:\s*(\d+)\s*kcal/);
    const burnMatch = prompt.match(/Burned \(exercise\):\s*(\d+)\s*kcal/);
    const deficitMatch = prompt.match(/Current deficit:\s*(-?\d+)\s*kcal/);
    if (intakeMatch && burnMatch && deficitMatch) {
      return {
        intake: parseInt(intakeMatch[1], 10),
        burn: parseInt(burnMatch[1], 10),
        deficit: parseInt(deficitMatch[1], 10),
      };
    }
    return null;
  }

  private getMockConfirmation(message: string): ConfirmationResult {
    const lower = message.toLowerCase().trim();

    // Check for rejection
    if (lower === 'no' || lower.includes('bórralo') || lower.includes('borralo') ||
        lower.includes('quítalo') || lower.includes('quitalo') || lower.includes('cancel') ||
        lower.includes('delete')) {
      return { action: 'reject' };
    }

    // Check for adjustment
    const adjustMatch = message.match(/(?:ponle|cámbialo a|cambialo a|son|were|make it)\s*(\d+)/i);
    if (adjustMatch) {
      return {
        action: 'adjust',
        adjustedCalories: parseInt(adjustMatch[1], 10),
      };
    }

    // Default: confirm
    return { action: 'confirm' };
  }
}
