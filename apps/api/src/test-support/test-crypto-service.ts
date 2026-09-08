import { randomBytes } from 'crypto';
import { CryptoService } from '../security/crypto.service';

/**
 * Fixed-for-the-process base64 32-byte test keys, generated once at module
 * load rather than hardcoded — avoids a secret-shaped literal sitting in
 * the repo while staying stable within a single test run (every spec that
 * imports this module shares the same two keys, so key-rotation tests can
 * encrypt under one and decrypt under the other).
 */
export const TEST_CRYPTO_KEYS: Record<'1' | '2', string> = {
  '1': randomBytes(32).toString('base64'),
  '2': randomBytes(32).toString('base64'),
};

/**
 * A real `CryptoService` with keys already loaded, bypassing the
 * `ConfigService`/`onModuleInit` path entirely — exactly the use `loadKeys`
 * documents itself for ("Exposed for tests that need to configure keys
 * without a full Nest bootstrap"). `activeKeyId` defaults to `'1'`; pass
 * `'2'` to get an instance that encrypts under the other key, for
 * key-rotation tests.
 */
export function testCryptoService(activeKeyId: '1' | '2' = '1'): CryptoService {
  const service = new CryptoService({} as never);
  service.loadKeys(JSON.stringify(TEST_CRYPTO_KEYS), activeKeyId);
  return service;
}
