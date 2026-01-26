import { Injectable } from '@nestjs/common';
import type {
  AgentOutput,
  AgentContext,
  FinalResponse,
  ResponseTone,
  MessageIntent,
} from '@nova/types';
import { BaseAgent, AgentInput } from './base-agent.abstract';
import { ClaudeClientService, ClaudeMessage } from '../claude-client/claude-client.service';

export interface IntegratorInput extends AgentInput {
  intent: MessageIntent;
  agentOutputs: AgentOutput[];
}

@Injectable()
export class IntegratorAgentService extends BaseAgent {
  constructor(claudeClient: ClaudeClientService) {
    super('integrator', claudeClient);
  }

  protected getSystemPrompt(): string {
    return `You are NOVA, an AI health coach that helps users optimize their energy and wellbeing.

## Your Role
Synthesize insights from specialized analysis into one clear, helpful response.

## Communication Style
- Calm and supportive, never pushy
- Data-driven but not robotic
- Brief (max 6-8 lines)
- One clear action item when relevant

## Response Structure
1. Acknowledge the user's input (1 line)
2. Share the key insight (1-2 lines)
3. Suggest next step if appropriate (1 line)

## Tone Guidelines
- "calm": For routine check-ins and data logging
- "encouraging": When user shows progress or effort
- "informative": When answering questions or explaining patterns

Never use:
- Excessive exclamation marks
- Words like "amazing", "awesome", "fantastic"
- More than one emoji per response
- Medical advice or diagnoses

Always ground responses in the user's actual data.`;
  }

  protected validateInput(input: AgentInput): boolean {
    return true; // Integrator accepts all inputs
  }

  async process(input: AgentInput): Promise<AgentOutput> {
    // This is not used directly - use integrate() instead
    return this.createOutput();
  }

  async integrate(input: IntegratorInput): Promise<FinalResponse> {
    this.logger.debug(
      `Integrating ${input.agentOutputs.length} agent outputs for user ${input.context.user.id}`,
    );

    const tone = this.determineTone(input);
    const conversationHistory = this.buildConversationHistory(input.context);

    // Build integration prompt
    const prompt = this.buildIntegrationPrompt(input);

    // Get Claude's integrated response
    const response = await this.claudeClient.generateResponse(prompt, {
      systemPrompt: this.getSystemPrompt(),
      maxTokens: 400,
      temperature: 0.7,
      conversationHistory,
    });

    // Extract action items and next steps
    const { message, actionItems, nextSteps } = this.parseResponse(response);

    // Calculate NOVA points earned
    const novaPointsEarned = this.calculateNovaPoints(input);

    return {
      message,
      tone,
      actionItems,
      nextSteps,
      novaPointsEarned,
    };
  }

  private determineTone(input: IntegratorInput): ResponseTone {
    const { intent, agentOutputs } = input;

    // Encouraging tone for progress
    const hasPositiveProgress = agentOutputs.some(
      (output) =>
        output.insights.some(
          (i) =>
            i.toLowerCase().includes('progress') ||
            i.toLowerCase().includes('improvement') ||
            i.toLowerCase().includes('on track'),
        ),
    );

    if (hasPositiveProgress) {
      return 'encouraging';
    }

    // Informative tone for questions
    if (intent === 'question') {
      return 'informative';
    }

    // Calm tone for routine logging
    return 'calm';
  }

  private buildConversationHistory(context: AgentContext): ClaudeMessage[] {
    return context.conversationHistory.slice(-10).map((msg) => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));
  }

  private buildIntegrationPrompt(input: IntegratorInput): string {
    const { message, context, intent, agentOutputs } = input;

    let prompt = `## User Message
"${message}"

## Message Intent
${intent}

## User Context
- Name: ${context.user.name}
- Goal: ${context.profile?.objective?.replace('_', ' ') || 'general wellness'}
- Current date: ${context.currentDate.toLocaleDateString()}
`;

    if (agentOutputs.length > 0) {
      prompt += '\n## Analysis from Specialized Agents\n';

      agentOutputs.forEach((output) => {
        prompt += `\n### ${output.agentType.charAt(0).toUpperCase() + output.agentType.slice(1)} Analysis (confidence: ${(output.confidence * 100).toFixed(0)}%)\n`;

        if (output.insights.length > 0) {
          prompt += 'Insights:\n';
          output.insights.forEach((insight) => {
            prompt += `- ${insight}\n`;
          });
        }

        if (output.recommendations.length > 0) {
          prompt += 'Recommendations:\n';
          output.recommendations.forEach((rec) => {
            prompt += `- ${rec}\n`;
          });
        }

        if (Object.keys(output.dataPoints).length > 0) {
          prompt += `Data: ${JSON.stringify(output.dataPoints)}\n`;
        }
      });
    }

    prompt += `
## Your Task
Create a unified response that:
1. Acknowledges the user's input naturally
2. Incorporates the most relevant insight from the analysis
3. Ends with one specific, actionable suggestion if appropriate

Keep it conversational and brief (max 6 lines).
If suggesting an action, format it clearly on its own line starting with "→"`;

    return prompt;
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

      // Detect action items (lines starting with → or - [ ])
      if (trimmed.startsWith('→') || trimmed.startsWith('- [ ]')) {
        actionItems.push(trimmed.replace(/^[→\-\[\]\s]+/, '').trim());
      }
      // Detect next steps (lines with "next:" or "try:")
      else if (
        trimmed.toLowerCase().includes('next:') ||
        trimmed.toLowerCase().includes('try:')
      ) {
        nextSteps.push(trimmed);
      }
      // Regular message content
      else {
        messageLines.push(trimmed);
      }
    });

    return {
      message: messageLines.join('\n'),
      actionItems: actionItems.slice(0, 3),
      nextSteps: nextSteps.slice(0, 2),
    };
  }

  private calculateNovaPoints(input: IntegratorInput): number {
    const basePoints: Record<MessageIntent, number> = {
      weight_log: 15,
      meal_log: 10,
      workout_log: 20,
      sleep_log: 15,
      energy_check: 5,
      question: 2,
      greeting: 0,
      general: 3,
    };

    let points = basePoints[input.intent] || 0;

    // Bonus for providing image
    if (input.extractedData?.imageUrl) {
      points += 5;
    }

    // Bonus for detailed data
    const dataKeys = Object.keys(input.extractedData || {});
    if (dataKeys.length >= 3) {
      points += 5;
    }

    // Streak bonus (would be calculated from recent entries in production)
    const recentDays = new Set(
      input.context.recentEntries.map((e) =>
        new Date(e.date).toDateString(),
      ),
    );
    if (recentDays.size >= 3) {
      points += 10; // 3+ day streak bonus
    }

    return points;
  }
}
