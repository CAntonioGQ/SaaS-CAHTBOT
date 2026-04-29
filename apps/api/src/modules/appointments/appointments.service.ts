import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/context/tenant.context';
import { TenantBaseService } from '../../common/services/tenant-base.service';
import { AppointmentStatus } from '@prisma/client';

@Injectable()
export class AppointmentsService extends TenantBaseService {
  constructor(prisma: PrismaService, tenantContext: TenantContext) {
    super(prisma, tenantContext);
  }

  async findAll(status?: AppointmentStatus, limit = 50) {
    return this.prisma.appointment.findMany({
      where: {
        organizationId: this.orgId,
        ...(status && { status }),
      },
      include: {
        contact: { select: { id: true, name: true, whatsappPhone: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });
  }

  async findOne(id: string) {
    const appt = await this.prisma.appointment.findFirst({
      where: { id, organizationId: this.orgId },
      include: {
        contact: true,
        conversation: { select: { id: true, status: true } },
      },
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    return appt;
  }

  async updateStatus(id: string, status: AppointmentStatus) {
    await this.findOne(id);
    return this.prisma.appointment.update({
      where: { id },
      data: {
        status,
        ...(status === 'CONFIRMED' && { confirmedAt: new Date() }),
        ...(status === 'CANCELLED' && { cancelledAt: new Date() }),
      },
    });
  }
}
