import { CryptoService } from './crypto.service';
import {
  TEST_CRYPTO_KEYS,
  testCryptoService,
} from '../test-support/test-crypto-service';

describe('CryptoService', () => {
  it('throws when encrypt() is called before any keys are loaded', () => {
    const crypto = new CryptoService({} as never);
    expect(() => crypto.encrypt('too soon')).toThrow('Crypto keys not loaded');
  });

  it('round-trips a plaintext through encrypt/decrypt', () => {
    const crypto = testCryptoService();
    const ciphertext = crypto.encrypt('hello world');
    expect(crypto.decrypt(ciphertext)).toBe('hello world');
  });

  it('prefixes the ciphertext with the active key id, as keyId:iv:authTag:ciphertext', () => {
    const crypto = testCryptoService('2');
    const ciphertext = crypto.encrypt('payload');
    const parts = ciphertext.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('2');
  });

  it('still decrypts under a retired key that is still present in CRYPTO_KEYS', () => {
    const encryptor = testCryptoService('1');
    const ciphertext = encryptor.encrypt('rotated secret');
    // A second instance, now active on key '2', still has key '1' loaded.
    const afterRotation = testCryptoService('2');
    expect(afterRotation.decrypt(ciphertext)).toBe('rotated secret');
  });

  it('throws for ciphertext with the wrong number of parts', () => {
    const crypto = testCryptoService();
    expect(() => crypto.decrypt('only:three:parts')).toThrow(
      'Malformed ciphertext',
    );
  });

  it('throws for an unknown or retired key id', () => {
    const crypto = testCryptoService();
    expect(() => crypto.decrypt('unknown-id:AAAA:AAAA:AAAA')).toThrow(
      /Unknown or retired key id/,
    );
  });

  it('throws when the auth tag has been tampered with', () => {
    const crypto = testCryptoService();
    const ciphertext = crypto.encrypt('tamper me');
    const [keyId, iv, authTag, body] = ciphertext.split(':');
    // Flip the first character (never the base64 padding tail) so the
    // decoded bytes genuinely change — a real GCM tag mismatch at
    // decipher.final(), not just a malformed-length error at setAuthTag().
    const tamperedAuthTag = (authTag[0] === 'A' ? 'B' : 'A') + authTag.slice(1);
    expect(() =>
      crypto.decrypt(`${keyId}:${iv}:${tamperedAuthTag}:${body}`),
    ).toThrow();
  });

  it('loadKeys rejects a key that does not decode to 32 bytes', () => {
    const crypto = new CryptoService({} as never);
    const shortKey = Buffer.from('too-short').toString('base64');
    expect(() =>
      crypto.loadKeys(JSON.stringify({ '1': shortKey }), '1'),
    ).toThrow(/key "1" must decode to 32 bytes/);
  });

  it('loadKeys rejects an active key id absent from the keys map', () => {
    const crypto = new CryptoService({} as never);
    expect(() =>
      crypto.loadKeys(JSON.stringify(TEST_CRYPTO_KEYS), '9'),
    ).toThrow(/not present in CRYPTO_KEYS/);
  });
});

describe('CryptoService.safeEqual', () => {
  it('returns true for identical strings', () => {
    expect(CryptoService.safeEqual('secret', 'secret')).toBe(true);
  });

  it('returns false for different strings of the same length', () => {
    expect(CryptoService.safeEqual('secret', 'secreT')).toBe(false);
  });

  it('returns false for strings of different lengths, without calling into timingSafeEqual', () => {
    expect(CryptoService.safeEqual('short', 'a-lot-longer')).toBe(false);
  });
});
