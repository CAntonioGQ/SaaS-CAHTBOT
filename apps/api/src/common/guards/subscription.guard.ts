import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../context/tenant.context';

// Blocks write operations if the organization's subscription is expired/cancelled.
// Apply to routes that consume quota: POST /conversations, POST /messages, etc.
// GET routes and webhooks should NOT use this guard.
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const organizationId = this.tenantContext.organizationId;

    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId },
      select: {
        status: true,
        currentPeriodEnd: true,
        maxMessagesAtPurchase: true,
        maxConversationsAtPurchase: true,
        messagesUsed: true,
        conversationsUsed: true,
      },
    });

    if (!subscription) {
      throw new ForbiddenException('No active subscription found');
    }

    const blockedStatuses = ['CANCELLED', 'INCOMPLETE'];
    if (blockedStatuses.includes(subscription.status)) {
      throw new ForbiddenException(
        'Subscription is inactive. Please renew your plan.',
      );
    }

    // Check if period has expired (for non-Stripe free plans)
    if (subscription.currentPeriodEnd < new Date()) {
      throw new ForbiddenException(
        'Subscription period has expired. Please renew.',
      );
    }

    return true;
  }
}
