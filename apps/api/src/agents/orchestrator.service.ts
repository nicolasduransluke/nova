import { Injectable, Logger } from '@nestjs/common';
import type {
  AgentContext,
  AgentOutput,
  MessageIntent,
  ProcessMessageRequest,
  ProcessMessageResponse,
  User,
  Profile,
  DailyEntry,
  Message,
  CalorieEntry,
  CalorieEntryItem,
  DailySummary,
  WeightLog,
} from '@nova/types';
import { ClaudeClientService } from '../claude-client/claude-client.service';
import { IntegratorAgentService, IntegratorInput } from './integrator-agent.service';
import { AgentRegistryService } from './agent-registry.service';
import { MetabolicAgentService } from './metabolic-agent.service';
import { AgentInput } from './base-agent.abstract';

export interface OrchestratorDependencies {
  getUser: (userId: string) => Promise<User | null>;
  getProfile: (userId: string) => Promise<Profile | null>;
  getRecentEntries: (userId: string, limit: number) => Promise<DailyEntry[]>;
  getConversationHistory: (userId: string, limit: number) => Promise<Message[]>;
  saveEntry: (entry: Partial<DailyEntry>) => Promise<DailyEntry>;
  createCalorieEntry: (data: {
    userId: string;
    date: Date;
    type: string;
    description: string;
    calories: number;
    items: CalorieEntryItem[];
    confirmed: boolean;
  }) => Promise<CalorieEntry>;
  getTodayCalorieEntries: (userId: string) => Promise<CalorieEntry[]>;
  createWeightLog: (data: { userId: string; weight: number; date: Date }) => Promise<WeightLog>;
  getRecentWeightLogs: (userId: string, limit: number) => Promise<WeightLog[]>;
}

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly claudeClient: ClaudeClientService,
    private readonly agentRegistry: AgentRegistryService,
    private readonly integratorAgent: IntegratorAgentService,
    private readonly metabolicAgent: MetabolicAgentService,
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

      // Step 5: Extract data from message
      const extractedData = await this.claudeClient.extractDataFromMessage(
        request.content,
        intent,
      );

      // Step 6: Route to appropriate agents
      const agentOutputs = await this.routeToAgents(
        intent,
        { context, message: request.content, extractedData },
      );

      // Step 7: If meal_log or activity_log, create CalorieEntry (auto-confirmed)
      if (intent === 'meal_log' || intent === 'activity_log') {
        const items: CalorieEntryItem[] = (extractedData.items as CalorieEntryItem[]) ||
          agentOutputs.find((o) => o.dataPoints.items)?.dataPoints.items as CalorieEntryItem[] || [];
        const totalCalories = (extractedData.totalCalories as number) ||
          (extractedData.caloriesBurned as number) ||
          agentOutputs.find((o) => o.dataPoints.totalCalories)?.dataPoints.totalCalories as number ||
          agentOutputs.find((o) => o.dataPoints.caloriesBurned)?.dataPoints.caloriesBurned as number || 0;

        const entryType = intent === 'meal_log' ? 'intake' : 'burn';

        await deps.createCalorieEntry({
          userId: request.userId,
          date: new Date(),
          type: entryType,
          description: request.content,
          calories: Math.round(totalCalories),
          items,
          confirmed: true,
        });
      }

      // Step 8: Get today's calorie entries for daily summary (after creating entry)
      const todayEntries = await deps.getTodayCalorieEntries(request.userId);
      const todayIntake = todayEntries
        .filter((e) => e.type === 'intake')
        .reduce((sum, e) => sum + e.calories, 0);
      const todayBurn = todayEntries
        .filter((e) => e.type === 'burn')
        .reduce((sum, e) => sum + e.calories, 0);

      const dailySummary = this.metabolicAgent.calculateDailySummary(
        context.profile,
        todayIntake,
        todayBurn,
      );

      // Step 9: Handle weight_log
      if (intent === 'weight_log' && extractedData.weight) {
        await deps.createWeightLog({
          userId: request.userId,
          weight: extractedData.weight as number,
          date: new Date(),
        });
      }

      // Step 10: Integrate responses
      const integratorInput: IntegratorInput = {
        context,
        message: request.content,
        extractedData,
        intent,
        agentOutputs,
        dailySummary,
      };

      const response = await this.integratorAgent.integrate(integratorInput);

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
          message: 'Tuve un problema procesando tu mensaje. ¿Puedes intentar de nuevo?',
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
    const startTime = Date.now();

    const outputs = await this.agentRegistry.processComprehensive(intent, input);

    const duration = Date.now() - startTime;
    this.logger.debug(
      `Agents processed in ${duration}ms. ` +
      `Outputs: ${outputs.length} (agents: ${outputs.map(o => o.agentType).join(', ')})`,
    );

    return outputs;
  }
}
