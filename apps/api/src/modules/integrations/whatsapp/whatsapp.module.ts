import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppCloudService } from './whatsapp-cloud.service';
import { WhatsAppSignatureGuard } from './guards/whatsapp-signature.guard';
import { MESSAGE_PROCESSING_QUEUE } from './whatsapp.service';

@Module({
  imports: [
    // Register the queue — the service injects it to enqueue jobs
    BullModule.registerQueue({ name: MESSAGE_PROCESSING_QUEUE }),
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, WhatsAppCloudService, WhatsAppSignatureGuard],
  // Export WhatsAppService so the AI pipeline can call sendReply() and markRead()
  exports: [WhatsAppService, WhatsAppCloudService],
})
export class WhatsappModule {}
