import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaHealthIndicator } from './indicators/prisma.health.indicator';
import { RedisHealthIndicator } from './indicators/redis.health.indicator';

// All health endpoints are @Public() — Railway/load balancer hits them without auth.
// Terminus returns HTTP 200 when healthy, HTTP 503 when any check fails.
// Railway uses this to decide whether to route traffic to this instance.
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
  ) {}

  // Liveness check — is the process alive?
  // Railway and Docker use this first. Cheap, no external deps.
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness check' })
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  // Readiness check — can the app serve requests?
  // Checks Postgres + Redis. If either fails, Railway stops routing traffic here.
  @Public()
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness check (DB + Redis)' })
  readiness() {
    return this.health.check([
      () => this.prismaIndicator.isHealthy('database'),
      () => this.redisIndicator.isHealthy('redis'),
    ]);
  }

  // Individual DB check
  @Public()
  @Get('db')
  @HealthCheck()
  @ApiOperation({ summary: 'Database health check' })
  checkDb() {
    return this.health.check([
      () => this.prismaIndicator.isHealthy('database'),
    ]);
  }

  // Individual Redis check
  @Public()
  @Get('redis')
  @HealthCheck()
  @ApiOperation({ summary: 'Redis health check' })
  checkRedis() {
    return this.health.check([
      () => this.redisIndicator.isHealthy('redis'),
    ]);
  }
}
