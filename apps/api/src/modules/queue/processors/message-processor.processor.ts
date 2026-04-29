import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { MESSAGE_PROCESSING_QUEUE, MessageJob } from '../../integrations/whatsapp/whatsapp.service';

// WorkerHost: base class for BullMQ processors in NestJS.
// @Processor decorator registers this class as the consumer for the queue.
// process() is called for every job dequeued from Redis.
// Think of this as a Celery task in Python: @app.task(bind=True) def process(self, job).
@Processor(MESSAGE_PROCESSING_QUEUE, {
  concurrency: 5, // process up to 5 messages in parallel
})
export class MessageProcessorProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageProcessorProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    // AiPipelineService and WhatsAppService will be injected here once implemented.
    // Using any for now to avoid circular dependency before those modules exist.
  ) {
    super();
  }

  async process(job: Job<MessageJob>): Promise<void> {
    const { organizationId, webhookEventId, parsed } = job.data;

    this.logger.log(
      `Processing message ${parsed.wamid} from ${parsed.fromPhone} [org: ${organizationId}]`,
    );

    try {
      // Mark webhook event as PROCESSING
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { status: 'PROCESSING' },
      });

      // ── Step 1: Find active agent for this org ──────────────────────────
      const agent = await this.prisma.agent.findFirst({
        where: { organizationId, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });

      if (!agent) {
        this.logger.warn(`No active agent for org ${organizationId} — skipping`);
        await this.markEventSkipped(webhookEventId, 'No active agent');
        return;
      }

      // ── Step 2: Find or create Contact ─────────────────────────────────
      const contact = await this.prisma.contact.upsert({
        where: {
          organizationId_whatsappPhone: {
            organizationId,
            whatsappPhone: parsed.fromPhone,
          },
        },
        create: {
          organizationId,
          whatsappPhone: parsed.fromPhone,
          name: parsed.contactName ?? null,
          lastSeenAt: new Date(),
        },
        update: {
          lastSeenAt: new Date(),
          name: parsed.contactName ?? undefined,
        },
      });

      // ── Step 3: Find or create open Conversation ────────────────────────
      let conversation = await this.prisma.conversation.findFirst({
        where: {
          organizationId,
          agentId: agent.id,
          contactId: contact.id,
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_HUMAN'] },
        },
        orderBy: { lastMessageAt: 'desc' },
      });

      if (!conversation) {
        conversation = await this.prisma.conversation.create({
          data: {
            organizationId,
            agentId: agent.id,
            contactId: contact.id,
            status: 'OPEN',
            firstMessageAt: parsed.timestamp,
            lastMessageAt: parsed.timestamp,
            channelType: 'whatsapp',
          },
        });
      }

      // ── Step 4: Persist inbound Message ────────────────────────────────
      await this.prisma.message.create({
        data: {
          organizationId,
          conversationId: conversation.id,
          direction: 'INBOUND',
          type: this.mapMessageType(parsed.type),
          status: 'DELIVERED',
          content: parsed.text ?? `[${parsed.type}]`,
          mediaType: parsed.mediaMimeType ?? null,
          whatsappMsgId: parsed.wamid,
          whatsappTimestamp: parsed.timestamp,
          isAiGenerated: false,
        },
      });

      // ── Step 5: Update conversation counters ────────────────────────────
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: parsed.timestamp,
          messageCount: { increment: 1 },
          unreadCount: { increment: 1 },
          status: 'IN_PROGRESS',
        },
      });

      // ── Step 6: Check if human is handling — skip AI ────────────────────
      if (conversation.status === 'HUMAN_ACTIVE') {
        this.logger.log(`Conversation ${conversation.id} is HUMAN_ACTIVE — skipping AI`);
        await this.markEventProcessed(webhookEventId);
        return;
      }

      // ── Step 7: Check business hours ───────────────────────────────────
      if (!this.isWithinBusinessHours(agent.businessHours as any)) {
        this.logger.log(`Outside business hours for agent ${agent.id}`);
        // TODO: send outsideHoursMessage via WhatsAppService
        // Will be wired up once AiPipelineModule is implemented
        await this.markEventProcessed(webhookEventId);
        return;
      }

      // ── Step 8: AI pipeline (wired in Phase 2 of implementation) ────────
      // TODO: inject AiPipelineService and call:
      //   await this.aiPipeline.run({ conversation, agent, contact, parsed });
      // For now, mark as processed
      this.logger.log(
        `Message ${parsed.wamid} ready for AI pipeline — pipeline not yet wired`,
      );

      await this.markEventProcessed(webhookEventId);
    } catch (error) {
      this.logger.error(
        `Failed processing ${parsed.wamid}: ${(error as Error).message}`,
        (error as Error).stack,
      );

      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: job.attemptsMade >= (job.opts.attempts ?? 3) - 1 ? 'FAILED' : 'RETRYING',
          errorMessage: (error as Error).message,
          retryCount: { increment: 1 },
          nextRetryAt: job.attemptsMade < (job.opts.attempts ?? 3) - 1
            ? new Date(Date.now() + 5000 * Math.pow(2, job.attemptsMade))
            : null,
        },
      });

      throw error; // rethrow so BullMQ triggers the retry
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<MessageJob>) {
    this.logger.debug(`Job ${job.id} completed for ${job.data.parsed.wamid}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<MessageJob> | undefined, error: Error) {
    this.logger.error(
      `Job ${job?.id} failed permanently: ${error.message}`,
    );
  }

  private async markEventProcessed(webhookEventId: string): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { status: 'PROCESSED', processedAt: new Date() },
    });
  }

  private async markEventSkipped(
    webhookEventId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { status: 'SKIPPED', errorMessage: reason, processedAt: new Date() },
    });
  }

  private mapMessageType(type: string): 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'INTERACTIVE' | 'SYSTEM' {
    const map: Record<string, 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'INTERACTIVE' | 'SYSTEM'> = {
      text: 'TEXT',
      image: 'IMAGE',
      audio: 'AUDIO',
      video: 'VIDEO',
      document: 'DOCUMENT',
      interactive: 'INTERACTIVE',
      sticker: 'IMAGE',
    };
    return map[type] ?? 'TEXT';
  }

  private isWithinBusinessHours(
    businessHours: Record<string, { enabled: boolean; open: string; close: string }>,
  ): boolean {
    if (!businessHours || Object.keys(businessHours).length === 0) {
      return true; // no hours configured = always open
    }

    const now = new Date();
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const today = dayNames[now.getDay()];
    const slot = businessHours[today];

    if (!slot || !slot.enabled) return false;

    const [openH, openM] = slot.open.split(':').map(Number);
    const [closeH, closeM] = slot.close.split(':').map(Number);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  }
}
