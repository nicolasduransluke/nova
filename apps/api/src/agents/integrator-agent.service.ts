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
      if (dailySummary?.weightProgress?.estimatedWeeks != null && dailySummary.weightProgress.estimatedWeeks > 0) {
        goalTask += ` The estimated timeline to reach the goal is ~${dailySummary.weightProgress.estimatedWeeks} weeks. Mention this timeline.`;
      }
      if (context.profile?.targetWeeks) {
        goalTask += ` The user set a target of ${context.profile.targetWeeks} weeks.`;
      }
      goalTask += ` Keep it brief and encouraging.`;
      prompt += goalTask;
    } else if (intent === 'weight_log') {
      let weightTask = `Acknowledge the weight entry.`;
      if (lastWeightLog && dailySummary?.goalWeight != null) {
        const remaining = (lastWeightLog.weight - dailySummary.goalWeight).toFixed(1);
        weightTask += ` The user logged ${lastWeightLog.weight} kg. Goal is ${dailySummary.goalWeight} kg. They have ${remaining} kg remaining.`;
      }
      weightTask += ` Show trend if available. Keep it brief.`;
      prompt += weightTask;
    } else if (intent === 'question') {
      prompt += `Answer using the data available. Focus on deficit progress and daily summary.`;
    } else {
      // greeting or general
      let generalTask = `Respond naturally.`;
      if (needsWeightPrompt && !lastWeightLog) {
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
