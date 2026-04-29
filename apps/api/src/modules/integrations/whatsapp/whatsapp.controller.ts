import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppSignatureGuard } from './guards/whatsapp-signature.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { WhatsAppWebhookBody } from '@empleado-ia/shared-types';

@ApiTags('Integrations / WhatsApp')
@Controller('integrations/whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(private readonly whatsappService: WhatsAppService) {}

  // ─── Webhook Verification (GET) ───────────────────────────────────────────
  // Meta calls this once when you register the webhook URL in the dashboard.
  // Must respond with the challenge value as PLAIN TEXT (not JSON).
  // @Public() because Meta doesn't send an auth token — it uses the verify_token param.
  @Public()
  @Get('webhook')
  @ApiOperation({ summary: 'Meta webhook verification challenge' })
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const challengeValue = this.whatsappService.verifyWebhook(mode, token, challenge);
    // IMPORTANT: send plain text, not JSON — Meta checks the raw response body
    res.setHeader('Content-Type', 'text/plain');
    res.send(challengeValue);
  }

  // ─── Receive Inbound Messages (POST) ──────────────────────────────────────
  // Meta sends every incoming message, delivery receipt, and read receipt here.
  // WhatsAppSignatureGuard verifies HMAC before we touch the payload.
  // Must return HTTP 200 within ~5 seconds — we acknowledge immediately and
  // process asynchronously via BullMQ queue.
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WhatsAppSignatureGuard)
  @ApiExcludeEndpoint() // don't expose in Swagger — internal Meta endpoint
  async receive(@Body() body: WhatsAppWebhookBody) {
    // Fire-and-forget — handleWebhook enqueues jobs and returns quickly
    this.whatsappService.handleWebhook(body).catch((err) => {
      this.logger.error('Error handling WhatsApp webhook', err);
    });

    // Return 200 immediately — Meta marks the delivery successful
    return { status: 'ok' };
  }
}
