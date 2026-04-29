import { Injectable, Logger } from '@nestjs/common';
import { LeadCaptureTool, ToolContext } from './tools/lead-capture.tool';
import { AppointmentBookingTool } from './tools/appointment-booking.tool';
import { HumanEscalationTool } from './tools/human-escalation.tool';
import { InventoryLookupTool } from './tools/inventory-lookup.tool';

// Dispatches tool calls from the AI model to the correct tool implementation.
// When GPT/DeepSeek returns tool_calls in its response, this service
// finds the right tool and executes it with the provided arguments.
@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);

  constructor(
    private readonly leadCaptureTool: LeadCaptureTool,
    private readonly appointmentTool: AppointmentBookingTool,
    private readonly escalationTool: HumanEscalationTool,
    private readonly inventoryTool: InventoryLookupTool,
  ) {}

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<string> {
    this.logger.log(`Executing tool: ${toolName}`);

    switch (toolName) {
      case 'capture_lead':
        return this.leadCaptureTool.execute(args as any, context);

      case 'book_appointment':
        return this.appointmentTool.execute(args as any, context);

      case 'escalate_to_human':
        return this.escalationTool.execute(args as any, context);

      case 'check_inventory':
        return this.inventoryTool.execute(args as any, context);

      default:
        this.logger.warn(`Unknown tool called: ${toolName}`);
        return `Tool "${toolName}" not implemented.`;
    }
  }
}
