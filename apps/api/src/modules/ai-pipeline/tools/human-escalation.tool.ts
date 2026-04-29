import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../../../prisma/prisma.service';
import { ToolContext } from './lead-capture.tool';

export interface EscalationArgs {
  reason: string;
}

export const ESCALATION_RESULT = '__ESCALATED__'; // sentinel value

@Injectable()
export class HumanEscalationTool {
  private readonly logger = new Logger(HumanEscalationTool.name);

  constructor(private readonly prisma: PrismaService) {}

  get definition(): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: 'escalate_to_human',
        description:
          'Transfiere la conversación a un agente humano. ' +
          'Úsala cuando: el usuario lo pida explícitamente, exprese frustración o enojo, ' +
          'el problema sea muy complejo para el bot, o la consulta requiera decisiones ' +
          'que solo un humano puede tomar.',
        parameters: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              description: 'Motivo de la transferencia (para el agente humano)',
            },
          },
          required: ['reason'],
        },
      },
    };
  }

  async execute(args: EscalationArgs, context: ToolContext): Promise<string> {
    try {
      await this.prisma.conversation.update({
        where: { id: context.conversationId },
        data: {
          status: 'WAITING_HUMAN',
          escalatedAt: new Date(),
        },
      });

      this.logger.log(
        `Conversation ${context.conversationId} escalated: ${args.reason}`,
      );

      // Return sentinel — AI pipeline checks for this to stop further AI responses
      return ESCALATION_RESULT;
    } catch (error) {
      this.logger.error('Failed to escalate conversation', error);
      return ESCALATION_RESULT; // still escalate even if DB update fails
    }
  }
}
