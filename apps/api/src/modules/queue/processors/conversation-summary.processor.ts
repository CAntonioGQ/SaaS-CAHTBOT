import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';

export const CONVERSATION_SUMMARY_QUEUE = 'conversation-summary';

export interface SummaryJob {
  organizationId: string;
  conversationId: string;
  keepLastN: number; // how many recent messages to keep raw (default 12)
}

// Compresses older conversation messages into a summary stored in Conversation.summary.
// This is the memory compression pattern — instead of sending all N messages to the AI
// on every request (expensive), we summarize old ones and only send the last 12 raw.
//
// Triggered by MessageProcessorProcessor when messageCount % 15 === 0.
// Uses the cheapest available model (DeepSeek V3) since this is background work.
@Processor(CONVERSATION_SUMMARY_QUEUE, {
  concurrency: 3,
})
export class ConversationSummaryProcessor extends WorkerHost {
  private readonly logger = new Logger(ConversationSummaryProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<SummaryJob>): Promise<void> {
    const { organizationId, conversationId, keepLastN } = job.data;

    this.logger.log(`Summarizing conversation ${conversationId}`);

    // Get ALL messages ordered by time
    const allMessages = await this.prisma.message.findMany({
      where: { conversationId, organizationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        direction: true,
        content: true,
        createdAt: true,
        isAiGenerated: true,
        excludeFromSummary: true,
      },
    });

    if (allMessages.length <= keepLastN) {
      // Nothing to compress yet
      return;
    }

    // Split: messages to summarize vs messages to keep raw
    const toSummarize = allMessages.slice(0, allMessages.length - keepLastN);
    const previousSummary = await this.prisma.conversation
      .findUnique({
        where: { id: conversationId },
        select: { summary: true },
      })
      .then((c) => c?.summary ?? null);

    // Build the text to summarize
    const messageText = toSummarize
      .filter((m) => !m.excludeFromSummary)
      .map((m) => {
        const role = m.direction === 'INBOUND' ? 'Cliente' : 'Agente';
        return `${role}: ${m.content}`;
      })
      .join('\n');

    if (!messageText.trim()) return;

    // TODO: Call OpenRouter with DeepSeek V3 to generate summary.
    // Will be wired once AiPipelineModule is implemented.
    // For now, build a simple placeholder summary.
    const newSummary = await this.generateSummary(
      messageText,
      previousSummary,
    );

    // Update conversation with new summary and timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        summary: newSummary,
        lastSummarizedAt: new Date(),
      },
    });

    this.logger.log(
      `Conversation ${conversationId} summarized (${toSummarize.length} messages → summary)`,
    );
  }

  private async generateSummary(
    messageText: string,
    previousSummary: string | null,
  ): Promise<string> {
    // Placeholder — will be replaced by actual OpenRouter call
    // once AiPipelineModule is wired up
    const prefix = previousSummary
      ? `Resumen previo: ${previousSummary}\n\nNuevos mensajes:\n`
      : 'Mensajes:\n';

    return `${prefix}${messageText.substring(0, 500)}... [resumen pendiente de generar]`;
  }
}
