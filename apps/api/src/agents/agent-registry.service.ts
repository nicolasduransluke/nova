import { Injectable, Logger } from '@nestjs/common';
import type { AgentOutput, MessageIntent } from '@nova/types';
import { BaseAgent, AgentInput } from './base-agent.abstract';
import { MetabolicAgentService } from './metabolic-agent.service';
import { NutritionAgentService } from './nutrition-agent.service';
import { ActivityBurnAgentService } from './activity-burn-agent.service';

export type RegisteredAgentType =
  | 'metabolic'
  | 'nutrition'
  | 'activity';

@Injectable()
export class AgentRegistryService {
  private readonly logger = new Logger(AgentRegistryService.name);
  private readonly agents: Map<RegisteredAgentType, BaseAgent>;

  private readonly intentToAgents: Record<MessageIntent, RegisteredAgentType[]> = {
    meal_log: ['nutrition'],
    activity_log: ['activity'],
    weight_log: ['metabolic'],
    goal_set: [], // Handled by orchestrator directly
    profile_setup: [], // Handled by orchestrator directly (new user onboarding)
    entry_edit: [], // Handled by orchestrator directly (delete/modify entries)
    confirmation: [], // Handled by orchestrator directly
    question: ['metabolic'],
    greeting: [],
    general: [],
  };

  constructor(
    private readonly metabolicAgent: MetabolicAgentService,
    private readonly nutritionAgent: NutritionAgentService,
    private readonly activityAgent: ActivityBurnAgentService,
  ) {
    this.agents = new Map<RegisteredAgentType, BaseAgent>([
      ['metabolic', this.metabolicAgent],
      ['nutrition', this.nutritionAgent],
      ['activity', this.activityAgent],
    ]);

    this.logger.log(`Agent Registry initialized with ${this.agents.size} agents`);
  }

  getAgent(type: RegisteredAgentType): BaseAgent | undefined {
    return this.agents.get(type);
  }

  getRegisteredAgentTypes(): RegisteredAgentType[] {
    return Array.from(this.agents.keys());
  }

  getAgentsForIntent(intent: MessageIntent): RegisteredAgentType[] {
    return this.intentToAgents[intent] || [];
  }

  async processWithAgents(
    intent: MessageIntent,
    input: AgentInput,
  ): Promise<AgentOutput[]> {
    const agentTypes = this.getAgentsForIntent(intent);

    if (agentTypes.length === 0) {
      this.logger.debug(`No agents configured for intent: ${intent}`);
      return [];
    }

    this.logger.debug(`Processing with agents: ${agentTypes.join(', ')}`);

    const results = await Promise.allSettled(
      agentTypes.map((type) => this.processWithAgent(type, input)),
    );

    const outputs: AgentOutput[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        outputs.push(result.value);
      } else {
        this.logger.error(`Agent ${agentTypes[index]} failed: ${result.reason}`);
      }
    });

    return outputs;
  }

  async processWithAgent(
    type: RegisteredAgentType,
    input: AgentInput,
  ): Promise<AgentOutput> {
    const agent = this.agents.get(type);

    if (!agent) {
      throw new Error(`Agent not found: ${type}`);
    }

    const startTime = Date.now();

    try {
      const output = await agent.process(input);
      const duration = Date.now() - startTime;

      this.logger.debug(`Agent ${type} processed in ${duration}ms (confidence: ${output.confidence})`);

      return output;
    } catch (error) {
      this.logger.error(`Agent ${type} error: ${error}`);
      throw error;
    }
  }

  analyzeContentForAgents(
    content: string,
    primaryAgents: RegisteredAgentType[],
  ): RegisteredAgentType[] {
    const additionalAgents: Set<RegisteredAgentType> = new Set();
    const lowerContent = content.toLowerCase();

    const nutritionKeywords = [
      'comí', 'comi', 'comida', 'comiendo', 'desayuno', 'desayuné', 'desayune',
      'almuerzo', 'almorcé', 'almorce', 'almor', 'cena', 'cené', 'cene',
      'merienda', 'merendé', 'merende', 'snack', 'tomé', 'tome',
      'calorías', 'calorias', 'comido', 'ate', 'meal', 'food', 'eaten',
      'pollo', 'arroz', 'huevos', 'pan', 'pasta', 'pizza', 'carne',
      'pescado', 'ensalada', 'sopa', 'frijoles', 'tortilla',
      'plátano', 'platano', 'banana', 'manzana', 'naranja', 'avena',
      'yogurt', 'cereal', 'fruta', 'leche', 'queso', 'café', 'cafe',
      'tacos', 'burrito', 'empanada', 'arepa', 'tamales',
      'aguacate', 'atún', 'atun', 'papas', 'papa',
      'galletas', 'chocolate', 'helado', 'jugo', 'licuado',
    ];
    if (nutritionKeywords.some((kw) => lowerContent.includes(kw))) {
      additionalAgents.add('nutrition');
    }

    const activityKeywords = [
      'entrené', 'entrene', 'entrenamiento', 'ejercicio', 'gym',
      'gimnasio', 'correr', 'corrí', 'pesas', 'cardio', 'workout',
      'nadar', 'ciclismo', 'bici', 'caminé', 'camine',
    ];
    if (activityKeywords.some((kw) => lowerContent.includes(kw))) {
      additionalAgents.add('activity');
    }

    const metabolicKeywords = [
      'peso', 'weight', 'kg', 'kilos', 'báscula', 'bascula',
      'bmi', 'imc', 'déficit', 'deficit', 'tdee',
    ];
    if (metabolicKeywords.some((kw) => lowerContent.includes(kw))) {
      additionalAgents.add('metabolic');
    }

    primaryAgents.forEach((agent) => additionalAgents.delete(agent));

    return Array.from(additionalAgents);
  }

  async processComprehensive(
    intent: MessageIntent,
    input: AgentInput,
  ): Promise<AgentOutput[]> {
    const primaryAgents = this.getAgentsForIntent(intent);

    const additionalAgents = this.analyzeContentForAgents(
      input.message,
      primaryAgents,
    );

    const allAgents = [...new Set([...primaryAgents, ...additionalAgents])];

    if (allAgents.length === 0) {
      this.logger.debug('No agents matched for this message');
      return [];
    }

    this.logger.debug(
      `Comprehensive processing with agents: ${allAgents.join(', ')} ` +
      `(primary: ${primaryAgents.join(', ')}, additional: ${additionalAgents.join(', ')})`,
    );

    const results = await Promise.allSettled(
      allAgents.map((type) => this.processWithAgent(type, input)),
    );

    const outputs: AgentOutput[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        outputs.push(result.value);
      } else {
        this.logger.error(`Agent ${allAgents[index]} failed: ${result.reason}`);
      }
    });

    return outputs;
  }
}
