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
import { WhoopService } from '../whoop/whoop.service';
import { AgentInput } from './base-agent.abstract';
import { getUserLocalMidnight, DEFAULT_TIMEZONE } from '../utils/timezone';

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
  updateProfile: (userId: string, data: {
    weight?: number;
    height?: number;
    age?: number;
    sex?: 'male' | 'female';
    goalWeight?: number;
    weeklyGoal?: number;
    targetWeeks?: number;
  }) => Promise<Profile>;
  getUserMetadata: (userId: string) => Promise<string | null>;
  updateUserMetadata: (userId: string, metadata: Record<string, any>) => Promise<void>;
  deleteCalorieEntry: (entryId: string) => Promise<void>;
  getLastCalorieEntry: (userId: string) => Promise<CalorieEntry | null>;
  getWhoopToken: (userId: string) => Promise<{ accessToken: string } | null>;
}

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly claudeClient: ClaudeClientService,
    private readonly agentRegistry: AgentRegistryService,
    private readonly integratorAgent: IntegratorAgentService,
    private readonly metabolicAgent: MetabolicAgentService,
    private readonly whoopService: WhoopService,
  ) {}

  async processMessage(
    request: ProcessMessageRequest,
    deps: OrchestratorDependencies,
  ): Promise<ProcessMessageResponse> {
    const startTime = Date.now();
    this.logger.debug(`Processing message for user ${request.userId}`);

    try {
      // Step 1: Build context
      const context = await this.buildContext(request.userId, deps, request.timezone);

      // Step 1b: Fetch weight logs for weight prompting and progress tracking
      const allWeightLogs = await deps.getRecentWeightLogs(request.userId, 100);
      let lastWeightLog: LastWeightLogInfo | undefined;
      let firstWeightLog: number | undefined;
      let needsWeightPrompt = false;

      if (allWeightLogs.length > 0) {
        // Most recent log (first in DESC order)
        const log = allWeightLogs[0];
        const daysSince = Math.floor(
          (Date.now() - new Date(log.date).getTime()) / (1000 * 60 * 60 * 24),
        );
        lastWeightLog = { weight: log.weight, date: log.date, daysSince };
        needsWeightPrompt = daysSince > 7;

        // First/oldest log (last in DESC order) - used as starting weight for progress calculation
        firstWeightLog = allWeightLogs[allWeightLogs.length - 1].weight;
      } else {
        needsWeightPrompt = true;
      }

      // Step 2: Classify intent (image = auto meal_log)
      const hasImage = !!request.imageUrl;
      const intent: MessageIntent = hasImage
        ? 'meal_log'
        : await this.classifyMessage(request.content);
      this.logger.log(`Classified intent: ${intent} for message: "${request.content}"${hasImage ? ' [with image]' : ''}`);

      // Step 5: Extract data from message (vision path for images)
      let extractedData: Record<string, unknown>;
      if (hasImage) {
        try {
          const visionResult = await this.claudeClient.analyzeImageFood(
            request.imageUrl!,
            request.content !== '[Foto de comida]' ? request.content : undefined,
          );
          if (visionResult.items.length === 0) {
            return {
              success: true,
              response: {
                message: 'No pude identificar comida en la foto. Intenta con otra imagen o describe lo que comiste.',
                tone: 'calm',
              },
              intent: 'general',
              processedAt: new Date(),
            };
          }
          extractedData = {
            items: visionResult.items,
            totalCalories: visionResult.totalCalories,
            source: 'vision',
          };
        } catch (error) {
          this.logger.error(`Vision analysis failed: ${error}`);
          return {
            success: true,
            response: {
              message: 'No pude analizar la foto. Intenta de nuevo o escribe lo que comiste.',
              tone: 'calm',
            },
            intent: 'general',
            processedAt: new Date(),
          };
        }
      } else {
        extractedData = await this.claudeClient.extractDataFromMessage(
          request.content,
          intent,
        );
      }

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

        const description = hasImage
          ? items.map(i => i.name).join(', ')
          : request.content;

        await deps.createCalorieEntry({
          userId: request.userId,
          date: new Date(),
          type: entryType,
          description,
          calories: Math.round(totalCalories),
          items,
          confirmed: true,
        });
      }

      // Step 8a: Handle weight_log (before summary so new weight is reflected)
      let previousWeight: number | undefined;
      if (intent === 'weight_log' && extractedData.weight) {
        const newWeight = extractedData.weight as number;
        // Save previous weight before overwriting, so the integrator can calculate the change
        if (lastWeightLog) {
          previousWeight = lastWeightLog.weight;
        }
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

          // Always update profile.weight so TDEE recalculates with the latest weight
          const updatedProfile = await deps.updateProfile(request.userId, { weight: newWeight });
          context.profile = updatedProfile;
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

      // Step 8c: Handle profile_setup (new user providing their info via chat)
      if (intent === 'profile_setup') {
        this.logger.log(`PROFILE_SETUP intent detected. Extracted data: ${JSON.stringify(extractedData)}`);
        const weight = extractedData.weight as number | null;
        const height = extractedData.height as number | null;
        const age = extractedData.age as number | null;
        const sex = extractedData.sex as 'male' | 'female' | null;
        const goalWeight = extractedData.goalWeight as number | null;
        this.logger.log(`Parsed values - height: ${height}, age: ${age}, sex: ${sex}`);

        const profileData: {
          weight?: number;
          height?: number;
          age?: number;
          sex?: 'male' | 'female';
          goalWeight?: number;
        } = {};

        // Validate and add each field
        if (weight != null && weight >= 30 && weight <= 300) {
          profileData.weight = weight;
          // Also create a weight log for this initial weight
          await deps.createWeightLog({
            userId: request.userId,
            weight,
            date: new Date(),
          });
          lastWeightLog = { weight, date: new Date(), daysSince: 0 };
          needsWeightPrompt = false;
        }
        if (height != null && height >= 100 && height <= 250) {
          profileData.height = height;
        }
        if (age != null && age >= 10 && age <= 120) {
          profileData.age = age;
        }
        if (sex != null) {
          profileData.sex = sex;
        }
        if (goalWeight != null && goalWeight >= 30 && goalWeight <= 300) {
          profileData.goalWeight = goalWeight;
        }

        if (Object.keys(profileData).length > 0) {
          this.logger.debug(`Creating/updating profile for new user: ${JSON.stringify(profileData)}`);
          const updatedProfile = await deps.updateProfile(request.userId, profileData);
          context.profile = updatedProfile;
        }
      }

      // Step 8e: Handle entry_edit (delete/modify entries)
      if (intent === 'entry_edit') {
        const todayAllEntries = await deps.getTodayCalorieEntries(request.userId);
        const lowerMsg = request.content.toLowerCase();

        // Check if user wants to delete everything
        const deleteAllPatterns = ['borra todo', 'elimina todo', 'quita todo', 'borrar todo', 'eliminar todo', 'delete all', 'remove all'];
        const wantsDeleteAll = deleteAllPatterns.some((p) => lowerMsg.includes(p));

        if (wantsDeleteAll && todayAllEntries.length > 0) {
          // Delete all today's entries
          for (const entry of todayAllEntries) {
            await deps.deleteCalorieEntry(entry.id);
          }
          this.logger.log(`Deleted all ${todayAllEntries.length} calorie entries for user ${request.userId}`);
          extractedData.deletedEntries = todayAllEntries.map((e) => ({
            description: e.description,
            calories: e.calories,
            type: e.type,
          }));
          extractedData.deletedCount = todayAllEntries.length;
        } else if (todayAllEntries.length > 0) {
          // Try to find a specific entry by matching food keywords in the message
          const matched = this.findMatchingEntry(lowerMsg, todayAllEntries);

          if (matched) {
            await deps.deleteCalorieEntry(matched.id);
            this.logger.log(`Deleted calorie entry ${matched.id} (matched: "${matched.description}") for user ${request.userId}`);
            extractedData.deletedEntry = {
              id: matched.id,
              description: matched.description,
              calories: matched.calories,
              items: matched.items,
              type: matched.type,
            };
          } else {
            // No specific match found - show list so user can pick
            extractedData.deletedEntry = null;
            extractedData.todayEntries = todayAllEntries.map((e, i) => ({
              index: i + 1,
              description: e.description,
              calories: e.calories,
              type: e.type,
            }));
          }
        } else {
          extractedData.deletedEntry = null;
          extractedData.noEntryFound = true;
        }
      }

      // Step 9: Get today's calorie entries for daily summary
      const todayEntries = await deps.getTodayCalorieEntries(request.userId);
      const todayIntake = todayEntries
        .filter((e) => e.type === 'intake')
        .reduce((sum, e) => sum + e.calories, 0);

      // Check if user has Whoop connected and get calories from there
      let todayBurn = todayEntries
        .filter((e) => e.type === 'burn')
        .reduce((sum, e) => sum + e.calories, 0);
      let burnSource: 'manual' | 'whoop' = 'manual';

      // Try to get Whoop data if connected
      try {
        const whoopToken = await deps.getWhoopToken(request.userId);
        if (whoopToken) {
          const whoopSummary = await this.whoopService.getDailySummary(whoopToken.accessToken);
          if (whoopSummary.caloriesBurned > 0) {
            todayBurn = whoopSummary.caloriesBurned;
            burnSource = 'whoop';
            this.logger.debug(`Using Whoop calories: ${todayBurn}`);
          }
        }
      } catch (error) {
        this.logger.debug(`Whoop data not available: ${error}`);
      }

      const dailySummary = this.metabolicAgent.calculateDailySummary(
        context.profile,
        todayIntake,
        todayBurn,
        lastWeightLog?.weight,
        context.profile?.goalWeight,
        firstWeightLog,
        burnSource,
      );

      // Step 10: Integrate responses
      // Profile is incomplete if user hasn't set a goalWeight
      const isProfileIncomplete = !context.profile?.goalWeight;
      // New user has no profile at all
      const isNewUser = !context.profile;
      // Profile has default values if height=170, age=30 (the defaults from upsert)
      const hasDefaultProfileData = context.profile?.height === 170 && context.profile?.age === 30;

      const integratorInput: IntegratorInput = {
        context,
        message: request.content,
        extractedData,
        intent,
        agentOutputs,
        dailySummary,
        lastWeightLog,
        previousWeight,
        needsWeightPrompt,
        isProfileIncomplete,
        isNewUser,
        hasDefaultProfileData,
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
    timezone?: string,
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
      currentDate: getUserLocalMidnight(timezone || DEFAULT_TIMEZONE),
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

  /**
   * Find a calorie entry matching food keywords in the user's message.
   * Falls back to the most recent entry if only generic delete words are used.
   */
  private findMatchingEntry(
    lowerMsg: string,
    entries: CalorieEntry[],
  ): CalorieEntry | null {
    // Check if user references a specific entry by number (e.g., "borra el 2", "elimina el #3")
    const numberMatch = lowerMsg.match(/(?:el|la|#|número|numero)\s*(\d+)/);
    if (numberMatch) {
      const idx = parseInt(numberMatch[1], 10) - 1;
      if (idx >= 0 && idx < entries.length) {
        return entries[idx];
      }
    }

    // Try to match by food keywords in the message against entry descriptions
    // Common food words that might appear in the user's delete request
    const foodKeywords = [
      'café', 'cafe', 'coffee', 'desayuno', 'almuerzo', 'cena', 'merienda',
      'pollo', 'arroz', 'huevos', 'pan', 'pasta', 'pizza', 'carne',
      'pescado', 'ensalada', 'sopa', 'frijoles', 'tortilla', 'sandwich',
      'fruta', 'yogurt', 'cereal', 'avena', 'tacos', 'burrito', 'empanada',
      'galletas', 'chocolate', 'helado', 'jugo', 'licuado', 'leche',
      'aguacate', 'atún', 'atun', 'papas', 'nueces',
    ];

    // Extract food words present in the user's message
    const msgFoods = foodKeywords.filter((kw) => lowerMsg.includes(kw));

    if (msgFoods.length > 0) {
      // Find the most recent entry whose description contains any of the matched foods
      // Entries are ordered by createdAt DESC (most recent first)
      for (const entry of entries) {
        const entryLower = entry.description.toLowerCase();
        if (msgFoods.some((food) => entryLower.includes(food))) {
          return entry;
        }
      }
    }

    // Check for "último"/"ultima"/"last" patterns - return most recent
    const lastPatterns = ['último', 'ultimo', 'última', 'ultima', 'last', 'el de'];
    if (lastPatterns.some((p) => lowerMsg.includes(p))) {
      return entries[0]; // Most recent (entries are DESC)
    }

    // Default: if message is a generic delete request, delete the most recent entry
    return entries[0];
  }
}
