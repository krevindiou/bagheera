import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { HashService } from './hash.service';
import {
  RATE_LIMIT_VALKEY_CLIENT,
  rateLimitValkeyClientProvider,
} from './rate-limit-valkey-client.provider';
import { RateLimitGuard } from './rate-limit.guard';

@Global()
@Module({
  providers: [
    HashService,
    CryptoService,
    rateLimitValkeyClientProvider,
    RateLimitGuard,
  ],
  exports: [
    HashService,
    CryptoService,
    RateLimitGuard,
    RATE_LIMIT_VALKEY_CLIENT,
  ],
})
export class SecurityModule {}
