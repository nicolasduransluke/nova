import { Logger } from '@nestjs/common';
import type { AgentContext, AgentOutput } from '@nova/types';
import { ClaudeClientService } from '../claude-client/claude-client.service';

export interface AgentInput {
  context: AgentContext;
  message: string;
  extractedData?: Record<string, unknown>;
}

export abstract class BaseAgent {
  protected readonly logger: Logger;
  protected readonly claudeClient: ClaudeClientService;

  constructor(
    protected readonly agentType: string,
    claudeClient: ClaudeClientService,
  ) {
    this.logger = new Logger(`${agentType}Agent`);
    this.claudeClient = claudeClient;
  }

  /**
   * Process input and return agent output
   * Must be implemented by each specific agent
   */
  abstract process(input: AgentInput): Promise<AgentOutput>;

  /**
   * Get the system prompt specific to this agent
   */
  protected abstract getSystemPrompt(): string;

  /**
   * Validate that the input is appropriate for this agent
   */
  protected abstract validateInput(input: AgentInput): boolean;

  /**
   * Build the prompt to send to Claude
   */
  protected buildPrompt(input: AgentInput): string {
    const contextPrompt = this.claudeClient.buildContextPrompt(input.context);
    const dataSection = input.extractedData
      ? `\n## Extracted Data\n${JSON.stringify(input.extractedData, null, 2)}`
      : '';

    return `${contextPrompt}${dataSection}

## Current Message
${input.message}

Please analyze and provide your assessment.`;
  }

  /**
   * Create a default output structure
   */
  protected createOutput(
    partial: Partial<AgentOutput> = {},
  ): AgentOutput {
    return {
      agentType: this.agentType,
      insights: [],
      recommendations: [],
      dataPoints: {},
      confidence: 0.5,
      ...partial,
    };
  }

  /**
   * Parse Claude's response into structured insights
   */
  protected parseInsights(response: string): string[] {
    // Split by newlines and filter meaningful lines
    const lines = response
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !line.startsWith('#'))
      .filter((line) => !line.startsWith('-') || line.length > 2);

    // Take first 3 most relevant lines as insights
    return lines.slice(0, 3);
  }

  /**
   * Calculate confidence based on data completeness
   */
  protected calculateConfidence(
    extractedData: Record<string, unknown> | undefined,
    contextData: AgentContext,
  ): number {
    let confidence = 0.5;

    // More data = higher confidence
    if (extractedData && Object.keys(extractedData).length > 0) {
      confidence += 0.2;
    }

    // Profile data increases confidence
    if (contextData.profile) {
      confidence += 0.1;
    }

    // Recent entries increase confidence
    if (contextData.recentEntries.length > 3) {
      confidence += 0.1;
    }

    // Conversation history helps
    if (contextData.conversationHistory.length > 5) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }
}
