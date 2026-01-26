import { Module } from '@nestjs/common';
import { ClaudeClientModule } from '../claude-client/claude-client.module';
import { OrchestratorService } from './orchestrator.service';
import { MetabolicAgentService } from './metabolic-agent.service';
import { IntegratorAgentService } from './integrator-agent.service';
import { NutritionAgentService } from './nutrition-agent.service';
import { TrainingAgentService } from './training-agent.service';
import { SleepAgentService } from './sleep-agent.service';
import { EnergyAgentService } from './energy-agent.service';
import { AgentRegistryService } from './agent-registry.service';

@Module({
  imports: [ClaudeClientModule],
  providers: [
    // Specialized Agents
    MetabolicAgentService,
    NutritionAgentService,
    TrainingAgentService,
    SleepAgentService,
    EnergyAgentService,
    IntegratorAgentService,
    // Registry & Orchestrator
    AgentRegistryService,
    OrchestratorService,
  ],
  exports: [OrchestratorService, AgentRegistryService],
})
export class AgentsModule {}
