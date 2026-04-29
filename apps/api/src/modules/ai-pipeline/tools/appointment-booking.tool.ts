import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../../../prisma/prisma.service';
import { ToolContext } from './lead-capture.tool';

export interface AppointmentArgs {
  title: string;
  scheduledAt: string; // ISO 8601
  durationMinutes?: number;
  location?: string;
  notes?: string;
}

@Injectable()
export class AppointmentBookingTool {
  private readonly logger = new Logger(AppointmentBookingTool.name);

  constructor(private readonly prisma: PrismaService) {}

  get definition(): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: 'book_appointment',
        description:
          'Agenda una cita o reunión con el negocio. ' +
          'Úsala cuando el usuario quiera agendar una visita, llamada, demostración o consulta.',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Tipo de cita: "Consulta", "Visita", "Demo de producto", etc.',
            },
            scheduledAt: {
              type: 'string',
              description: 'Fecha y hora en formato ISO 8601. Ejemplo: 2024-12-15T10:00:00',
            },
            durationMinutes: {
              type: 'number',
              description: 'Duración en minutos (default: 60)',
            },
            location: {
              type: 'string',
              description: 'Lugar: "Sucursal norte", "Zoom", "Domicilio", etc.',
            },
            notes: {
              type: 'string',
              description: 'Notas adicionales sobre la cita',
            },
          },
          required: ['title', 'scheduledAt'],
        },
      },
    };
  }

  async execute(args: AppointmentArgs, context: ToolContext): Promise<string> {
    try {
      const scheduledDate = new Date(args.scheduledAt);

      if (isNaN(scheduledDate.getTime())) {
        return 'La fecha proporcionada no es válida. Por favor especifica una fecha correcta.';
      }

      const appointment = await this.prisma.appointment.create({
        data: {
          organizationId: context.organizationId,
          conversationId: context.conversationId,
          contactId: context.contactId,
          title: args.title,
          scheduledAt: scheduledDate,
          durationMinutes: args.durationMinutes ?? 60,
          location: args.location ?? null,
          notes: args.notes ?? null,
          status: 'PENDING',
        },
      });

      const dateStr = scheduledDate.toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      this.logger.log(`Appointment created: ${appointment.id}`);
      return `Cita agendada: ${args.title} el ${dateStr}${args.location ? ` en ${args.location}` : ''}. Recibirás confirmación pronto.`;
    } catch (error) {
      this.logger.error('Failed to book appointment', error);
      return 'No pude agendar la cita en este momento. Por favor llámanos directamente.';
    }
  }
}
