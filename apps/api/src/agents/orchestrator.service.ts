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
import { IntegratorAgentService, IntegratorInput, LastWeightLogInfo } from './integrator-agent.service';
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
  updateProfile: (userId: string, data: { goalWeight?: number; weeklyGoal?: number; targetWeeks?: number }) => Promise<Profile>;
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

      // Step 1b: Fetch last weight log for weight prompting
      const recentWeightLogs = await deps.getRecentWeightLogs(request.userId, 1);
      let lastWeightLog: LastWeightLogInfo | undefined;
      let needsWeightPrompt = false;

      if (recentWeightLogs.length > 0) {
        const log = recentWeightLogs[0];
        const daysSince = Math.floor(
          (Date.now() - new Date(log.date).getTime()) / (1000 * 60 * 60 * 24),
        );
        lastWeightLog = { weight: log.weight, date: log.date, daysSince };
        needsWeightPrompt = daysSince > 7;
      } else {
        needsWeightPrompt = true;
      }

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

      // Step 8a: Handle weight_log (before summary so new weight is reflected)
      if (intent === 'weight_log' && extractedData.weight) {
        const newWeight = extractedData.weight as number;
        // Validate weight is in realistic range (20-500 kg)
        if (newWeight >= 20 && newWeight <= 500) {
          await deps.createWeightLog({
            userId: request.userId,
            weight: newWeight,
            date: new Date(),
          });
          // Update lastWeightLog so daily summary and integrator use the new weight
          lastWeightLog = { weight: newWeight, date: new Date(), daysSince: 0 };
          needsWeightPrompt = false;
        } else {
          this.logger.warn(`Invalid weight value ignored: ${newWeight} kg`);
        }
      }

      // Step 8b: Handle goal_set (before summary so new goal is reflected)
      if (intent === 'goal_set') {
        let goalWeight = extractedData.goalWeight as number | null;
        let weeklyGoal = extractedData.weeklyGoal as number | null;
        // Try extractedData first, fallback to regex on original message
        let targetWeeks = extractedData.targetWeeks as number | null;
        if (targetWeeks == null) {
          const weeksMatch = request.content.match(/(?:en\s+)?(\d+)\s*semanas?|(\d+)\s*weeks?/i);
          if (weeksMatch) {
            targetWeeks = parseInt(weeksMatch[1] || weeksMatch[2], 10);
          }
        }

        // Validate goal values
        if (goalWeight != null && (goalWeight < 30 || goalWeight > 300)) {
          this.logger.warn(`Invalid goalWeight ignored: ${goalWeight} kg`);
          goalWeight = null;
        }
        if (weeklyGoal != null && (weeklyGoal < 0.1 || weeklyGoal > 2.0)) {
          this.logger.warn(`Invalid weeklyGoal ignored: ${weeklyGoal} kg/week`);
          weeklyGoal = null;
        }
        if (targetWeeks != null && (targetWeeks < 1 || targetWeeks > 200)) {
          this.logger.warn(`Invalid targetWeeks ignored: ${targetWeeks}`);
          targetWeeks = null;
        }

        const updateData: { goalWeight?: number; weeklyGoal?: number; targetWeeks?: number } = {};
        if (goalWeight != null) updateData.goalWeight = goalWeight;
        if (targetWeeks != null) updateData.targetWeeks = targetWeeks;

        // If targetWeeks is provided, calculate weeklyGoal from remaining weight
        if (targetWeeks != null && targetWeeks > 0) {
          const effectiveGoalWeight = goalWeight ?? context.profile?.goalWeight;
          const currentWeight = lastWeightLog?.weight ?? context.profile?.weight;
          if (effectiveGoalWeight != null && currentWeight != null) {
            const remaining = Math.abs(currentWeight - effectiveGoalWeight);
            const calculated = Number((remaining / targetWeeks).toFixed(2));
            // Cap weeklyGoal to safe range (0.1-2.0 kg/week)
            weeklyGoal = Math.min(Math.max(calculated, 0.1), 2.0);
          }
        }

        if (weeklyGoal != null && weeklyGoal >= 0.1 && weeklyGoal <= 2.0) {
          updateData.weeklyGoal = weeklyGoal;
        }
        if (Object.keys(updateData).length > 0) {
          const updatedProfile = await deps.updateProfile(request.userId, updateData);
          // Refresh context profile for summary calculation
          context.profile = updatedProfile;
        }
      }

      // Step 9: Get today's calorie entries for daily summary
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
        lastWeightLog?.weight,
        context.profile?.goalWeight,
      );

      // Step 10: Integrate responses
      const integratorInput: IntegratorInput = {
        context,
        message: request.content,
        extractedData,
        intent,
        agentOutputs,
        dailySummary,
        lastWeightLog,
        needsWeightPrompt,
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
