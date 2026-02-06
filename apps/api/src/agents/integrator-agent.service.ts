import { Injectable } from '@nestjs/common';
import type {
  AgentOutput,
  AgentContext,
  FinalResponse,
  ResponseTone,
  MessageIntent,
  DailySummary,
  CalorieEntryItem,
} from '@nova/types';
import { BaseAgent, AgentInput } from './base-agent.abstract';
import { ClaudeClientService, ClaudeMessage } from '../claude-client/claude-client.service';

export interface LastWeightLogInfo {
  weight: number;
  date: Date;
  daysSince: number;
}

export interface IntegratorInput extends AgentInput {
  intent: MessageIntent;
  agentOutputs: AgentOutput[];
  dailySummary?: DailySummary;
  lastWeightLog?: LastWeightLogInfo;
  needsWeightPrompt: boolean;
  isProfileIncomplete?: boolean;
  isNewUser?: boolean;
  hasDefaultProfileData?: boolean; // true if height=170, age=30 (default values)
}

@Injectable()
export class IntegratorAgentService extends BaseAgent {
  constructor(claudeClient: ClaudeClientService) {
    super('integrator', claudeClient);
  }

  protected getSystemPrompt(): string {
    return `You are NOVA, a calorie deficit coach. You help users lose weight by tracking food intake and physical activity.

## CRITICAL RULES
1. LANGUAGE: ALWAYS respond in the SAME language as the user's message. Spanish message = Spanish response. English message = English response.
2. You MUST use the calorie data provided in the "Analysis from Specialized Agents" section. NEVER say you couldn't detect nutrition data — the data is always provided.
3. Entries are AUTO-REGISTERED. Do NOT ask for confirmation. Tell the user their meal/activity has been registered.

## Response Format for meal/activity logs:
- List each food item with its estimated calories
- Show the total
- Show today's running totals (consumed / burned / deficit)
- Keep it to 4-6 lines max

## Response Format for questions:
- Show daily summary (intake/burn/deficit)
- One brief insight or suggestion

Be calm, data-driven, brief. No hype language.`;
  }

  protected validateInput(input: AgentInput): boolean {
    return true;
  }

  async process(input: AgentInput): Promise<AgentOutput> {
    return this.createOutput();
  }

  async integrate(input: IntegratorInput): Promise<FinalResponse> {
    this.logger.debug(
      `Integrating ${input.agentOutputs.length} agent outputs for user ${input.context.user.id}`,
    );

    const tone = this.determineTone(input);

    // For meal/activity logs, build response directly from data (don't rely on LLM)
    if (input.intent === 'meal_log' || input.intent === 'activity_log') {
      const message = this.buildDataResponse(input);
      return { message, tone, dailySummary: input.dailySummary };
    }

    // For other intents, use LLM
    const conversationHistory = this.buildConversationHistory(input.context);
    const prompt = this.buildIntegrationPrompt(input);

    const response = await this.claudeClient.generateResponse(prompt, {
      systemPrompt: this.getSystemPrompt(),
      maxTokens: 400,
      temperature: 0.7,
      conversationHistory,
    });

    const { message, actionItems, nextSteps } = this.parseResponse(response);

    return {
      message,
      tone,
      actionItems,
      nextSteps,
      dailySummary: input.dailySummary,
    };
  }

