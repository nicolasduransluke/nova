import { Injectable, Logger } from '@nestjs/common';
import type { AgentOutput, MessageIntent } from '@nova/types';
import { BaseAgent, AgentInput } from './base-agent.abstract';
import { MetabolicAgentService } from './metabolic-agent.service';
import { NutritionAgentService } from './nutrition-agent.service';
import { TrainingAgentService } from './training-agent.service';
import { SleepAgentService } from './sleep-agent.service';
import { EnergyAgentService } from './energy-agent.service';

export type RegisteredAgentType =
  | 'metabolic'
  | 'nutrition'
  | 'training'
  | 'sleep'
  | 'energy';

/**
 * Agent Registry Service
 *
 * Manages all specialized agents and provides routing logic
 * based on message intent and data type.
 */
@Injectable()
export class AgentRegistryService {
  private readonly logger = new Logger(AgentRegistryService.name);
  private readonly agents: Map<RegisteredAgentType, BaseAgent>;

  // Mapping of intents to agents that should process them
  private readonly intentToAgents: Record<MessageIntent, RegisteredAgentType[]> = {
    weight_log: ['metabolic'],
    meal_log: ['nutrition'],
    workout_log: ['training', 'metabolic'],
    sleep_log: ['sleep'],
    energy_check: ['energy'],
    question: [], // Questions go directly to integrator
    greeting: [], // Greetings go directly to integrator
    general: [],  // General messages may trigger multiple agents based on content
  };

  constructor(
    private readonly metabolicAgent: MetabolicAgentService,
    private readonly nutritionAgent: NutritionAgentService,
    private readonly trainingAgent: TrainingAgentService,
    private readonly sleepAgent: SleepAgentService,
    private readonly energyAgent: EnergyAgentService,
  ) {
    this.agents = new Map([
      ['metabolic', this.metabolicAgent],
      ['nutrition', this.nutritionAgent],
      ['training', this.trainingAgent],
      ['sleep', this.sleepAgent],
      ['energy', this.energyAgent],
    ]);

    this.logger.log(`Agent Registry initialized with ${this.agents.size} agents`);
  }

  /**
   * Get a specific agent by type
   */
  getAgent(type: RegisteredAgentType): BaseAgent | undefined {
    return this.agents.get(type);
  }

  /**
   * Get all registered agent types
   */
  getRegisteredAgentTypes(): RegisteredAgentType[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get agents that should process a given intent
   */
  getAgentsForIntent(intent: MessageIntent): RegisteredAgentType[] {
    return this.intentToAgents[intent] || [];
  }

  /**
   * Process input through specific agents based on intent
   */
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

    // Execute agents in parallel
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

  /**
   * Process input through a specific agent
   */
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

  /**
   * Smart routing - analyze content to determine additional agents
   * beyond the primary intent-based routing
   */
  analyzeContentForAgents(
    content: string,
    primaryAgents: RegisteredAgentType[],
  ): RegisteredAgentType[] {
    const additionalAgents: Set<RegisteredAgentType> = new Set();
    const lowerContent = content.toLowerCase();

    // Check for nutrition-related content
    const nutritionKeywords = [
      'comí', 'comi', 'comida', 'desayuno', 'almuerzo', 'cena',
      'snack', 'proteína', 'proteina', 'calorías', 'calorias',
      'carbohidratos', 'grasa', 'macros', 'comido', 'ate', 'meal',
    ];
    if (nutritionKeywords.some((kw) => lowerContent.includes(kw))) {
      additionalAgents.add('nutrition');
    }

    // Check for training-related content
    const trainingKeywords = [
      'entrené', 'entrene', 'entrenamiento', 'ejercicio', 'gym',
      'gimnasio', 'correr', 'pesas', 'cardio', 'workout', 'train',
      'series', 'repeticiones', 'peso', 'strength',
    ];
    if (trainingKeywords.some((kw) => lowerContent.includes(kw))) {
      additionalAgents.add('training');
    }

    // Check for sleep-related content
    const sleepKeywords = [
      'dormí', 'dormi', 'sueño', 'sueno', 'desperté', 'desperte',
      'acosté', 'acoste', 'sleep', 'slept', 'horas', 'descanso',
    ];
    if (sleepKeywords.some((kw) => lowerContent.includes(kw))) {
      additionalAgents.add('sleep');
    }

    // Check for energy/mood-related content
    const energyKeywords = [
      'energía', 'energia', 'cansado', 'cansada', 'agotado',
      'motivado', 'ánimo', 'animo', 'estrés', 'estres', 'bien',
      'mal', 'tired', 'energy', 'mood', 'stress',
    ];
    if (energyKeywords.some((kw) => lowerContent.includes(kw))) {
      additionalAgents.add('energy');
    }

    // Check for weight/metabolic content
    const metabolicKeywords = [
      'peso', 'weight', 'kg', 'kilos', 'libras', 'báscula', 'bascula',
      'bmi', 'imc', 'grasa corporal', 'body fat',
    ];
    if (metabolicKeywords.some((kw) => lowerContent.includes(kw))) {
      additionalAgents.add('metabolic');
    }

    // Remove agents that are already in primary list
    primaryAgents.forEach((agent) => additionalAgents.delete(agent));

    return Array.from(additionalAgents);
  }

  /**
   * Get comprehensive agent processing for a message
   * Combines intent-based and content-based routing
   */
  async processComprehensive(
    intent: MessageIntent,
    input: AgentInput,
  ): Promise<AgentOutput[]> {
    // Get primary agents based on intent
    const primaryAgents = this.getAgentsForIntent(intent);

    // Analyze content for additional agents
    const additionalAgents = this.analyzeContentForAgents(
      input.message,
      primaryAgents,
    );

    // Combine and deduplicate
    const allAgents = [...new Set([...primaryAgents, ...additionalAgents])];

    if (allAgents.length === 0) {
      this.logger.debug('No agents matched for this message');
      return [];
    }

    this.logger.debug(
      `Comprehensive processing with agents: ${allAgents.join(', ')} ` +
      `(primary: ${primaryAgents.join(', ')}, additional: ${additionalAgents.join(', ')})`,
    );

    // Execute all agents in parallel
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
