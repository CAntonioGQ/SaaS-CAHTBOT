import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../../../prisma/prisma.service';
import { ToolContext } from './lead-capture.tool';

export interface InventoryArgs {
  query: string;  // what the user is looking for
  category?: string;
}

@Injectable()
export class InventoryLookupTool {
  private readonly logger = new Logger(InventoryLookupTool.name);

  constructor(private readonly prisma: PrismaService) {}

  get definition(): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: 'check_inventory',
        description:
          'Consulta disponibilidad, precio o características de productos. ' +
          'Úsala cuando el usuario pregunte por stock, precios o información de productos.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Producto o categoría a buscar',
            },
            category: {
              type: 'string',
              description: 'Categoría de producto (opcional)',
            },
          },
          required: ['query'],
        },
      },
    };
  }

  async execute(args: InventoryArgs, context: ToolContext): Promise<string> {
    // Fetch agent's inventory webhook URL from DB
    const agent = await this.prisma.agent.findFirst({
      where: { organizationId: context.organizationId, status: 'ACTIVE' },
      select: { inventoryWebhookUrl: true, inventoryWebhookSecret: true },
    });

    if (!agent?.inventoryWebhookUrl) {
      return 'El sistema de inventario no está configurado aún. Por favor consulta directamente con nuestro equipo.';
    }

    try {
      const response = await fetch(agent.inventoryWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(agent.inventoryWebhookSecret
            ? { Authorization: `Bearer ${agent.inventoryWebhookSecret}` }
            : {}),
        },
        body: JSON.stringify({ query: args.query, category: args.category }),
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      if (!response.ok) {
        return 'No pude consultar el inventario en este momento. Por favor contacta directamente.';
      }

      const data = await response.json() as { result?: string; message?: string };
      return data.result ?? data.message ?? 'Información de inventario no disponible.';
    } catch (error) {
      this.logger.error(`Inventory webhook error for org ${context.organizationId}`, error);
      return 'No pude consultar el inventario en este momento.';
    }
  }
}
