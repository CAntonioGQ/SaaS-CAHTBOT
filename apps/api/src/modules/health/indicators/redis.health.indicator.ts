import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

// Custom health indicator for Redis — checks via BullMQ's queue connection.
// We already have Redis connected for BullMQ, so we reuse that connection
// instead of creating a separate ioredis client just for health checks.
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(
    @InjectQueue('message-processing') private readonly queue: Queue,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // ping() sends PING to Redis and expects PONG — the simplest liveness check
      await this.queue.client.then((client) => client.ping());
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, { error: (error as Error).message }),
      );
    }
  }
}
