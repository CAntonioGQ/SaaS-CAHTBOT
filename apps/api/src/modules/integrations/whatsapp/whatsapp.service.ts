import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../common/services/encryption.service';
import { WhatsAppCloudService } from './whatsapp-cloud.service';
import {
  WhatsAppWebhookBody,
  ParsedInboundMessage,
} from '@empleado-ia/shared-types';

export const MESSAGE_PROCESSING_QUEUE = 'message-processing';

export interface MessageJob {
  organizationId: string;
  webhookEventId: string;
  parsed: ParsedInboundMessage;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly cloudService: WhatsAppCloudService,
    @InjectQueue(MESSAGE_PROCESSING_QUEUE)
    private readonly messageQueue: Queue<MessageJob>,
  ) {}

  // Called by the controller on GET — returns the challenge to Meta for webhook verification
  verifyWebhook(mode: string, token: string, challenge: string): string {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? '';

    if (mode !== 'subscribe' || token !== verifyToken) {
      throw new NotFoundException('Webhook verification failed');
    }

    return challenge;
  }

  // Called by the controller on POST — must return fast (< 5s or Meta retries)
  // 1. Parse payload  2. Persist raw event  3. Enqueue for async processing
  async handleWebhook(body: WhatsAppWebhookBody): Promise<void> {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id;

        if (!phoneNumberId) continue;

        // Find which organization owns this phone number
        const org = await this.prisma.organization.findFirst({
          where: { whatsappPhoneNumberId: phoneNumberId },
          select: { id: true },
        });

        if (!org) {
          this.logger.warn(
            `Webhook received for unknown phoneNumberId: ${phoneNumberId}`,
          );
          continue;
        }

        // Process each inbound message
        for (const message of value.messages ?? []) {
          await this.processInboundMessage(org.id, value, message);
        }

        // Process delivery/read status updates (update Message.status in DB)
        for (const status of value.statuses ?? []) {
          await this.processStatusUpdate(org.id, status);
        }
      }
    }
  }

  private async processInboundMessage(
    organizationId: string,
    value: WhatsAppWebhookBody['entry'][0]['changes'][0]['value'],
    message: NonNullable<typeof value.messages>[0],
  ): Promise<void> {
    const wamid = message.id;

    // Idempotency: skip if already processed (Meta may retry on 5xx)
    const existing = await this.prisma.webhookEvent.findFirst({
      where: { organizationId, whatsappMsgId: wamid },
    });

    if (existing) {
      this.logger.debug(`Skipping duplicate wamid: ${wamid}`);
      return;
    }

    // Persist raw payload immediately — before any processing that could fail
    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        organizationId,
        source: 'WHATSAPP',
        eventType: 'messages',
        whatsappMsgId: wamid,
        payload: value as object,
        status: 'PENDING',
      },
    });

    // Parse into a normalized format for the queue worker
    const contactName = value.contacts?.find(
      (c) => c.wa_id === message.from,
    )?.profile?.name;

    const parsed: ParsedInboundMessage = {
      wamid,
      fromPhone: message.from,
      toPhoneNumberId: value.metadata.phone_number_id,
      contactName,
      type: message.type,
      text: message.text?.body,
      mediaId: message.image?.id ?? message.audio?.id ?? message.video?.id ?? message.document?.id,
      mediaMimeType:
        message.image?.mime_type ??
        message.audio?.mime_type ??
        message.video?.mime_type ??
        message.document?.mime_type,
      mediaCaption:
        message.image?.caption ??
        message.video?.caption ??
        message.document?.filename,
      timestamp: new Date(parseInt(message.timestamp, 10) * 1000),
    };

    // Enqueue for async AI processing — worker picks this up within milliseconds
    await this.messageQueue.add(
      'process-message',
      { organizationId, webhookEventId: webhookEvent.id, parsed },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
      },
    );

    this.logger.log(
      `Queued message ${wamid} from ${parsed.fromPhone} for org ${organizationId}`,
    );
  }

  private async processStatusUpdate(
    organizationId: string,
    status: { id: string; status: string },
  ): Promise<void> {
    // Map Meta status to our MessageStatus enum
    const statusMap: Record<string, string> = {
      sent: 'SENT',
      delivered: 'DELIVERED',
      read: 'READ',
      failed: 'FAILED',
    };

    const mappedStatus = statusMap[status.status];
    if (!mappedStatus) return;

    await this.prisma.message.updateMany({
      where: { organizationId, whatsappMsgId: status.id },
      data: { status: mappedStatus as any },
    });
  }

  // Used by AI pipeline to send a response after processing
  async sendReply(
    organizationId: string,
    to: string,
    text: string,
  ): Promise<string> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        whatsappPhoneNumberId: true,
        whatsappAccessToken: true,
      },
    });

    if (!org?.whatsappPhoneNumberId || !org.whatsappAccessToken) {
      throw new Error(`Org ${organizationId} has no WhatsApp configured`);
    }

    const accessToken = this.encryption.decrypt(org.whatsappAccessToken);

    const result = await this.cloudService.sendText(
      org.whatsappPhoneNumberId,
      accessToken,
      to,
      text,
    );

    return result.wamid;
  }

  // Mark incoming message as read (double blue tick)
  async markRead(organizationId: string, wamid: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        whatsappPhoneNumberId: true,
        whatsappAccessToken: true,
      },
    });

    if (!org?.whatsappPhoneNumberId || !org.whatsappAccessToken) return;

    const accessToken = this.encryption.decrypt(org.whatsappAccessToken);
    await this.cloudService.markAsRead(
      org.whatsappPhoneNumberId,
      accessToken,
      wamid,
    );
  }
}
