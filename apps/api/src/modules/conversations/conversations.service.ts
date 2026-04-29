import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/context/tenant.context';
import { TenantBaseService } from '../../common/services/tenant-base.service';

export interface ConversationFilters {
  status?: string;
  agentId?: string;
  assignedMemberId?: string;
  isTest?: boolean;
  limit?: number;
  cursor?: string;
}

@Injectable()
export class ConversationsService extends TenantBaseService {
  constructor(prisma: PrismaService, tenantContext: TenantContext) {
    super(prisma, tenantContext);
  }

  async findAll(filters: ConversationFilters = {}) {
    const { status, agentId, assignedMemberId, isTest = false, limit = 30, cursor } = filters;

    return this.prisma.conversation.findMany({
      where: {
        organizationId: this.orgId,
        isTest,
        ...(status && { status: status as any }),
        ...(agentId && { agentId }),
        ...(assignedMemberId && { assignedMemberId }),
      },
      include: {
        contact: {
          select: { id: true, name: true, whatsappPhone: true, avatarUrl: true },
        },
        agent: { select: { id: true, name: true, avatarUrl: true } },
        assignedMember: {
          select: {
            id: true,
            role: true,
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });
  }

  async findOne(conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId: this.orgId },
      include: {
        contact: true,
        agent: {
          select: {
            id: true, name: true, avatarUrl: true,
            humanEscalationEnabled: true, leadCaptureEnabled: true,
          },
        },
        assignedMember: {
          select: {
            id: true, role: true,
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  async escalate(conversationId: string, reason?: string) {
    const conv = await this.findOne(conversationId);

    if (conv.status === 'HUMAN_ACTIVE') {
      throw new ForbiddenException('Conversation already has a human agent');
    }

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'WAITING_HUMAN',
        escalatedAt: new Date(),
      },
    });
  }

  async assign(conversationId: string, memberId: string) {
    await this.findOne(conversationId);

    // Verify member belongs to this org
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: this.orgId, isActive: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedMemberId: memberId,
        status: 'HUMAN_ACTIVE',
      },
    });
  }

  async resolve(conversationId: string) {
    await this.findOne(conversationId);

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        unreadCount: 0,
      },
    });
  }

  async markRead(conversationId: string) {
    await this.findOne(conversationId);

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });
  }
}
