import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

const BCRYPT_ROUNDS = 12;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

interface AuthUser {
  userId: string;
  email: string;
  organizationId: string;
  memberId: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Called by LocalStrategy — validates email + password, returns auth user info
  async validateCredentials(
    email: string,
    password: string,
  ): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        memberships: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: {
            id: true,
            organizationId: true,
            role: true,
          },
        },
      },
    });

    if (!user) return null;

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) return null;

    const membership = user.memberships[0];
    if (!membership) return null;

    return {
      userId: user.id,
      email: user.email,
      organizationId: membership.organizationId,
      memberId: membership.id,
      role: membership.role,
    };
  }

  // Register: creates User + Organization + OWNER membership + Free subscription
  async register(dto: RegisterDto): Promise<TokenPair> {
    const emailLower = dto.email.toLowerCase();

    // Check duplicates
    const existingUser = await this.prisma.user.findUnique({
      where: { email: emailLower },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug: dto.organizationSlug },
    });
    if (existingOrg) {
      throw new ConflictException('Organization slug already taken');
    }

    // Find free plan
    const freePlan = await this.prisma.plan.findUnique({
      where: { name: 'Free' },
    });
    if (!freePlan) {
      throw new Error('Free plan not found — run db:seed first');
    }

    // Create everything in a transaction — all or nothing
    const result = await this.prisma.$transaction(async (tx) => {
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

      const user = await tx.user.create({
        data: {
          email: emailLower,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName,
          slug: dto.organizationSlug,
        },
      });

      const member = await tx.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'OWNER',
        },
      });

      // Create 14-day trial subscription on Free plan
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);

      await tx.subscription.create({
        data: {
          organizationId: organization.id,
          planId: freePlan.id,
          status: 'TRIALING',
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEnd,
          trialEndsAt: trialEnd,
          priceUsdAtPurchase: freePlan.priceMonthly,
          maxMessagesAtPurchase: freePlan.maxMessagesPerMonth,
          maxConversationsAtPurchase: freePlan.maxConversationsPerMonth,
        },
      });

      return { user, organization, member };
    });

    this.logger.log(`New registration: ${emailLower} / org: ${dto.organizationSlug}`);

    return this.generateTokens({
      userId: result.user.id,
      email: result.user.email,
      organizationId: result.organization.id,
      memberId: result.member.id,
      role: 'OWNER',
    });
  }

  // Login: generate token pair after successful credential validation
  async login(authUser: AuthUser, ipAddress?: string): Promise<TokenPair> {
    await this.prisma.user.update({
      where: { id: authUser.userId },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(authUser);

    // Store hashed refresh token for rotation/revocation
    const tokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.refreshToken.create({
      data: {
        userId: authUser.userId,
        token: tokenHash,
        expiresAt: this.getRefreshTokenExpiry(),
        ipAddress,
      },
    });

    return tokens;
  }

  // Refresh: rotate access + refresh token pair
  async refresh(refreshToken: string, ipAddress?: string): Promise<TokenPair> {
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('AUTH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Find a matching non-revoked refresh token for this user
    const storedTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    // Verify one of the stored hashes matches
    let matchedToken = null;
    for (const stored of storedTokens) {
      const match = await bcrypt.compare(refreshToken, stored.token);
      if (match) {
        matchedToken = stored;
        break;
      }
    }

    if (!matchedToken) {
      throw new UnauthorizedException('Refresh token not found or revoked');
    }

    // Revoke the used refresh token (rotation security)
    await this.prisma.refreshToken.update({
      where: { id: matchedToken.id },
      data: { revokedAt: new Date() },
    });

    // Get current membership info (role may have changed)
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId: payload.sub,
        organizationId: payload.organizationId,
        isActive: true,
      },
      select: { id: true, role: true },
    });

    if (!member) {
      throw new UnauthorizedException('Membership no longer active');
    }

    const authUser: AuthUser = {
      userId: payload.sub,
      email: payload.email,
      organizationId: payload.organizationId,
      memberId: member.id,
      role: member.role,
    };

    return this.login(authUser, ipAddress);
  }

  // Logout: revoke the specific refresh token
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const storedTokens = await this.prisma.refreshToken.findMany({
        where: { userId, revokedAt: null },
      });

      for (const stored of storedTokens) {
        const match = await bcrypt.compare(refreshToken, stored.token);
        if (match) {
          await this.prisma.refreshToken.update({
            where: { id: stored.id },
            data: { revokedAt: new Date() },
          });
          break;
        }
      }
    } else {
      // Revoke all refresh tokens for this user
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  private async generateTokens(authUser: AuthUser): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: authUser.userId,
      email: authUser.email,
      organizationId: authUser.organizationId,
      memberId: authUser.memberId,
      role: authUser.role,
    };

    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN', '7d');
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '30d');
    const secret = this.config.get<string>('AUTH_SECRET')!;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { secret, expiresIn }),
      this.jwtService.signAsync(
        { ...payload, type: 'refresh' },
        { secret, expiresIn: refreshExpiresIn },
      ),
    ]);

    return { accessToken, refreshToken, expiresIn };
  }

  private getRefreshTokenExpiry(): Date {
    const days = 30;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }
}
