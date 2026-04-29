import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/context/tenant.context';
import { TenantBaseService } from '../../common/services/tenant-base.service';

@Injectable()
export class BillingService extends TenantBaseService {
  private readonly stripe: Stripe;

  constructor(
    prisma: PrismaService,
    tenantContext: TenantContext,
    private readonly config: ConfigService,
  ) {
    super(prisma, tenantContext);
    this.stripe = new Stripe(config.get<string>('STRIPE_SECRET_KEY', ''), {
      apiVersion: '2024-06-20',
    });
  }

  async getPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    });
  }

  async getSubscription() {
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId: this.orgId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  async createCheckoutSession(planId: string): Promise<{ url: string }> {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan?.stripePriceId) throw new NotFoundException('Plan not found or is free');

    const org = await this.prisma.organization.findUnique({
      where: { id: this.orgId },
      select: { name: true },
    });

    const existingSub = await this.prisma.subscription.findUnique({
      where: { organizationId: this.orgId },
      select: { stripeCustomerId: true },
    });

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${this.config.get('WEB_URL')}/dashboard/settings/billing?success=1`,
      cancel_url: `${this.config.get('WEB_URL')}/dashboard/settings/billing?cancelled=1`,
      customer: existingSub?.stripeCustomerId ?? undefined,
      customer_creation: existingSub?.stripeCustomerId ? undefined : 'always',
      metadata: { organizationId: this.orgId, planId },
    });

    return { url: session.url! };
  }

  async createPortalSession(): Promise<{ url: string }> {
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId: this.orgId },
      select: { stripeCustomerId: true },
    });

    if (!sub?.stripeCustomerId) {
      throw new NotFoundException('No Stripe customer — not subscribed to a paid plan');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${this.config.get('WEB_URL')}/dashboard/settings/billing`,
    });

    return { url: session.url };
  }
}
