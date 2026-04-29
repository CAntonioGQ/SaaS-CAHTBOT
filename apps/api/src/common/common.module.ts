import { Global, Module } from '@nestjs/common';
import { TenantContext } from './context/tenant.context';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { SubscriptionGuard } from './guards/subscription.guard';
import { EncryptionService } from './services/encryption.service';

// @Global() — providers here are available everywhere without importing CommonModule.
// TenantContext and EncryptionService especially need to be global.
@Global()
@Module({
  providers: [TenantContext, JwtAuthGuard, RolesGuard, SubscriptionGuard, EncryptionService],
  exports: [TenantContext, JwtAuthGuard, RolesGuard, SubscriptionGuard, EncryptionService],
})
export class CommonModule {}
