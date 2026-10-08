import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type IORedis from 'ioredis';
import { closeValkeyClient } from '../common/valkey-client';
import { DbModule } from '../db/db.module';
import { AuditService } from './audit.service';
import { CryptoService } from './crypto.service';
import { OwnershipService } from './ownership.service';
import {
  RATE_LIMIT_VALKEY_CLIENT,
  rateLimitValkeyClientProvider,
} from './rate-limit-valkey-client.provider';
import { RateLimitGuard } from './rate-limit.guard';

@Global()
@Module({
  imports: [DbModule],
  providers: [
    CryptoService,
    rateLimitValkeyClientProvider,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    AuditService,
    OwnershipService,
  ],
  exports: [CryptoService, RATE_LIMIT_VALKEY_CLIENT, AuditService, OwnershipService],
})
export class SecurityModule implements OnModuleDestroy {
  constructor(
    @Inject(RATE_LIMIT_VALKEY_CLIENT)
    private readonly rateLimitValkeyClient: IORedis,
  ) {}

  // Otherwise each integration spec's app leaks a client that keeps
  // retrying after Testcontainers stops Valkey.
  async onModuleDestroy(): Promise<void> {
    await closeValkeyClient(this.rateLimitValkeyClient);
  }
}
