import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/context/tenant.context';
import { TenantBaseService } from '../../common/services/tenant-base.service';

@Injectable()
export class ContactsService extends TenantBaseService {
  constructor(prisma: PrismaService, tenantContext: TenantContext) {
    super(prisma, tenantContext);
  }

  async findAll(search?: string, limit = 50, cursor?: string) {
    return this.prisma.contact.findMany({
      where: {
        organizationId: this.orgId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { whatsappPhone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        _count: { select: { conversations: true, leads: true } },
      },
      orderBy: { lastSeenAt: 'desc' },
      take: limit,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });
  }

  async findOne(contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId: this.orgId },
      include: {
        conversations: {
          select: { id: true, status: true, lastMessageAt: true, messageCount: true },
          orderBy: { lastMessageAt: 'desc' },
          take: 10,
        },
        leads: {
          select: { id: true, name: true, status: true, interest: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        appointments: {
          select: { id: true, title: true, scheduledAt: true, status: true },
          orderBy: { scheduledAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async block(contactId: string) {
    await this.findOne(contactId);
    return this.prisma.contact.update({
      where: { id: contactId },
      data: { blockedAt: new Date() },
    });
  }

  async unblock(contactId: string) {
    await this.findOne(contactId);
    return this.prisma.contact.update({
      where: { id: contactId },
      data: { blockedAt: null },
    });
  }
}
