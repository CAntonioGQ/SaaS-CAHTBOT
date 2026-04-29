import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenRouterService } from './openrouter.service';
import { ToolExecutorService } from './tool-executor.service';
import { LeadCaptureTool } from './tools/lead-capture.tool';
import { AppointmentBookingTool } from './tools/appointment-booking.tool';
import { HumanEscalationTool, ESCALATION_RESULT } from './tools/human-escalation.tool';
import { InventoryLookupTool } from './tools/inventory-lookup.tool';
import {
  CONVERSATION_SUMMARY_QUEUE,
  SummaryJob,
} from '../queue/processors/conversation-summary.processor';
import { Agent, Conversation, Contact } from '@prisma/client';

export interface PipelineInput {
  conversation: Conversation & { agent: Agent; contact: Contact };
  inboundText: string;
  organizationId: string;
}

export interface PipelineResult {
  responseText: string;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  wasEscalated: boolean;
  toolsUsed: string[];
}

@Injectable()
export class AiPipelineService {
  private readonly logger = new Logger(AiPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openrouter: OpenRouterService,
    private readonly toolExecutor: ToolExecutorService,
    private readonly leadTool: LeadCaptureTool,
    private readonly appointmentTool: AppointmentBookingTool,
    private readonly escalationTool: HumanEscalationTool,
    private readonly inventoryTool: InventoryLookupTool,
    @InjectQueue(CONVERSATION_SUMMARY_QUEUE)
    private readonly summaryQueue: Queue<SummaryJob>,
  ) {}

  async run(input: PipelineInput): Promise<PipelineResult> {
    const start = Date.now();
    const { conversation, inboundText, organizationId } = input;
    const agent = conversation.agent;
    const contact = conversation.contact;

    const toolsUsed: string[] = [];
    let wasEscalated = false;

    // ── Build messages array for the model ─────────────────────────────────
    const messages = await this.buildMessages(conversation, agent, inboundText);

    // ── Select tools based on agent feature flags ──────────────────────────
    const tools = this.buildTools(agent);

    // ── Call OpenRouter with primary → fallback ────────────────────────────
    const { response, modelUsed } = await this.openrouter.chatWithFallback(
      agent.modelName,
      agent.fallbackModelName,
      messages,
      tools,
      agent.temperature,
      agent.maxTokens,
    );

    const choice = response.choices[0];
    let finalText: string;
    let totalPromptTokens = response.usage?.prompt_tokens ?? 0;
    let totalCompletionTokens = response.usage?.completion_tokens ?? 0;

    // ── Handle tool calls ──────────────────────────────────────────────────
    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      const toolContext = {
        organizationId,
        conversationId: conversation.id,
        contactId: contact.id,
      };

      // Execute all tool calls (models sometimes call multiple tools at once)
      const toolResults: OpenAI.ChatCompletionToolMessageParam[] = [];

      for (const toolCall of choice.message.tool_calls) {
        const toolName = toolCall.function.name;
        let args: Record<string, unknown> = {};

        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          this.logger.warn(`Failed to parse tool args for ${toolName}`);
        }

        const result = await this.toolExecutor.execute(toolName, args, toolContext);
        toolsUsed.push(toolName);

        if (result === ESCALATION_RESULT) {
          wasEscalated = true;
        }

        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // If escalated, send a fixed message — don't call model again
      if (wasEscalated) {
        finalText =
          'Entendido, en un momento un asesor se comunicará contigo. ¡Gracias por tu paciencia!';
      } else {
        // Second call to model with tool results — gets the final natural language response
        const secondMessages: OpenAI.ChatCompletionMessageParam[] = [
          ...messages,
          choice.message,
          ...toolResults,
        ];

        const secondResponse = await this.openrouter.chat(
          modelUsed,
          secondMessages,
          undefined, // no tools on second call
          agent.temperature,
          agent.maxTokens,
        );

        finalText = secondResponse.choices[0].message.content ?? agent.fallbackMessage;
        totalPromptTokens += secondResponse.usage?.prompt_tokens ?? 0;
        totalCompletionTokens += secondResponse.usage?.completion_tokens ?? 0;
      }
    } else {
      // Normal text response (no tool calls)
      finalText = choice.message.content ?? agent.fallbackMessage;
    }

    const latencyMs = Date.now() - start;

    // ── Trigger memory compression every 15 messages ───────────────────────
    const newCount = (conversation.messageCount ?? 0) + 2; // inbound + outbound
    if (newCount % 15 === 0) {
      await this.summaryQueue.add('summarize', {
        organizationId,
        conversationId: conversation.id,
        keepLastN: agent.contextMessages,
      });
    }

    return {
      responseText: finalText,
      modelUsed,
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      latencyMs,
      wasEscalated,
      toolsUsed,
    };
  }

  private async buildMessages(
    conversation: Conversation,
    agent: Agent,
    inboundText: string,
  ): Promise<OpenAI.ChatCompletionMessageParam[]> {
    // Fetch last N messages for context window
    const history = await this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: agent.contextMessages,
      select: { direction: true, content: true },
    });

    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    // System prompt
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(agent, conversation.contact as Contact),
    });

    // Previous context summary (memory compression)
    if (conversation.summary) {
      messages.push({
        role: 'system',
        content: `Resumen del contexto previo de la conversación:\n${conversation.summary}`,
      });
    }

    // Recent messages in chronological order (we fetched desc, so reverse)
    for (const msg of history.reverse()) {
      messages.push({
        role: msg.direction === 'INBOUND' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    // Current inbound message
    messages.push({ role: 'user', content: inboundText });

    return messages;
  }

  private buildSystemPrompt(agent: Agent, contact: Contact): string {
    const now = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      dateStyle: 'full',
      timeStyle: 'short',
    });

    return `${agent.systemPrompt}

INSTRUCCIONES IMPORTANTES:
- Responde en español a menos que el usuario escriba en otro idioma.
- Eres un agente de WhatsApp. Máximo 1500 caracteres por respuesta.
- NO uses tablas markdown, asteriscos de negritas, ni listas con guiones largos.
- Usa emojis con moderación (máximo 1-2 por mensaje).
- Nombre del contacto: ${contact.name ?? 'Desconocido'}
- Fecha y hora actual: ${now}
- Tono de comunicación: ${agent.tone}`;
  }

  private buildTools(agent: Agent): OpenAI.ChatCompletionTool[] {
    const tools: OpenAI.ChatCompletionTool[] = [];

    if (agent.leadCaptureEnabled) {
      tools.push(this.leadTool.definition);
    }
    if (agent.appointmentEnabled) {
      tools.push(this.appointmentTool.definition);
    }
    if (agent.inventoryEnabled) {
      tools.push(this.inventoryTool.definition);
    }
    if (agent.humanEscalationEnabled) {
      tools.push(this.escalationTool.definition);
    }

    return tools;
  }
}
