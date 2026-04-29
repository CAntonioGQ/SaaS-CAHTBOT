import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload } from '../../../common/decorators/current-user.decorator';

// JWT Strategy: runs on every authenticated request.
// Extracts Bearer token from Authorization header, verifies signature,
// then returns the decoded payload which becomes req.user.
// Passport calls validate() after verifying the token signature.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('AUTH_SECRET')!,
    });
  }

  // Called after token signature is verified.
  // Return value becomes req.user — available via @CurrentUser() decorator.
  async validate(payload: JwtPayload) {
    // Verify the member still exists and is active (could have been deactivated)
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        id: payload.memberId,
        userId: payload.sub,
        organizationId: payload.organizationId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!member) {
      throw new UnauthorizedException('User account is inactive or not found');
    }

    return payload;
  }
}
