import { Injectable } from '@nestjs/common';
import type {
  AgentOutput,
  AgentContext,
  FinalResponse,
  ResponseTone,
  MessageIntent,
  DailySummary,
} from '@nova/types';
import { BaseAgent, AgentInput } from './base-agent.abstract';
import { ClaudeClientService, ClaudeMessage } from '../claude-client/claude-client.service';

export interface IntegratorInput extends AgentInput {
  intent: MessageIntent;
  agentOutputs: AgentOutput[];
  dailySummary?: DailySummary;
}

@Injectable()
export class IntegratorAgentService extends BaseAgent {
  constructor(claudeClient: ClaudeClientService) {
    super('integrator', claudeClient);
  }

  protected getSystemPrompt(): string {
    return `You are NOVA, a calorie deficit coach that helps users lose weight by tracking their food intake and physical activity.

## CRITICAL: Language Rule
- ALWAYS respond in the SAME LANGUAGE as the user's message
- If the user writes in Spanish, respond ENTIRELY in Spanish
- If the user writes in English, respond in English

## Your Role
Help users maintain a caloric deficit by:
- Estimating calories in their meals
- Estimating calories burned in activities
- Tracking their daily deficit
- Providing weight trend analysis

## Communication Style
- Calm and supportive, never pushy
- Data-driven but not robotic
- Brief (max 6-8 lines)
- When presenting calorie estimates, ALWAYS ask for confirmation

## Response Structure for meal/activity logs:
1. Present the calorie estimate with item breakdown
2. Ask: "¿Te parece bien?" / "Does this look right?"
3. Mention how it fits in their daily goal

## For questions about progress:
1. Show current daily summary (intake/burn/deficit)
2. Contextualize with weekly projection
3. One actionable suggestion

Never use excessive exclamation marks or hype language.
Always ground responses in the user's actual data.`;
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
    const { message, context, intent, agentOutputs, dailySummary } = input;

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

    if (intent === 'meal_log' || intent === 'activity_log') {
      prompt += `Present the calorie estimate clearly with item breakdown.
Then ask for confirmation: "${isSpanish ? '¿Te parece bien?' : 'Does this look right?'}"
Briefly mention where they stand for the day.`;
    } else if (intent === 'weight_log') {
      prompt += `Acknowledge the weight entry. Show trend if available. Keep it brief.`;
    } else if (intent === 'question') {
      prompt += `Answer the question using the data available. Focus on deficit progress.`;
    } else {
      prompt += `Respond naturally. If appropriate, mention they can log meals or activities.
Keep it conversational and brief (max 6 lines).`;
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
