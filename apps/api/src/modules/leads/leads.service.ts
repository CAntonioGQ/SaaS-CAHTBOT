import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/context/tenant.context';
import { TenantBaseService } from '../../common/services/tenant-base.service';
import { LeadStatus } from '@prisma/client';
import { IsOptional, IsString, IsEnum, IsNumber, Min, Max } from 'class-validator';

export class UpdateLeadDto {
  @IsEnum(LeadStatus) @IsOptional() status?: LeadStatus;
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() assignedToId?: string;
  @IsNumber() @Min(0) @Max(100) @IsOptional() score?: number;
}

@Injectable()
export class LeadsService extends TenantBaseService {
  constructor(prisma: PrismaService, tenantContext: TenantContext) {
    super(prisma, tenantContext);
  }

  async findAll(status?: LeadStatus, limit = 50, cursor?: string) {
    return this.prisma.lead.findMany({
      where: {
        organizationId: this.orgId,
        ...(status && { status }),
      },
      include: {
        contact: { select: { id: true, name: true, whatsappPhone: true } },
        conversation: { select: { id: true, status: true } },
        assignedTo: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });
  }

  async findOne(leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: this.orgId },
      include: {
        contact: true,
        conversation: true,
        assignedTo: {
          select: { id: true, user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async update(leadId: string, dto: UpdateLeadDto) {
    await this.findOne(leadId);
    return this.prisma.lead.update({
      where: { id: leadId },
      data: {
        ...dto,
        ...(dto.status === 'CONVERTED' && { convertedAt: new Date() }),
      },
    });
  }
}
