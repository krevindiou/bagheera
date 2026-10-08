import { randomBytes } from 'crypto';
import { CryptoService } from '../security/crypto.service';

/**
 * Generated at load rather than hardcoded (no secret-shaped literal in the
 * repo), and shared by every importer so rotation tests can cross keys.
 */
export const TEST_CRYPTO_KEYS: Record<'1' | '2', string> = {
  '1': randomBytes(32).toString('base64'),
  '2': randomBytes(32).toString('base64'),
};

/** A real `CryptoService` with the test keys loaded, encrypting under `activeKeyId`. */
export function testCryptoService(activeKeyId: '1' | '2' = '1'): CryptoService {
  const service = new CryptoService({} as never);
  service.loadKeys(JSON.stringify(TEST_CRYPTO_KEYS), activeKeyId);
  return service;
}
