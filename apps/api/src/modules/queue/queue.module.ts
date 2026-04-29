import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MessageProcessorProcessor } from './processors/message-processor.processor';
import { ConversationSummaryProcessor } from './processors/conversation-summary.processor';
import { MESSAGE_PROCESSING_QUEUE } from '../integrations/whatsapp/whatsapp.service';
import { CONVERSATION_SUMMARY_QUEUE } from './processors/conversation-summary.processor';
import { AiPipelineModule } from '../ai-pipeline/ai-pipeline.module';
import { WhatsappModule } from '../integrations/whatsapp/whatsapp.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: MESSAGE_PROCESSING_QUEUE },
      { name: CONVERSATION_SUMMARY_QUEUE },
    ),
    AiPipelineModule,   // provides AiPipelineService
    WhatsappModule,     // provides WhatsAppService (sendReply, markRead)
  ],
  providers: [MessageProcessorProcessor, ConversationSummaryProcessor],
  exports: [MessageProcessorProcessor, ConversationSummaryProcessor],
})
export class QueueModule {}
