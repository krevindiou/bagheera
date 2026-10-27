import { createHash } from 'crypto';
import { CryptoService } from './crypto.service';
import { TEST_CRYPTO_KEYS, testCryptoService } from '../test-support/test-crypto-service';

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

  it('round-trips bytes that are not valid text', () => {
    const crypto = testCryptoService();
    const bytes = Buffer.from([0x00, 0xff, 0xc9, 0x80, 0x41, 0xe9]);
    const sealed = crypto.encryptBytes(bytes);
    expect(crypto.decryptBytes(sealed).equals(bytes)).toBe(true);
  });

  it('reads text sealed as bytes, and bytes sealed as text', () => {
    const crypto = testCryptoService();
    expect(crypto.decrypt(crypto.encryptBytes(Buffer.from('café', 'utf8')))).toBe('café');
    expect(crypto.decryptBytes(crypto.encrypt('café')).toString('utf8')).toBe('café');
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

  describe('digests', () => {
    it('throws before any keys are loaded', () => {
      expect(() => new CryptoService({} as never).digests('p', 'v')).toThrow(
        'Crypto keys not loaded',
      );
    });

    it('gives one 64-character hex digest per key, the active key first', () => {
      const [first, second, ...rest] = testCryptoService('2').digests('p', 'v');
      expect(rest).toHaveLength(0);
      expect(first).toMatch(/^[0-9a-f]{64}$/);
      expect(second).toMatch(/^[0-9a-f]{64}$/);
      expect(first).not.toBe(second);
      // The same value under the other active key finds the same two digests.
      expect(testCryptoService('1').digests('p', 'v')).toEqual([second, first]);
    });

    it('is stable, and differs by value and by purpose', () => {
      const crypto = testCryptoService();
      expect(crypto.digests('p', 'v')).toEqual(crypto.digests('p', 'v'));
      expect(crypto.digests('p', 'v')[0]).not.toBe(crypto.digests('p', 'w')[0]);
      expect(crypto.digests('p', 'v')[0]).not.toBe(crypto.digests('q', 'v')[0]);
    });

    it('does not contain the value, nor a plain hash of it', () => {
      const [digest] = testCryptoService().digests('p', 'FR7630006000011234567890189');
      expect(digest).not.toContain('1234567890189');
      expect(digest).not.toBe(
        createHash('sha256').update('FR7630006000011234567890189').digest('hex'),
      );
    });
  });

  it('throws for ciphertext with the wrong number of parts', () => {
    const crypto = testCryptoService();
    expect(() => crypto.decrypt('only:three:parts')).toThrow('Malformed ciphertext');
  });

  it('throws for an unknown or retired key id', () => {
    const crypto = testCryptoService();
    expect(() => crypto.decrypt('unknown-id:AAAA:AAAA:AAAA')).toThrow(/Unknown or retired key id/);
  });

  it('throws when the auth tag has been tampered with', () => {
    const crypto = testCryptoService();
    const ciphertext = crypto.encrypt('tamper me');
    const [keyId, iv, authTag, body] = ciphertext.split(':');
    // Flip the first character (never the base64 padding tail) so the
    // decoded bytes genuinely change — a real GCM tag mismatch at
    // decipher.final(), not just a malformed-length error at setAuthTag().
    const tamperedAuthTag = (authTag[0] === 'A' ? 'B' : 'A') + authTag.slice(1);
    expect(() => crypto.decrypt(`${keyId}:${iv}:${tamperedAuthTag}:${body}`)).toThrow();
  });

  it('throws when the auth tag has been truncated', () => {
    const crypto = testCryptoService();
    const ciphertext = crypto.encrypt('truncate me');
    const [keyId, iv, authTag, body] = ciphertext.split(':');
    // A prefix of the genuine tag, which GCM would otherwise accept.
    const truncatedAuthTag = Buffer.from(authTag, 'base64').subarray(0, 4).toString('base64');
    expect(() => crypto.decrypt(`${keyId}:${iv}:${truncatedAuthTag}:${body}`)).toThrow(
      'Malformed ciphertext',
    );
  });

  it('loadKeys rejects a key that does not decode to 32 bytes', () => {
    const crypto = new CryptoService({} as never);
    const shortKey = Buffer.from('too-short').toString('base64');
    expect(() => crypto.loadKeys(JSON.stringify({ '1': shortKey }), '1')).toThrow(
      /key "1" must decode to 32 bytes/,
    );
  });

  it('loadKeys rejects an active key id absent from the keys map', () => {
    const crypto = new CryptoService({} as never);
    expect(() => crypto.loadKeys(JSON.stringify(TEST_CRYPTO_KEYS), '9')).toThrow(
      /not present in CRYPTO_KEYS/,
    );
  });
});
