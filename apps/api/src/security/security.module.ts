import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DbModule } from '../db/db.module';
import { AuditService } from './audit.service';
import { CryptoService } from './crypto.service';
import { HashService } from './hash.service';
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
  ],
  exports: [HashService, CryptoService, RATE_LIMIT_VALKEY_CLIENT, AuditService],
})
export class SecurityModule {}
