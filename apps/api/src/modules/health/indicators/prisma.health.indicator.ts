import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { PrismaService } from '../../../prisma/prisma.service';

// Custom health indicator for Prisma/Postgres.
// @nestjs/terminus includes indicators for TypeORM, Mongoose, Redis — but not Prisma.
// We extend HealthIndicator (the base class) and run a raw SELECT 1 query.
@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'Prisma check failed',
        this.getStatus(key, false, { error: (error as Error).message }),
      );
    }
  }
}
