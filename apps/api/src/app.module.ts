import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { AgentsModule } from './modules/agents/agents.module';
import { WhatsappModule } from './modules/integrations/whatsapp/whatsapp.module';
import { StripeModule } from './modules/integrations/stripe/stripe.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { LeadsModule } from './modules/leads/leads.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { BillingModule } from './modules/billing/billing.module';
import { QueueModule } from './modules/queue/queue.module';
import { AiPipelineModule } from './modules/ai-pipeline/ai-pipeline.module';

@Module({
  imports: [
    // Config — loads .env file and validates all required vars at startup.
    // If a required var is missing, the app crashes with a clear message.
    ConfigModule.forRoot({
      isGlobal: true,        // available everywhere without re-importing
      validate: validateEnv, // our typed validation class
    }),

    // Rate limiting — 100 requests/min per IP globally.
    // Override per route with @Throttle() decorator.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => ({
        throttlers: [{ ttl: 60000, limit: 100 }],
      }),
    }),

    // BullMQ — connects to Redis for background job queues.
    // Workers pick up jobs from these queues (AI processing, summary compression).
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL'),
        },
      }),
    }),

    // Core infrastructure — available globally
    PrismaModule,
    CommonModule,

    // Observability — must be first so Railway can probe before features load
    HealthModule,

    // Feature modules — each handles its own routes, services, guards
    AuthModule,
    OrganizationsModule,
    AgentsModule,
    ConversationsModule,
    MessagesModule,
    LeadsModule,
    AppointmentsModule,
    ContactsModule,
    AnalyticsModule,
    BillingModule,
    QueueModule,
    AiPipelineModule,

    // External integrations
    WhatsappModule,
    StripeModule,
  ],
})
export class AppModule {}