  private buildDataResponse(input: IntegratorInput): string {
    const isSpanish = this.detectSpanishMessage(input.message);
    const { intent, agentOutputs, dailySummary } = input;

    // Extract items from agent outputs or extracted data
    const items: CalorieEntryItem[] = this.extractItems(input);
    const totalCalories = items.reduce((sum, i) => sum + i.calories, 0);

    const lines: string[] = [];

    if (intent === 'meal_log') {
      lines.push(isSpanish ? 'Registrado:' : 'Logged:');
      if (items.length > 0) {
        items.forEach((item) => {
          lines.push(`- ${item.name}: ~${item.calories} kcal`);
        });
        lines.push('');
        lines.push(isSpanish
          ? `Total: ~${totalCalories} kcal`
          : `Total: ~${totalCalories} kcal`);
      }
    } else {
      // activity_log
      lines.push(isSpanish ? 'Actividad registrada:' : 'Activity logged:');
      if (items.length > 0) {
        items.forEach((item) => {
          lines.push(`- ${item.name}: ~${item.calories} kcal`);
        });
        lines.push('');
        lines.push(isSpanish
          ? `Total quemado: ~${totalCalories} kcal`
          : `Total burned: ~${totalCalories} kcal`);
      }
    }

    if (dailySummary) {
      lines.push('');
      lines.push(isSpanish
        ? `Hoy: ${dailySummary.intake} kcal consumidas | ${dailySummary.burn} kcal quemadas | Déficit: ${dailySummary.deficit} kcal`
        : `Today: ${dailySummary.intake} kcal consumed | ${dailySummary.burn} kcal burned | Deficit: ${dailySummary.deficit} kcal`);
    }

    return lines.join('\n');
  }

  private extractItems(input: IntegratorInput): CalorieEntryItem[] {
    // Try extracted data first
    const extractedItems = input.extractedData?.items as CalorieEntryItem[] | undefined;
    if (extractedItems && extractedItems.length > 0) {
      return extractedItems;
    }

    // Try agent outputs
    for (const output of input.agentOutputs) {
      const agentItems = output.dataPoints?.items as CalorieEntryItem[] | undefined;
      if (agentItems && agentItems.length > 0) {
        return agentItems;
      }
    }

    return [];
  }

  private determineTone(input: IntegratorInput): ResponseTone {
    const { intent, agentOutputs } = input;

    const hasPositiveProgress = agentOutputs.some(
      (output) =>
        output.insights.some(
          (i) =>
            i.toLowerCase().includes('progress') ||
            i.toLowerCase().includes('buen progreso') ||
            i.toLowerCase().includes('on track'),
        ),
    );

    if (hasPositiveProgress) return 'encouraging';
    if (intent === 'question') return 'informative';
    return 'calm';
  }

