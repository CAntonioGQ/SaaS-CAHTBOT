import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// PrismaService extends PrismaClient directly.
// This means you can call this.prisma.user.findMany(),
// this.prisma.agent.create(), etc. — full typed access to the DB.
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'warn', 'error']
          : ['warn', 'error'],
    });
  }

  // Called automatically when NestJS starts the module — like ngOnInit
  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  // Called when NestJS shuts down — closes DB connections cleanly
  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
