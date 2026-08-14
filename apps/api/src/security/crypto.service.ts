import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

/**
 * AES-256-GCM token/secret encryption with key-id-prefixed rotation.
 *
 * Keys are configured via `CRYPTO_KEYS`, a JSON object mapping key id ->
 * base64-encoded 32-byte key (e.g. `{"1":"<base64>","2":"<base64>"}`).
 * `CRYPTO_ACTIVE_KEY_ID` selects which key new ciphertexts are encrypted
 * with. Ciphertext is stored as `<keyId>:<iv>:<authTag>:<ciphertext>`
 * (each part base64), so old ciphertexts keep decrypting under a
 * still-present retired key, and fail once that key id is removed from
 * `CRYPTO_KEYS`.
 */
@Injectable()
export class CryptoService implements OnModuleInit {
  private keys = new Map<string, Buffer>();
  private activeKeyId!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const raw = this.config.getOrThrow<string>('CRYPTO_KEYS');
    const activeKeyId = this.config.getOrThrow<string>('CRYPTO_ACTIVE_KEY_ID');
    this.loadKeys(raw, activeKeyId);
  }

  /** Exposed for tests that need to configure keys without a full Nest bootstrap. */
  loadKeys(raw: string, activeKeyId: string): void {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const keys = new Map<string, Buffer>();
    for (const [id, base64Key] of Object.entries(parsed)) {
      const key = Buffer.from(base64Key, 'base64');
      if (key.length !== KEY_LENGTH) {
        throw new Error(
          `CRYPTO_KEYS: key "${id}" must decode to ${KEY_LENGTH} bytes`,
        );
      }
      keys.set(id, key);
    }
    if (!keys.has(activeKeyId)) {
      throw new Error(
        `CRYPTO_ACTIVE_KEY_ID "${activeKeyId}" not present in CRYPTO_KEYS`,
      );
    }
    this.keys = keys;
    this.activeKeyId = activeKeyId;
  }

  encrypt(plain: string): string {
    const key = this.keys.get(this.activeKeyId);
    if (!key) {
      throw new Error('Crypto keys not loaded');
    }
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return [
      this.activeKeyId,
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  decrypt(token: string): string {
    const parts = token.split(':');
    if (parts.length !== 4) {
      throw new Error('Malformed ciphertext');
    }
    const [keyId, ivB64, authTagB64, ciphertextB64] = parts;
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Unknown or retired key id "${keyId}"`);
    }
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }

  /** Constant-time comparison for callers that need to compare secrets directly. */
  static safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }
}
