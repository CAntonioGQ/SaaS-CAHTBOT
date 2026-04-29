import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../../../prisma/prisma.service';

export interface LeadCaptureArgs {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  interest: string;
  budget?: string;
}

export interface ToolContext {
  organizationId: string;
  conversationId: string;
  contactId: string;
}

@Injectable()
export class LeadCaptureTool {
  private readonly logger = new Logger(LeadCaptureTool.name);

  constructor(private readonly prisma: PrismaService) {}

  // OpenAI tool definition — this JSON schema is sent to the model
  // so it knows when and how to call this tool
  get definition(): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: 'capture_lead',
        description:
          'Captura información de contacto cuando un usuario muestra interés en productos o servicios. ' +
          'Úsala cuando el usuario exprese intención de compra, pida información de precios, ' +
          'o quiera ser contactado.',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Nombre completo del lead',
            },
            email: {
              type: 'string',
              description: 'Correo electrónico (si lo proporcionó)',
            },
            phone: {
              type: 'string',
              description: 'Teléfono adicional (si lo proporcionó)',
            },
            company: {
              type: 'string',
              description: 'Empresa o negocio (si aplica)',
            },
            interest: {
              type: 'string',
              description: 'En qué producto o servicio está interesado',
            },
            budget: {
              type: 'string',
              description: 'Presupuesto aproximado (si lo mencionó)',
            },
          },
          required: ['name', 'interest'],
        },
      },
    };
  }

  async execute(args: LeadCaptureArgs, context: ToolContext): Promise<string> {
    try {
      await this.prisma.lead.create({
        data: {
          organizationId: context.organizationId,
          conversationId: context.conversationId,
          contactId: context.contactId,
          name: args.name,
          email: args.email ?? null,
          phone: args.phone ?? null,
          company: args.company ?? null,
          interest: args.interest,
          budget: args.budget ?? null,
          source: 'whatsapp',
          status: 'NEW',
        },
      });

      // Update contact name if we just learned it
      if (args.name) {
        await this.prisma.contact.update({
          where: { id: context.contactId },
          data: { name: args.name, email: args.email ?? undefined },
        });
      }

      this.logger.log(`Lead captured for org ${context.organizationId}: ${args.name}`);
      return `Lead capturado correctamente para ${args.name}.`;
    } catch (error) {
      this.logger.error('Failed to capture lead', error);
      return 'No pude registrar tus datos en este momento. Por favor intenta de nuevo.';
    }
  }
}
