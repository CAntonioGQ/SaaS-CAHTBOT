import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/context/tenant.context';
import { TenantBaseService } from '../../common/services/tenant-base.service';

@Injectable()
export class AnalyticsService extends TenantBaseService {
  constructor(prisma: PrismaService, tenantContext: TenantContext) {
    super(prisma, tenantContext);
  }

  async getOverview() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalConversations,
      openConversations,
      totalLeads,
      newLeadsToday,
      subscription,
      last30Days,
    ] = await Promise.all([
      this.prisma.conversation.count({ where: { organizationId: this.orgId } }),
      this.prisma.conversation.count({
        where: {
          organizationId: this.orgId,
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_HUMAN', 'HUMAN_ACTIVE'] },
        },
      }),
      this.prisma.lead.count({ where: { organizationId: this.orgId } }),
      this.prisma.lead.count({
        where: { organizationId: this.orgId, createdAt: { gte: today } },
      }),
      this.prisma.subscription.findUnique({
        where: { organizationId: this.orgId },
        include: { plan: true },
      }),
      this.prisma.dailyAnalytics.findMany({
        where: {
          organizationId: this.orgId,
          agentId: null, // org-level aggregate
          date: { gte: thirtyDaysAgo },
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    const totals = last30Days.reduce(
      (acc, d) => ({
        messages: acc.messages + d.totalMessages,
        leads: acc.leads + d.newLeads,
        escalations: acc.escalations + d.escalations,
        tokens: acc.tokens + d.totalTokensUsed,
        cost: acc.cost + Number(d.estimatedCostUsd),
      }),
      { messages: 0, leads: 0, escalations: 0, tokens: 0, cost: 0 },
    );

    return {
      conversations: { total: totalConversations, open: openConversations },
      leads: { total: totalLeads, newToday: newLeadsToday },
      usage: {
        messagesUsed: subscription?.messagesUsed ?? 0,
        messagesLimit: subscription?.maxMessagesAtPurchase ?? subscription?.plan.maxMessagesPerMonth ?? 0,
        conversationsUsed: subscription?.conversationsUsed ?? 0,
        conversationsLimit: subscription?.maxConversationsAtPurchase ?? subscription?.plan.maxConversationsPerMonth ?? 0,
      },
      last30Days: totals,
      dailyChart: last30Days,
    };
  }

  async getByAgent(agentId: string, days = 30) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    return this.prisma.dailyAnalytics.findMany({
      where: {
        organizationId: this.orgId,
        agentId,
        date: { gte: start },
      },
      orderBy: { date: 'asc' },
    });
  }
}
