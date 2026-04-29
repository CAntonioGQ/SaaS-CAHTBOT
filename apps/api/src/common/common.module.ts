import { Global, Module } from '@nestjs/common';
import { TenantContext } from './context/tenant.context';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { SubscriptionGuard } from './guards/subscription.guard';

// @Global() — providers here are available everywhere without importing CommonModule.
// TenantContext especially needs to be global because every service uses it.
@Global()
@Module({
  providers: [TenantContext, JwtAuthGuard, RolesGuard, SubscriptionGuard],
  exports: [TenantContext, JwtAuthGuard, RolesGuard, SubscriptionGuard],
})
export class CommonModule {}
