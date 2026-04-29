import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/context/tenant.context';
import { TenantBaseService } from '../../common/services/tenant-base.service';

@Injectable()
export class MessagesService extends TenantBaseService {
  constructor(prisma: PrismaService, tenantContext: TenantContext) {
    super(prisma, tenantContext);
  }

  async findByConversation(conversationId: string, limit = 50, cursor?: string) {
    // Verify conversation belongs to this org
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId: this.orgId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    return this.prisma.message.findMany({
      where: { conversationId, organizationId: this.orgId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      select: {
        id: true,
        direction: true,
        type: true,
        status: true,
        content: true,
        mediaUrl: true,
        mediaCaption: true,
        isAiGenerated: true,
        modelUsed: true,
        toolCallName: true,
        sentByMemberId: true,
        whatsappTimestamp: true,
        createdAt: true,
      },
    });
  }
}
