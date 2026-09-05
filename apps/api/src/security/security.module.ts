import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { RedisClientType } from 'redis';
import { DbModule } from '../db/db.module';
import { AuditService } from './audit.service';
import { CryptoService } from './crypto.service';
import { HashService } from './hash.service';
import { OwnershipService } from './ownership.service';
import {
  RATE_LIMIT_VALKEY_CLIENT,
  rateLimitValkeyClientProvider,
} from './rate-limit-valkey-client.provider';
import { RateLimitGuard } from './rate-limit.guard';

// AuditService needs DRIZZLE — importing DbModule here (also @Global())
// means every existing consumer of SecurityModule keeps working without
// having to add DbModule itself.
@Global()
@Module({
  imports: [DbModule],
  providers: [
    HashService,
    CryptoService,
    rateLimitValkeyClientProvider,
    // Global, the same way SessionModule wires SessionAuthGuard — nothing
    // resolves RateLimitGuard as its own injectable token (a route opts out
    // with @SkipRateLimit or overrides with @RateLimit instead), so unlike
    // AuditService/HashService/CryptoService it isn't also listed as a
    // plain provider or exported.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    AuditService,
    OwnershipService,
  ],
  exports: [
    HashService,
    CryptoService,
    RATE_LIMIT_VALKEY_CLIENT,
    AuditService,
    OwnershipService,
  ],
})
export class SecurityModule implements OnModuleDestroy {
  constructor(
    @Inject(RATE_LIMIT_VALKEY_CLIENT)
    private readonly rateLimitValkeyClient: RedisClientType,
  ) {}

  // Mirrors SessionModule's own onModuleDestroy for its Valkey client — this
  // module's rate-limit client had no such hook, so every Nest testing
  // module compiled per integration-spec file (~30 of them) leaked its own
  // open connection. Harmless in the running app (one process, one
  // shutdown), but in the test suite each leaked client kept retrying after
  // globalTeardown stopped the shared Testcontainers Valkey instance out
  // from under it, spamming ECONNREFUSED/SocketClosedUnexpectedlyError once
  // the whole run had already finished and reported its result.
  async onModuleDestroy(): Promise<void> {
    if (this.rateLimitValkeyClient.isOpen) {
      await this.rateLimitValkeyClient.quit();
    }
  }
}
