import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TenantContext } from '../context/tenant.context';
import { JwtPayload } from '../decorators/current-user.decorator';

// Applied globally in AuthModule — runs on EVERY route.
// 1. Checks if route is @Public() — if so, skips auth
// 2. Otherwise validates JWT Bearer token from Authorization header
// 3. Populates req.user with decoded payload (JwtPayload)
// 4. Sets TenantContext so all downstream services know the current org
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContext,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if the route is marked @Public() — if yes, skip JWT check
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }

  // Called after Passport validates the JWT and returns the payload.
  // This is where we set TenantContext for downstream services.
  handleRequest<T = JwtPayload>(err: Error, user: T): T {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Invalid or expired token');
    }

    const payload = user as unknown as JwtPayload;
    // Store org/user info in AsyncLocalStorage so services can access it
    // without needing it passed as a parameter
    this.tenantContext.run(
      {
        organizationId: payload.organizationId,
        userId: payload.sub,
        memberId: payload.memberId,
        role: payload.role,
      },
      () => {},
    );

    return user;
  }
}
