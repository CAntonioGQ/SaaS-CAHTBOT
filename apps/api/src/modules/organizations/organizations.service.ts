import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/context/tenant.context';
import { TenantBaseService } from '../../common/services/tenant-base.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService extends TenantBaseService {
  constructor(prisma: PrismaService, tenantContext: TenantContext) {
    super(prisma, tenantContext);
  }

  async getCurrent() {
    const org = await this.prisma.organization.findUnique({
      where: { id: this.orgId },
      include: {
        subscription: {
          include: { plan: true },
        },
        _count: {
          select: {
            agents: true,
            contacts: true,
            conversations: { where: { status: { not: 'CLOSED' } } },
          },
        },
      },
    });

    if (!org) throw new NotFoundException('Organization not found');

    // Never expose encrypted WhatsApp tokens in responses
    const { whatsappAccessToken, whatsappAppSecret, ...safe } = org;
    return {
      ...safe,
      whatsappConfigured: !!whatsappAccessToken,
    };
  }

  async update(dto: UpdateOrganizationDto) {
    if (dto.slug) {
      const existing = await this.prisma.organization.findFirst({
        where: { slug: dto.slug, id: { not: this.orgId } },
      });
      if (existing) throw new ConflictException('Slug already taken');
    }

    return this.prisma.organization.update({
      where: { id: this.orgId },
      data: dto,
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        status: true,
        timezone: true,
        updatedAt: true,
      },
    });
  }

  async getMembers() {
    return this.prisma.organizationMember.findMany({
      where: { organizationId: this.orgId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async removeMember(memberId: string) {
    // Prevent removing self or the org owner
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: this.orgId },
    });

    if (!member) throw new NotFoundException('Member not found');
    if (member.role === 'OWNER') {
      throw new ConflictException('Cannot remove organization owner');
    }
    if (member.id === this.currentMemberId) {
      throw new ConflictException('Cannot remove yourself');
    }

    return this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { isActive: false },
    });
  }
}
