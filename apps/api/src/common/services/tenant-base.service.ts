import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../context/tenant.context';

// Base class for all feature services.
// Extends this to get this.orgId and this.prisma automatically.
// If a service method queries the DB without organizationId, TypeScript won't stop it —
// but extending this and using this.orgId makes cross-tenant leaks obvious in code review.
export abstract class TenantBaseService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly tenantContext: TenantContext,
  ) {}

  protected get orgId(): string {
    try {
      return this.tenantContext.organizationId;
    } catch {
      throw new UnauthorizedException('No tenant context — request not authenticated');
    }
  }

  protected get currentUserId(): string {
    return this.tenantContext.userId;
  }

  protected get currentMemberId(): string {
    return this.tenantContext.memberId;
  }

  protected get currentRole(): string {
    return this.tenantContext.role;
  }
}
