import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { GroqService } from './groq.service';
import { AiOrchestrationService } from './ai-orchestration.service';

@Module({
  providers: [AiService, GroqService, AiOrchestrationService],
  exports: [AiService, GroqService, AiOrchestrationService],
})
export class AiModule {}
