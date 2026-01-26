import { Module } from '@nestjs/common';
import { ClaudeClientModule } from '../claude-client/claude-client.module';
import { OrchestratorService } from './orchestrator.service';
import { MetabolicAgentService } from './metabolic-agent.service';
import { IntegratorAgentService } from './integrator-agent.service';

@Module({
  imports: [ClaudeClientModule],
  providers: [
    OrchestratorService,
    MetabolicAgentService,
    IntegratorAgentService,
  ],
  exports: [OrchestratorService],
})
export class AgentsModule {}
