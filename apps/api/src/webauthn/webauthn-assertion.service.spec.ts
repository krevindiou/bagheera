import { ConfigService } from '@nestjs/config';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { vi } from 'vitest';
import { WebauthnAssertionService, type WebauthnCredentialRow } from './webauthn-assertion.service';
import type { WebauthnCryptoService } from './webauthn-crypto.service';

const CREDENTIAL = {
  id: 'row-1',
  memberId: 'member-1',
  credentialId: 'cred-1',
  publicKey: Buffer.from([1, 2, 3, 4]).toString('base64'),
  counter: 5,
  transports: null,
  deviceName: null,
  createdAt: new Date(),
  lastUsedAt: null,
} satisfies WebauthnCredentialRow;

const RESPONSE = { id: 'cred-1' } as unknown as AuthenticationResponseJSON;

const CONFIG_VALUES: Record<string, string> = {
  RP_ID: 'example.test',
  RP_NAME: 'Example',
  RP_ORIGIN: 'https://example.test',
};

function setup(rows: WebauthnCredentialRow[] = []) {
  const where = vi.fn().mockResolvedValue(rows);
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where: updateWhere });
  const db = {
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where }) }),
    update: vi.fn().mockReturnValue({ set }),
  };
  const config = { getOrThrow: (key: string) => CONFIG_VALUES[key] };
  const crypto = { verifyAuthenticationResponse: vi.fn() };
  const service = new WebauthnAssertionService(
    db as unknown as NodePgDatabase,
    config as unknown as ConfigService,
    crypto as unknown as WebauthnCryptoService,
  );
  return { service, db, set, updateWhere, crypto };
}

describe('WebauthnAssertionService', () => {
  describe('findCredential', () => {
    it('returns the row for a known credential id', async () => {
      const { service } = setup([CREDENTIAL]);

      await expect(service.findCredential('cred-1')).resolves.toBe(CREDENTIAL);
    });

    it('returns undefined for an unknown credential id', async () => {
      const { service } = setup([]);

      await expect(service.findCredential('nope')).resolves.toBeUndefined();
    });
  });

  describe('verify', () => {
    it('checks the response against the stored credential and returns the new counter', async () => {
      const { service, crypto } = setup();
      crypto.verifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 6 },
      });

      await expect(service.verify(CREDENTIAL, RESPONSE, 'challenge')).resolves.toEqual({
        verified: true,
        newCounter: 6,
      });
      expect(crypto.verifyAuthenticationResponse).toHaveBeenCalledWith({
        response: RESPONSE,
        expectedChallenge: 'challenge',
        expectedOrigin: 'https://example.test',
        expectedRPID: 'example.test',
        credential: {
          id: 'cred-1',
          publicKey: Buffer.from([1, 2, 3, 4]),
          counter: 5,
          transports: undefined,
        },
      });
    });

    it('passes stored transports through', async () => {
      const { service, crypto } = setup();
      crypto.verifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 6 },
      });

      await service.verify({ ...CREDENTIAL, transports: ['internal'] }, RESPONSE, 'challenge');

      expect(crypto.verifyAuthenticationResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          credential: expect.objectContaining({ transports: ['internal'] }) as unknown,
        }),
      );
    });

    it('reports an unverified assertion as not verified', async () => {
      const { service, crypto } = setup();
      crypto.verifyAuthenticationResponse.mockResolvedValue({
        verified: false,
      });

      await expect(service.verify(CREDENTIAL, RESPONSE, 'challenge')).resolves.toEqual({
        verified: false,
      });
    });

    it('reports a rejected assertion as not verified', async () => {
      const { service, crypto } = setup();
      crypto.verifyAuthenticationResponse.mockRejectedValue(new Error('bad signature'));

      await expect(service.verify(CREDENTIAL, RESPONSE, 'challenge')).resolves.toEqual({
        verified: false,
      });
    });

    it('never writes to the database', async () => {
      const { service, db, crypto } = setup();
      crypto.verifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 6 },
      });

      await service.verify(CREDENTIAL, RESPONSE, 'challenge');

      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe('recordUse', () => {
    it('stores the new counter and a last-used time on that credential', async () => {
      const { service, db, set, updateWhere } = setup();

      await service.recordUse(CREDENTIAL, 6);

      expect(db.update).toHaveBeenCalledTimes(1);
      expect(set).toHaveBeenCalledWith({ counter: 6, lastUsedAt: expect.any(Date) as unknown });
      expect(updateWhere).toHaveBeenCalledTimes(1);
    });
  });
});
