import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiPipelineService } from './ai-pipeline.service';
import { OpenRouterService } from './openrouter.service';
import { ToolExecutorService } from './tool-executor.service';
import { LeadCaptureTool } from './tools/lead-capture.tool';
import { AppointmentBookingTool } from './tools/appointment-booking.tool';
import { HumanEscalationTool } from './tools/human-escalation.tool';
import { InventoryLookupTool } from './tools/inventory-lookup.tool';
import { CONVERSATION_SUMMARY_QUEUE } from '../queue/processors/conversation-summary.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: CONVERSATION_SUMMARY_QUEUE }),
  ],
  providers: [
    AiPipelineService,
    OpenRouterService,
    ToolExecutorService,
    LeadCaptureTool,
    AppointmentBookingTool,
    HumanEscalationTool,
    InventoryLookupTool,
  ],
  exports: [AiPipelineService, OpenRouterService],
})
export class AiPipelineModule {}
