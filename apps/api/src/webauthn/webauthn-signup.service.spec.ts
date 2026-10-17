import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { vi } from 'vitest';
import type { AuditService } from '../security/audit.service';
import type { CryptoService } from '../security/crypto.service';
import { storeChallenge } from '../session/challenge';
import type { SessionRegistryService } from '../session/session-registry.service';
import type { VerifyRegistrationDto } from './dto/verify-registration.dto';
import type { WebauthnCryptoService } from './webauthn-crypto.service';
import { WebauthnSignupService } from './webauthn-signup.service';

const EMAIL = 'new.member@example.test';
const DTO = { response: {} } as unknown as VerifyRegistrationDto;

function setup() {
  const transaction = vi.fn();
  const db = { transaction } as unknown as NodePgDatabase;
  const config = { getOrThrow: () => 'value' } as unknown as ConfigService;
  // A "decrypted" sign-up token that parses as valid and unexpired.
  const crypto = {
    decrypt: () =>
      JSON.stringify({
        type: 'signup',
        email: EMAIL,
        country: 'FR',
        locale: 'en',
        exp: Date.now() + 60_000,
      }),
  };
  const webauthnCrypto = { verifyRegistrationResponse: vi.fn() };
  const sessionRotation = { rotate: vi.fn() };
  const sessionRegistry = { register: vi.fn() };
  const audit = { record: vi.fn() };
  const service = new WebauthnSignupService(
    db,
    config,
    crypto as unknown as CryptoService,
    webauthnCrypto as unknown as WebauthnCryptoService,
    sessionRotation,
    sessionRegistry as unknown as SessionRegistryService,
    audit as unknown as AuditService,
  );
  const session = { pendingSignupKey: 'signup-key' } as unknown as Request['session'];
  storeChallenge(session, 'pendingSignupChallenge', 'expected-challenge');
  const req = { session, ip: '203.0.113.7' } as unknown as Request;
  return { service, req, transaction, webauthnCrypto, audit };
}

describe('WebauthnSignupService.verify', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs why the library rejected the attestation, still answering the generic 400', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, req, transaction, webauthnCrypto, audit } = setup();
    webauthnCrypto.verifyRegistrationResponse.mockRejectedValue(
      new Error(
        'Unexpected registration response origin "https://evil.test", expected "https://example.test"',
      ),
    );

    await expect(service.verify(req, DTO)).rejects.toMatchObject({
      status: 400,
      response: {
        code: 'signup_link_invalid',
        message: 'Sign-up link is invalid or has expired.',
      },
    });
    expect(warn).toHaveBeenCalledWith(
      'Sign-up attestation rejected: Unexpected registration response origin "https://evil.test", expected "https://example.test"',
    );
    expect(transaction).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('keeps the email, the sign-up key and the challenges out of the log', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, req, webauthnCrypto } = setup();
    webauthnCrypto.verifyRegistrationResponse.mockRejectedValue(
      new Error(
        'Unexpected registration response challenge "received-challenge", expected "expected-challenge"',
      ),
    );

    await expect(service.verify(req, DTO)).rejects.toMatchObject({ status: 400 });

    expect(warn).toHaveBeenCalledTimes(1);
    const [logged] = warn.mock.calls[0] as [string];
    for (const secret of [EMAIL, 'signup-key', 'received-challenge', 'expected-challenge']) {
      expect(logged).not.toContain(secret);
    }
  });

  it('logs a thrown non-Error as text', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, req, webauthnCrypto } = setup();
    webauthnCrypto.verifyRegistrationResponse.mockRejectedValue('cbor decode failed');

    await expect(service.verify(req, DTO)).rejects.toMatchObject({ status: 400 });
    expect(warn).toHaveBeenCalledWith('Sign-up attestation rejected: cbor decode failed');
  });
});