  private buildConversationHistory(context: AgentContext): ClaudeMessage[] {
    return context.conversationHistory.slice(-10).map((msg) => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));
  }

  private buildIntegrationPrompt(input: IntegratorInput): string {
    const { message, context, intent, agentOutputs, dailySummary, lastWeightLog, needsWeightPrompt } = input;

    let prompt = `## User Message
"${message}"

## Message Intent
${intent}

## User Context
- Name: ${context.user.name}
- Weight: ${context.profile?.weight || 'unknown'} kg
- TDEE: ${dailySummary?.tdee || 'unknown'} kcal
- Current date: ${context.currentDate.toLocaleDateString()}
`;

    if (dailySummary) {
      prompt += `
## Today's Progress
- Consumed: ${dailySummary.intake} kcal
- Burned (exercise): ${dailySummary.burn} kcal
- TDEE: ${dailySummary.tdee} kcal
- Current deficit: ${dailySummary.deficit} kcal
- Target deficit: ${dailySummary.targetDeficit} kcal
`;
    }

    // Weight context
    if (lastWeightLog && dailySummary?.goalWeight != null) {
      const remaining = (lastWeightLog.weight - dailySummary.goalWeight).toFixed(1);
      prompt += `
## Weight Progress
- Last weight: ${lastWeightLog.weight} kg (${lastWeightLog.daysSince} days ago)
- Goal: ${dailySummary.goalWeight} kg
- Remaining: ${remaining} kg
`;
      if (dailySummary.weightProgress?.estimatedWeeks != null && dailySummary.weightProgress.estimatedWeeks > 0) {
        prompt += `- Estimated weeks to goal: ${dailySummary.weightProgress.estimatedWeeks}\n`;
      }
    } else if (lastWeightLog) {
      prompt += `
## Weight Info
- Last weight: ${lastWeightLog.weight} kg (${lastWeightLog.daysSince} days ago)
`;
    }

    if (agentOutputs.length > 0) {
      prompt += '\n## Analysis from Specialized Agents\n';

      agentOutputs.forEach((output) => {
        prompt += `\n### ${output.agentType} Analysis\n`;

        if (output.insights.length > 0) {
          output.insights.forEach((insight) => {
            prompt += `- ${insight}\n`;
          });
        }

        if (output.recommendations.length > 0) {
          output.recommendations.forEach((rec) => {
            prompt += `- Rec: ${rec}\n`;
          });
        }

        if (Object.keys(output.dataPoints).length > 0) {
          prompt += `Data: ${JSON.stringify(output.dataPoints)}\n`;
        }
      });
    }

    const isSpanish = this.detectSpanishMessage(message);

    prompt += `
## Language Requirement
Respond ENTIRELY in ${isSpanish ? 'SPANISH' : 'ENGLISH'}.

## Your Task
`;

    if (intent === 'meal_log') {
      prompt += `The meal has been REGISTERED. Your response MUST:
1. Say the meal was registered (${isSpanish ? '"Registrado:"' : '"Logged:"'})
2. List EACH item with calories from the agent analysis above (e.g. "- carne: ~300 kcal")
3. Show the total calories
4. Show today's totals from "Today's Progress" above (consumed/burned/deficit)
DO NOT say you couldn't detect data. The data IS in the agent analysis above. USE IT.`;
    } else if (intent === 'activity_log') {
      prompt += `The activity has been REGISTERED. Your response MUST:
1. Say the activity was registered (${isSpanish ? '"Registrado:"' : '"Logged:"'})
2. Show calories burned from the agent analysis above
3. Show today's totals from "Today's Progress" above (consumed/burned/deficit)
DO NOT say you couldn't detect data. The data IS in the agent analysis above. USE IT.`;
    } else if (intent === 'goal_set') {
      let goalTask = `Acknowledge the goal update.`;
      const hasExplicitPace = context.profile?.targetWeeks || (input.extractedData?.weeklyGoal != null) || (input.extractedData?.targetWeeks != null);

      if (hasExplicitPace && dailySummary?.weightProgress?.estimatedWeeks != null && dailySummary.weightProgress.estimatedWeeks > 0) {
        goalTask += ` The estimated timeline to reach the goal is ~${dailySummary.weightProgress.estimatedWeeks} weeks. Mention this timeline.`;
        if (context.profile?.targetWeeks) {
          goalTask += ` The user set a target of ${context.profile.targetWeeks} weeks.`;
        }
        // If user has set their pace but profile still has default values, ask for basic data
        if (input.hasDefaultProfileData) {
          goalTask += `

IMPORTANT: The user's profile is missing basic data (height, age, sex are still default values).
After acknowledging their goal, ask them to complete their profile so you can give accurate recommendations.
Ask for: height (cm), age (years), and sex (male/female).
Example: "Para darte recomendaciones más precisas, ¿podrías compartirme tu altura, edad y sexo? Por ejemplo: 'mido 175 cm, tengo 32 años, soy hombre'"`;
        }
      } else if (!hasExplicitPace && dailySummary?.goalWeight != null) {
        // User set goalWeight but not pace - ask them about their preferred pace
        goalTask += ` The user set their goal weight but did NOT specify a timeline or pace.
DO NOT mention any estimated weeks or timeline.
Instead, ask them at what pace they want to lose weight. Give them options like:
- "en cuánto tiempo?" or "a qué ritmo?"
- Example: "puedo perder 0.5 kg/semana" or "quiero lograrlo en 20 semanas"`;
      }
      goalTask += ` Keep it brief and encouraging.`;
      prompt += goalTask;
    } else if (intent === 'weight_log') {
      let weightTask = `Acknowledge the weight entry.`;
      if (input.isProfileIncomplete) {
        weightTask = `The user logged their weight: ${lastWeightLog?.weight || 'unknown'} kg. This appears to be a new user without a configured profile.
DO NOT mention any specific deficit or weekly loss targets. Instead:
1. Acknowledge the weight was recorded
2. Ask them to set their weight goal (target weight in kg)
3. Mention they can say something like "mi meta es llegar a X kg" or "quiero pesar X kg"
Keep it brief and encouraging.`;
      } else if (lastWeightLog && dailySummary?.goalWeight != null) {
        const remaining = (lastWeightLog.weight - dailySummary.goalWeight).toFixed(1);
        weightTask += ` The user logged ${lastWeightLog.weight} kg. Goal is ${dailySummary.goalWeight} kg. They have ${remaining} kg remaining.`;
        weightTask += ` Show trend if available. Keep it brief.`;
      } else {
        weightTask += ` Show trend if available. Keep it brief.`;
      }
      prompt += weightTask;
    } else if (intent === 'profile_setup') {
      prompt += `The user just provided their profile information. A profile has been created/updated with their data.

Your response MUST:
1. Thank them and confirm you've saved their information
2. Summarize what you recorded (weight, height, age, sex, goal weight - only mention what was provided)
3. Briefly explain how you'll help them (track food and activity to maintain deficit)
4. Encourage them to start by logging their first meal or activity

Keep it warm, welcoming, and brief (max 6 lines). This is their first interaction after setup.`;
    } else if (intent === 'entry_edit') {
      const deletedEntry = input.extractedData?.deletedEntry as {
        description: string;
        calories: number;
        items: CalorieEntryItem[];
        type: string;
      } | null;
      const deletedEntries = input.extractedData?.deletedEntries as Array<{
        description: string;
        calories: number;
        type: string;
      }> | undefined;
      const deletedCount = input.extractedData?.deletedCount as number | undefined;
      const todayEntries = input.extractedData?.todayEntries as Array<{
        index: number;
        description: string;
        calories: number;
        type: string;
      }> | undefined;

      if (deletedCount && deletedEntries) {
        // All entries were deleted
        const totalCals = deletedEntries.reduce((sum, e) => sum + e.calories, 0);
        prompt += `The user asked to delete ALL entries. ${deletedCount} entries have been DELETED (total: ${totalCals} kcal).

Your response MUST:
1. Confirm all ${deletedCount} entries were deleted
2. Mention the total calories removed
Keep it brief (max 3 lines).`;
      } else if (deletedEntry) {
        // Single entry deleted
        const itemsList = Array.isArray(deletedEntry.items)
          ? deletedEntry.items.map((i: CalorieEntryItem) => `${i.name}: ~${i.calories} kcal`).join(', ')
          : `${deletedEntry.calories} kcal`;
        prompt += `The user asked to edit/delete an entry. This entry has been DELETED:
- Description: "${deletedEntry.description}"
- Items: ${itemsList}
- Type: ${deletedEntry.type}

Your response MUST:
1. Confirm the entry was deleted
2. Briefly show what was deleted
3. Ask if they want to log a corrected version
Keep it brief (max 4 lines).`;
      } else if (todayEntries && todayEntries.length > 0) {
        // Could not determine which entry to delete - show list
        const entryList = todayEntries.map((e) =>
          `${e.index}. ${e.description} (${e.calories} kcal, ${e.type === 'intake' ? 'comida' : 'actividad'})`
        ).join('\n');
        prompt += `The user asked to delete an entry but we couldn't determine which one. Show them today's entries and ask which one to delete.

Today's entries:
${entryList}

Your response MUST:
1. ${isSpanish ? 'Show the numbered list and ask "¿Cuál quieres que borre? (indica el número)"' : 'Show the numbered list and ask "Which one should I delete? (give the number)"'}
Keep it brief.`;
      } else {
        prompt += `The user asked to edit/delete an entry but no entries were found for today.
Your response MUST tell them there are no entries to modify today. Keep it brief.`;
      }
    } else if (intent === 'question') {
      const remainingToEat = dailySummary ? (dailySummary.tdee + dailySummary.burn - dailySummary.targetDeficit - dailySummary.intake) : null;
      const isFoodQuestion = message.toLowerCase().match(/almorzar|cenar|desayunar|comer|snack|merienda|lunch|dinner|breakfast|eat|porción|porcion/);
      const isAskingAboutSpecificFood = message.toLowerCase().match(/frutos?\s*secos?|nueces|almendras|galletas?|chocolate|pizza|helado|pan\b|queso|yogur?t?|fruta|banana|manzana|chips|papas?|torta|postre|dulces?|refresco|soda|cerveza|vino|nuts|cookies?|ice cream|candy|maní|mani|cacahuate|snack/);

      if (isFoodQuestion && remainingToEat != null) {
        if (isAskingAboutSpecificFood) {
          prompt += `The user is asking about a SPECIFIC food: "${message}". Their remaining calorie budget is ${remainingToEat} kcal.

Your response MUST:
1. Give the typical calories PER PORTION of that specific food (e.g., "30g de frutos secos = ~180 kcal")
2. Recommend a reasonable portion size based on their budget
3. Say how much budget they'd have left after eating it
4. If it's a high-calorie food, suggest a lighter alternative if appropriate

Be specific to what they asked about. Don't give generic meal suggestions.`;
        } else {
          prompt += `The user is asking what they can eat. Their remaining calorie budget is ${remainingToEat} kcal.

Your response MUST:
1. State how many calories they have left to eat
2. Suggest 2-3 SPECIFIC meal options with estimated calories that fit their budget, for example:
   - Light option (~300-400 kcal): e.g., grilled chicken salad, vegetable soup
   - Medium option (~500-600 kcal): e.g., rice with beans and meat, pasta with vegetables
   - Heavier option (~700-800 kcal): e.g., full plate with protein, carbs, and sides
3. Mention how much budget they'd have left after each option

Be a helpful coach - give concrete, actionable suggestions, not just numbers.`;
        }
      } else {
        prompt += `Answer using the data available. Focus on deficit progress and daily summary. Be helpful and specific.`;
      }
    } else {
      // greeting or general
      let generalTask = `Respond naturally.`;

      // New user onboarding - ask for basic profile info
      if (input.isNewUser) {
        generalTask = `This is a NEW USER who doesn't have a profile yet. You need to collect their basic information to personalize their experience.

Your response MUST:
1. Greet them warmly and introduce yourself as NOVA, their calorie deficit coach
2. Explain you need some basic info to give personalized recommendations
3. Ask them to provide IN A SINGLE MESSAGE:
   - Their current weight (in kg)
   - Their height (in cm)
   - Their age
   - Their sex (male/female)
   - Their weight goal (target weight in kg)

Example response:
"¡Hola! Soy NOVA, tu coach de déficit calórico. Para darte recomendaciones personalizadas, necesito conocerte un poco mejor.

Por favor, compárteme en un solo mensaje:
- Tu peso actual (ej: 85 kg)
- Tu altura (ej: 175 cm)
- Tu edad (ej: 32 años)
- Tu sexo (hombre/mujer)
- Tu meta de peso (ej: quiero llegar a 75 kg)

Ejemplo: 'Peso 85 kg, mido 175 cm, tengo 32 años, soy hombre y quiero llegar a 75 kg'"

Keep it friendly and encouraging. Use Spanish.`;
      } else if (needsWeightPrompt && !lastWeightLog) {
        generalTask += ` The user has never logged their weight. Ask them to share their current weight so you can track their progress.`;
      } else if (needsWeightPrompt && lastWeightLog) {
        generalTask += ` The user hasn't logged their weight in ${lastWeightLog.daysSince} days. Suggest they weigh in today.`;
      }
      generalTask += ` If appropriate, mention they can log meals or activities.
Keep it conversational and brief (max 6 lines).`;
      prompt += generalTask;
    }

    return prompt;
  }

  private detectSpanishMessage(message: string): boolean {
    const lower = message.toLowerCase();
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
    return spanishIndicators.some((word) => lower.includes(word));
  }

  private parseResponse(response: string): {
    message: string;
    actionItems: string[];
    nextSteps: string[];
  } {
    const lines = response.split('\n').filter((line) => line.trim());

    const actionItems: string[] = [];
    const nextSteps: string[] = [];
    const messageLines: string[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('→') || trimmed.startsWith('- [ ]')) {
        actionItems.push(trimmed.replace(/^[→\-\[\]\s]+/, '').trim());
      } else if (
        trimmed.toLowerCase().includes('next:') ||
        trimmed.toLowerCase().includes('try:')
      ) {
        nextSteps.push(trimmed);
      } else {
        messageLines.push(trimmed);
      }
    });

    return {
      message: messageLines.join('\n'),
      actionItems: actionItems.slice(0, 3),
      nextSteps: nextSteps.slice(0, 2),
    };
  }
}
