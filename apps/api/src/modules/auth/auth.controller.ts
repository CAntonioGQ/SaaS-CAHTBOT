import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

// @ApiTags groups routes in Swagger docs — like Angular route grouping
// @Public() marks routes that don't need JWT — uses our custom decorator
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register new user + organization' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // @Throttle overrides global rate limit: 5 attempts per minute for login
  // Protects against brute force password attacks
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('local')) // LocalStrategy validates email+password first
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Req() req: Request & { user: JwtPayload }, @Body() _dto: LoginDto) {
    const ipAddress = req.ip;
    return this.authService.login(req.user as any, ipAddress);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  async refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, req.ip);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout — revoke refresh token' })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Body() body: RefreshDto,
  ) {
    await this.authService.logout(user.sub, body.refreshToken);
  }

  // Returns current user + their org membership info
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  async me(@CurrentUser() user: JwtPayload) {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId: user.sub,
        organizationId: user.organizationId,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            emailVerified: true,
            lastLoginAt: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            status: true,
            timezone: true,
          },
        },
      },
    });

    return {
      user: member?.user,
      organization: member?.organization,
      role: member?.role,
      memberId: member?.id,
    };
  }
}
