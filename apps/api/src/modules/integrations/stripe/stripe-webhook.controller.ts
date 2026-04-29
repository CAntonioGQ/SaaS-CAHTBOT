import {
  Controller,
  Post,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { PrismaService } from '../../../prisma/prisma.service';
import { Public } from '../../../common/decorators/public.decorator';
import { ApiExcludeEndpoint } from '@nestjs/swagger';

// Stripe webhook handler — processes subscription lifecycle events.
// MUST be @Public() — Stripe sends these without our JWT auth token.
// Signature verified via stripe.webhooks.constructEvent() before any processing.
// Uses raw body (rawBody: true in main.ts) — Stripe requires the exact bytes.
@Controller('integrations/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(config.get<string>('STRIPE_SECRET_KEY', ''), {
      apiVersion: '2024-06-20',
    });
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET', '');

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(req.rawBody!, sig, webhookSecret);
    } catch (err) {
      this.logger.warn(`Stripe webhook signature failed: ${(err as Error).message}`);
      res.status(400).send(`Webhook Error: ${(err as Error).message}`);
      return;
    }

    try {
      await this.processEvent(event);
      res.json({ received: true });
    } catch (err) {
      this.logger.error(`Error processing Stripe event ${event.type}`, err);
      res.status(500).json({ error: 'Processing failed' });
    }
  }

  private async processEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Stripe event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionUpdated(sub);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionDeleted(sub);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.handlePaymentFailed(invoice);
        break;
      }

      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (session.mode !== 'subscription') return;

    const { organizationId, planId } = session.metadata ?? {};
    if (!organizationId || !planId) return;

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return;

    const stripeSub = await this.stripe.subscriptions.retrieve(
      session.subscription as string,
    );

    await this.prisma.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        planId,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: stripeSub.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        priceUsdAtPurchase: plan.priceMonthly,
        maxMessagesAtPurchase: plan.maxMessagesPerMonth,
        maxConversationsAtPurchase: plan.maxConversationsPerMonth,
      },
      update: {
        planId,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: stripeSub.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        priceUsdAtPurchase: plan.priceMonthly,
        maxMessagesAtPurchase: plan.maxMessagesPerMonth,
        maxConversationsAtPurchase: plan.maxConversationsPerMonth,
      },
    });

    this.logger.log(`Org ${organizationId} upgraded to plan ${plan.name}`);
  }

  private async handleSubscriptionUpdated(stripeSub: Stripe.Subscription) {
    const statusMap: Record<string, string> = {
      active: 'ACTIVE',
      past_due: 'PAST_DUE',
      canceled: 'CANCELLED',
      trialing: 'TRIALING',
      incomplete: 'INCOMPLETE',
    };

    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: stripeSub.id },
      data: {
        status: (statusMap[stripeSub.status] ?? 'ACTIVE') as any,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
    });
  }

  private async handleSubscriptionDeleted(stripeSub: Stripe.Subscription) {
    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: stripeSub.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    await this.prisma.subscription.updateMany({
      where: { stripeCustomerId: invoice.customer as string },
      data: { status: 'PAST_DUE' },
    });
  }
}
