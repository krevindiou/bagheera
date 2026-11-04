import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VerifiedRegistrationResponse } from '@simplewebauthn/server';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { vi } from 'vitest';
import type { EmailQueueService } from '../email/email-queue.service';
import type { AuditService } from '../security/audit.service';
import { storeChallenge } from '../session/challenge';
import { SingleUseStore } from '../session/single-use-store';
import { FakeValkey } from '../test-support/fake-valkey';
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

const MEMBER_ROW = { id: 'member-1', email: 'm@example.test', locale: 'en', sessionEpoch: 0 };

// A verify() call that reaches the credential insert, which rejects with
// `insertError` (or succeeds without one), the member row locked at `epoch`.
async function setup(insertError: unknown, epoch = 0) {
  const values = insertError
    ? vi.fn().mockRejectedValue(insertError)
    : vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values });
  const forUpdate = vi.fn().mockResolvedValue([{ ...MEMBER_ROW, sessionEpoch: epoch }]);
  const select = vi.fn().mockReturnValue({
    from: () => ({ where: () => ({ for: forUpdate }) }),
  });
  const tx = { select, insert };
  const db = {
    transaction: vi.fn((run: (t: typeof tx) => Promise<unknown>) => run(tx)),
  } as unknown as NodePgDatabase;
  const config = { getOrThrow: () => 'value' } as unknown as ConfigService;
  const crypto = { verifyRegistrationResponse: vi.fn().mockResolvedValue(VERIFIED) };
  const emailQueue = { enqueue: vi.fn() };
  const audit = { record: vi.fn() };
  const singleUse = new SingleUseStore(new FakeValkey().asClient());
  const service = new WebauthnRegistrationService(
    db,
    config,
    crypto as unknown as WebauthnCryptoService,
    emailQueue as unknown as EmailQueueService,
    audit as unknown as AuditService,
    singleUse,
  );
  const session = { memberId: 'member-1' } as unknown as Request['session'];
  const req = { session, sessionID: 'sid-1', ip: '203.0.113.7' } as unknown as Request;
  await storeChallenge(singleUse, req, 'registrationChallenge', { challenge: 'challenge' });
  return { service, req, insert, forUpdate, crypto, emailQueue, audit };
}

describe('WebauthnRegistrationService.verify', () => {
  it('turns a duplicate credential id into a passkey_registration_failed 400', async () => {
    const { service, req, emailQueue, audit } = await setup(
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
    const { service, req, emailQueue, audit } = await setup(outage);

    await expect(service.verify(req, DTO)).rejects.toBe(outage);
    expect(emailQueue.enqueue).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('locks the member row, then stores the credential and alerts the member', async () => {
    const { service, req, insert, forUpdate, emailQueue, audit } = await setup(undefined);

    await service.verify(req, DTO);

    expect(forUpdate).toHaveBeenCalledWith('update');
    expect(insert).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      'webauthn_credential_registered',
      'member-1',
      '203.0.113.7',
    );
    expect(emailQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ to: MEMBER_ROW.email }),
    );
  });

  // A passkey removal committed since the request started.
  it('refuses with a 401 and stores nothing once the session is behind the member epoch', async () => {
    const { service, req, insert, emailQueue, audit } = await setup(undefined, 1);

    await expect(service.verify(req, DTO)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(insert).not.toHaveBeenCalled();
    expect(emailQueue.enqueue).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('logs why the library rejected the attestation, still answering the generic 400', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, req, insert, crypto } = await setup(undefined);
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
