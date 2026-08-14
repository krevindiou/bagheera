import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { CryptoService } from './crypto.service';

function key(): string {
  return randomBytes(32).toString('base64');
}

describe('CryptoService', () => {
  it('round-trips a plaintext through encrypt/decrypt', () => {
    const service = new CryptoService({} as ConfigService);
    service.loadKeys(JSON.stringify({ 1: key() }), '1');

    const ciphertext = service.encrypt('super-secret-token');
    expect(service.decrypt(ciphertext)).toBe('super-secret-token');
  });

  it('rejects tampered ciphertext', () => {
    const service = new CryptoService({} as ConfigService);
    service.loadKeys(JSON.stringify({ 1: key() }), '1');

    const ciphertext = service.encrypt('super-secret-token');
    const [keyId, iv, authTag, body] = ciphertext.split(':');
    const tamperedBody = Buffer.from(body, 'base64');
    tamperedBody[0] ^= 0xff;
    const tampered = [keyId, iv, authTag, tamperedBody.toString('base64')].join(
      ':',
    );

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('rejects a malformed token', () => {
    const service = new CryptoService({} as ConfigService);
    service.loadKeys(JSON.stringify({ 1: key() }), '1');

    expect(() => service.decrypt('not-a-valid-token')).toThrow();
  });

  it('keeps decrypting under an old key after rotation while it is still present', () => {
    const oldKey = key();
    const newKey = key();

    const before = new CryptoService({} as ConfigService);
    before.loadKeys(JSON.stringify({ 1: oldKey }), '1');
    const ciphertext = before.encrypt('rotate-me');

    const after = new CryptoService({} as ConfigService);
    after.loadKeys(JSON.stringify({ 1: oldKey, 2: newKey }), '2');

    expect(after.decrypt(ciphertext)).toBe('rotate-me');
    // New encryptions use the active key.
    expect(after.encrypt('new-secret').startsWith('2:')).toBe(true);
  });

  it('rejects ciphertext under a key that has been retired (removed)', () => {
    const oldKey = key();
    const newKey = key();

    const before = new CryptoService({} as ConfigService);
    before.loadKeys(JSON.stringify({ 1: oldKey }), '1');
    const ciphertext = before.encrypt('will-be-orphaned');

    const after = new CryptoService({} as ConfigService);
    after.loadKeys(JSON.stringify({ 2: newKey }), '2');

    expect(() => after.decrypt(ciphertext)).toThrow();
  });
});
