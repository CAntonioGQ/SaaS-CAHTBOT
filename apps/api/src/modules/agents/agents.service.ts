import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/context/tenant.context';
import { TenantBaseService } from '../../common/services/tenant-base.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { AgentStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AgentsService extends TenantBaseService {
  constructor(
    prisma: PrismaService,
    tenantContext: TenantContext,
    private readonly config: ConfigService,
  ) {
    super(prisma, tenantContext);
  }

  async findAll() {
    return this.prisma.agent.findMany({
      where: { organizationId: this.orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        avatarUrl: true,
        status: true,
        tone: true,
        modelName: true,
        leadCaptureEnabled: true,
        appointmentEnabled: true,
        humanEscalationEnabled: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { conversations: true } },
      },
    });
  }

  async findOne(agentId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, organizationId: this.orgId },
    });

    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  async create(dto: CreateAgentDto) {
    // Check plan limit for max agents
    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId: this.orgId },
      include: { plan: true },
    });

    const agentCount = await this.prisma.agent.count({
      where: { organizationId: this.orgId, status: { not: 'INACTIVE' } },
    });

    if (subscription && agentCount >= subscription.plan.maxAgents) {
      throw new ForbiddenException(
        `Plan limit reached: max ${subscription.plan.maxAgents} agents. Upgrade to Starter for more.`,
      );
    }

    // Default models based on plan
    const isStarter = subscription?.plan.name === 'Starter';
    const defaultModel = isStarter
      ? this.config.get('MODEL_STARTER', 'deepseek/deepseek-chat-v3-0324')
      : this.config.get('MODEL_FREE', 'tencent/hy3-preview:free');
    const defaultFallback = this.config.get('MODEL_FALLBACK', 'deepseek/deepseek-chat-v3-0324');

    return this.prisma.agent.create({
      data: {
        organizationId: this.orgId,
        name: dto.name,
        description: dto.description,
        avatarUrl: dto.avatarUrl,
        tone: dto.tone ?? 'PROFESSIONAL',
        modelName: dto.modelName ?? defaultModel,
        fallbackModelName: dto.fallbackModelName ?? defaultFallback,
        systemPrompt: dto.systemPrompt,
        welcomeMessage: dto.welcomeMessage,
        fallbackMessage: dto.fallbackMessage,
        outsideHoursMessage: dto.outsideHoursMessage,
        temperature: dto.temperature ?? 0.3,
        maxTokens: dto.maxTokens ?? 500,
        contextMessages: dto.contextMessages ?? 12,
        leadCaptureEnabled: dto.leadCaptureEnabled ?? true,
        appointmentEnabled: dto.appointmentEnabled ?? false,
        inventoryEnabled: dto.inventoryEnabled ?? false,
        humanEscalationEnabled: dto.humanEscalationEnabled ?? true,
        businessHours: dto.businessHours ?? {},
        escalationKeywords: dto.escalationKeywords ?? [],
        escalationEmail: dto.escalationEmail,
        responseDelayMs: dto.responseDelayMs ?? 1500,
      },
    });
  }

  async update(agentId: string, dto: UpdateAgentDto) {
    await this.findOne(agentId); // throws 404 if not found or wrong org

    return this.prisma.agent.update({
      where: { id: agentId },
      data: dto as any,
    });
  }

  async setStatus(agentId: string, status: AgentStatus) {
    await this.findOne(agentId);

    return this.prisma.agent.update({
      where: { id: agentId },
      data: { status },
      select: { id: true, name: true, status: true, updatedAt: true },
    });
  }

  async remove(agentId: string) {
    await this.findOne(agentId);

    // Soft-delete: set status to INACTIVE instead of deleting
    // Keeps historical conversation data intact
    return this.prisma.agent.update({
      where: { id: agentId },
      data: { status: 'INACTIVE' },
    });
  }

  async getStats(agentId: string) {
    await this.findOne(agentId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalConversations, openConversations, analytics] = await Promise.all([
      this.prisma.conversation.count({
        where: { agentId, organizationId: this.orgId },
      }),
      this.prisma.conversation.count({
        where: {
          agentId,
          organizationId: this.orgId,
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_HUMAN', 'HUMAN_ACTIVE'] },
        },
      }),
      this.prisma.dailyAnalytics.findMany({
        where: {
          agentId,
          organizationId: this.orgId,
          date: { gte: thirtyDaysAgo },
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    const totals = analytics.reduce(
      (acc, day) => ({
        messages: acc.messages + day.totalMessages,
        leads: acc.leads + day.newLeads,
        escalations: acc.escalations + day.escalations,
        tokens: acc.tokens + day.totalTokensUsed,
        cost: acc.cost + Number(day.estimatedCostUsd),
      }),
      { messages: 0, leads: 0, escalations: 0, tokens: 0, cost: 0 },
    );

    return {
      totalConversations,
      openConversations,
      last30Days: totals,
      dailyBreakdown: analytics,
    };
  }
}
