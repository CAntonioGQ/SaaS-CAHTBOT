import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';

// Verifies that incoming webhook POST requests genuinely come from Meta.
// Meta signs the raw request body with your App Secret using HMAC-SHA256
// and puts the result in the X-Hub-Signature-256 header.
//
// SECURITY: We use crypto.timingSafeEqual instead of === for comparison.
// Normal string comparison short-circuits on the first mismatched byte —
// an attacker could measure response times to guess the signature bit by bit.
// timingSafeEqual always takes the same time regardless of where they differ.
@Injectable()
export class WhatsAppSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WhatsAppSignatureGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RawBodyRequest<Request>>();

    const signature = request.headers['x-hub-signature-256'] as string;

    if (!signature) {
      this.logger.warn('WhatsApp webhook request missing X-Hub-Signature-256');
      throw new UnauthorizedException('Missing X-Hub-Signature-256 header');
    }

    const appSecret = this.config.get<string>('WHATSAPP_APP_SECRET', '');
    if (!appSecret) {
      this.logger.error('WHATSAPP_APP_SECRET not configured');
      throw new UnauthorizedException('Webhook signature verification not configured');
    }

    const rawBody = request.rawBody;
    if (!rawBody || rawBody.length === 0) {
      throw new UnauthorizedException(
        'Raw body unavailable — ensure rawBody: true in NestFactory.create()',
      );
    }

    // Compute expected signature: sha256=HMAC(appSecret, rawBody)
    const expectedSignature =
      'sha256=' +
      crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    // Buffers must be same length before timingSafeEqual (throws if not)
    if (sigBuffer.length !== expectedBuffer.length) {
      this.logger.warn('WhatsApp webhook signature length mismatch');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      this.logger.warn('WhatsApp webhook HMAC signature mismatch');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
