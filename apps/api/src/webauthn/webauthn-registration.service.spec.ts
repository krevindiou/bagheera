import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VerifiedRegistrationResponse } from '@simplewebauthn/server';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { vi } from 'vitest';
import type { EmailQueueService } from '../email/email-queue.service';
import type { AuditService } from '../security/audit.service';
import { storeChallenge } from '../session/challenge';
import type { VerifyRegistrationDto } from './dto/verify-registration.dto';
import type { WebauthnCryptoService } from './webauthn-crypto.service';
import { WebauthnRegistrationService } from './webauthn-registration.service';

const VERIFIED = {
  verified: true,
  registrationInfo: {
    credential: {
      id: 'cred-1',
      publicKey: new Uint8Array([1, 2, 3, 4]),
      counter: 0,
      transports: ['internal'],
    },
  },
} as unknown as VerifiedRegistrationResponse;

const DTO = { response: {} } as unknown as VerifyRegistrationDto;

// A verify() call that reaches the credential insert, which rejects with `insertError`.
function setup(insertError: unknown) {
  const insert = vi.fn().mockReturnValue({ values: vi.fn().mockRejectedValue(insertError) });
  const db = { insert } as unknown as NodePgDatabase;
  const config = { getOrThrow: () => 'value' } as unknown as ConfigService;
  const crypto = { verifyRegistrationResponse: vi.fn().mockResolvedValue(VERIFIED) };
  const emailQueue = { enqueue: vi.fn() };
  const audit = { record: vi.fn() };
  const service = new WebauthnRegistrationService(
    db,
    config,
    crypto as unknown as WebauthnCryptoService,
    emailQueue as unknown as EmailQueueService,
    audit as unknown as AuditService,
  );
  const session = { memberId: 'member-1' } as unknown as Request['session'];
  storeChallenge(session, 'registrationChallenge', 'challenge');
  const req = { session, ip: '203.0.113.7' } as unknown as Request;
  return { service, req, insert, crypto, emailQueue, audit };
}

describe('WebauthnRegistrationService.verify', () => {
  it('turns a duplicate credential id into a passkey_registration_failed 400', async () => {
    const { service, req, emailQueue, audit } = setup(
      Object.assign(new Error('duplicate key'), { cause: { code: '23505' } }),
    );

    await expect(service.verify(req, DTO)).rejects.toMatchObject({
      status: 400,
      response: { code: 'passkey_registration_failed' },
    });
    expect(emailQueue.enqueue).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rethrows any other insert failure instead of blaming the request', async () => {
    const outage = new Error('connection terminated');
    const { service, req, emailQueue, audit } = setup(outage);

    await expect(service.verify(req, DTO)).rejects.toBe(outage);
    expect(emailQueue.enqueue).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('logs why the library rejected the attestation, still answering the generic 400', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, req, insert, crypto } = setup(undefined);
    crypto.verifyRegistrationResponse.mockRejectedValue(
      new Error('Unexpected registration response challenge "received", expected "challenge"'),
    );

    await expect(service.verify(req, DTO)).rejects.toMatchObject({
      status: 400,
      response: { code: 'passkey_registration_failed', message: 'Passkey registration failed.' },
    });
    expect(warn).toHaveBeenCalledWith(
      'Passkey attestation rejected: Unexpected registration response challenge "[redacted]", expected "[redacted]"',
    );
    expect(insert).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
