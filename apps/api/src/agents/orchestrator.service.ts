import { Injectable, Logger } from '@nestjs/common';
import type {
  AgentContext,
  AgentOutput,
  FinalResponse,
  MessageIntent,
  ProcessMessageRequest,
  ProcessMessageResponse,
  User,
  Profile,
  DailyEntry,
  Message,
} from '@nova/types';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import { MetabolicAgentService } from './metabolic-agent.service';
import { IntegratorAgentService, IntegratorInput } from './integrator-agent.service';
import { AgentInput } from './base-agent.abstract';

export interface OrchestratorDependencies {
  // These would come from repositories in production
  getUser: (userId: string) => Promise<User | null>;
  getProfile: (userId: string) => Promise<Profile | null>;
  getRecentEntries: (userId: string, limit: number) => Promise<DailyEntry[]>;
  getConversationHistory: (userId: string, limit: number) => Promise<Message[]>;
  saveEntry: (entry: Partial<DailyEntry>) => Promise<DailyEntry>;
}

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly claudeClient: ClaudeClientService,
    private readonly metabolicAgent: MetabolicAgentService,
    private readonly integratorAgent: IntegratorAgentService,
  ) {}

  async processMessage(
    request: ProcessMessageRequest,
    deps: OrchestratorDependencies,
  ): Promise<ProcessMessageResponse> {
    const startTime = Date.now();
    this.logger.debug(`Processing message for user ${request.userId}`);

    try {
      // Step 1: Build context
      const context = await this.buildContext(request.userId, deps);

      // Step 2: Classify intent
      const intent = await this.classifyMessage(request.content);
      this.logger.debug(`Classified intent: ${intent}`);

      // Step 3: Extract data from message
      const extractedData = await this.claudeClient.extractDataFromMessage(
        request.content,
        intent,
      );

      // Step 4: Route to appropriate agents
      const agentOutputs = await this.routeToAgents(
        intent,
        {
          context,
          message: request.content,
          extractedData,
        },
      );

      // Step 5: Integrate responses
      const integratorInput: IntegratorInput = {
        context,
        message: request.content,
        extractedData,
        intent,
        agentOutputs,
      };

      const response = await this.integratorAgent.integrate(integratorInput);

      // Step 6: Save entry if applicable
      if (this.shouldSaveEntry(intent)) {
        await this.saveEntryFromMessage(request, intent, extractedData, deps);
      }

      const processingTime = Date.now() - startTime;
      this.logger.debug(`Message processed in ${processingTime}ms`);

      return {
        success: true,
        response,
        intent,
        processedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Error processing message: ${error}`);

      return {
        success: false,
        response: {
          message:
            "I'm having trouble processing that right now. Could you try again?",
          tone: 'calm',
        },
        intent: 'general',
        processedAt: new Date(),
      };
    }
  }

  private async buildContext(
    userId: string,
    deps: OrchestratorDependencies,
  ): Promise<AgentContext> {
    const [user, profile, recentEntries, conversationHistory] = await Promise.all([
      deps.getUser(userId),
      deps.getProfile(userId),
      deps.getRecentEntries(userId, 10),
      deps.getConversationHistory(userId, 20),
    ]);

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    return {
      user,
      profile: profile || undefined,
      recentEntries,
      conversationHistory,
      currentDate: new Date(),
    };
  }

  private async classifyMessage(content: string): Promise<MessageIntent> {
    return this.claudeClient.classifyIntent(content);
  }

  private async routeToAgents(
    intent: MessageIntent,
    input: AgentInput,
  ): Promise<AgentOutput[]> {
    const outputs: AgentOutput[] = [];

    // Route based on intent
    const agentRouting: Record<MessageIntent, (() => Promise<AgentOutput>)[]> = {
      weight_log: [() => this.metabolicAgent.process(input)],
      meal_log: [], // Would route to nutrition agent in future
      workout_log: [], // Would route to activity agent in future
      sleep_log: [], // Would route to recovery agent in future
      energy_check: [], // Would route to energy agent in future
      question: [], // Questions go directly to integrator
      greeting: [], // Greetings go directly to integrator
      general: [], // General messages go directly to integrator
    };

    const agentCalls = agentRouting[intent] || [];

    // Execute agent calls in parallel
    if (agentCalls.length > 0) {
      const results = await Promise.allSettled(agentCalls.map((call) => call()));

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          outputs.push(result.value);
        } else {
          this.logger.error(`Agent ${index} failed: ${result.reason}`);
        }
      });
    }

    return outputs;
  }

  private shouldSaveEntry(intent: MessageIntent): boolean {
    const savableIntents: MessageIntent[] = [
      'weight_log',
      'meal_log',
      'workout_log',
      'sleep_log',
      'energy_check',
    ];
    return savableIntents.includes(intent);
  }

  private async saveEntryFromMessage(
    request: ProcessMessageRequest,
    intent: MessageIntent,
    extractedData: Record<string, unknown>,
    deps: OrchestratorDependencies,
  ): Promise<void> {
    const entryTypeMap: Record<string, string> = {
      weight_log: 'custom', // Weight goes in profile in production
      meal_log: 'food',
      workout_log: 'exercise',
      sleep_log: 'sleep',
      energy_check: 'energy',
    };

    const entryType = entryTypeMap[intent];
    if (!entryType) return;

    const basePoints: Record<string, number> = {
      food: 10,
      exercise: 20,
      sleep: 15,
      energy: 5,
      custom: 15,
    };

    try {
      await deps.saveEntry({
        userId: request.userId,
        date: new Date(),
        type: entryType as DailyEntry['type'],
        data: {
          ...extractedData,
          originalMessage: request.content,
          imageUrl: request.imageUrl,
        },
        novaPoints: basePoints[entryType] || 5,
      });
    } catch (error) {
      this.logger.error(`Failed to save entry: ${error}`);
      // Don't throw - entry saving failure shouldn't break response
    }
  }
}
