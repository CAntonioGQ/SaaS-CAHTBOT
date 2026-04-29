import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Custom param decorator — extracts the user object from the request.
// After JWT validation, Passport attaches the decoded token payload to req.user.
// Usage in controller: findAll(@CurrentUser() user: JwtPayload)
// Same concept as Angular's @Input() but for HTTP request data.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

export interface JwtPayload {
  sub: string;           // userId
  email: string;
  organizationId: string;
  memberId: string;
  role: string;
}
