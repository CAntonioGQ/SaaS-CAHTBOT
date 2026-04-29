import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';

interface TenantStore {
  organizationId: string;
  userId: string;
  memberId: string;
  role: string;
}

// AsyncLocalStorage gives each HTTP request its own isolated "storage".
// Think of it as thread-local storage from Python/Java, but for async Node.js.
// Every service can call tenantContext.organizationId without receiving it as a param.
@Injectable()
export class TenantContext {
  private readonly storage = new AsyncLocalStorage<TenantStore>();

  run(store: TenantStore, callback: () => void) {
    this.storage.run(store, callback);
  }

  get organizationId(): string {
    const store = this.storage.getStore();
    if (!store) throw new Error('TenantContext not initialized — is JwtAuthGuard applied?');
    return store.organizationId;
  }

  get userId(): string {
    return this.storage.getStore()!.userId;
  }

  get memberId(): string {
    return this.storage.getStore()!.memberId;
  }

  get role(): string {
    return this.storage.getStore()!.role;
  }
}
