import { Global, Module } from '@nestjs/common';
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
    RateLimitGuard,
    AuditService,
  ],
  exports: [
    HashService,
    CryptoService,
    RateLimitGuard,
    RATE_LIMIT_VALKEY_CLIENT,
    AuditService,
  ],
})
export class SecurityModule {}
