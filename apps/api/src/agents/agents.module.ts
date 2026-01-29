import { Module } from '@nestjs/common';
import { ClaudeClientModule } from '../claude-client/claude-client.module';
import { WhoopModule } from '../whoop/whoop.module';
import { OrchestratorService } from './orchestrator.service';
import { MetabolicAgentService } from './metabolic-agent.service';
import { IntegratorAgentService } from './integrator-agent.service';
import { NutritionAgentService } from './nutrition-agent.service';
import { ActivityBurnAgentService } from './activity-burn-agent.service';
import { AgentRegistryService } from './agent-registry.service';

@Module({
  imports: [ClaudeClientModule, WhoopModule],
  providers: [
    // Specialized Agents
    MetabolicAgentService,
    NutritionAgentService,
    ActivityBurnAgentService,
    IntegratorAgentService,
    // Registry & Orchestrator
    AgentRegistryService,
    OrchestratorService,
  ],
  exports: [OrchestratorService, AgentRegistryService],
})
export class AgentsModule {}
