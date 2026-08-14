import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { HashService } from './hash.service';

@Global()
@Module({
  providers: [HashService, CryptoService],
  exports: [HashService, CryptoService],
})
export class SecurityModule {}
