import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { BullModule } from '@nestjs/bullmq';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicators/prisma.health.indicator';
import { RedisHealthIndicator } from './indicators/redis.health.indicator';

@Module({
  imports: [
    TerminusModule,
    // Inject the queue so RedisHealthIndicator can use its connection
    BullModule.registerQueue({ name: 'message-processing' }),
  ],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
