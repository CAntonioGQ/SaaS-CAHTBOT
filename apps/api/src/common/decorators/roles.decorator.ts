import { SetMetadata } from '@nestjs/common';
import { MemberRole } from '@prisma/client';

// Attach required roles to a route.
// Usage: @Roles('OWNER', 'ADMIN') before a controller method.
// The RolesGuard reads this metadata and checks current user's role.
export const ROLES_KEY = 'roles';
export const Roles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);
