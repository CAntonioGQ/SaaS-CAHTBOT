import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MessageProcessorProcessor } from './processors/message-processor.processor';
import { ConversationSummaryProcessor } from './processors/conversation-summary.processor';
import {
  MESSAGE_PROCESSING_QUEUE,
} from '../integrations/whatsapp/whatsapp.service';
import { CONVERSATION_SUMMARY_QUEUE } from './processors/conversation-summary.processor';

// QueueModule registers the BullMQ workers (processors).
// The workers run in the same process as the API but consume jobs asynchronously.
// For high-traffic production use, these could be split into a separate Railway service.
@Module({
  imports: [
    BullModule.registerQueue(
      { name: MESSAGE_PROCESSING_QUEUE },
      { name: CONVERSATION_SUMMARY_QUEUE },
    ),
  ],
  providers: [MessageProcessorProcessor, ConversationSummaryProcessor],
  exports: [MessageProcessorProcessor, ConversationSummaryProcessor],
})
export class QueueModule {}
