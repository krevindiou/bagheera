import type { VerifiedRegistrationResponse } from '@simplewebauthn/server';
import { credentialInsertValues } from './credential-insert-values';

function fakeRegistrationInfo(
  transports?: string[],
): NonNullable<VerifiedRegistrationResponse['registrationInfo']> {
  return {
    credential: {
      id: 'credential-1',
      publicKey: new Uint8Array([1, 2, 3]),
      counter: 0,
      transports,
    },
  } as unknown as NonNullable<VerifiedRegistrationResponse['registrationInfo']>;
}

describe('credentialInsertValues', () => {
  it('carries transports through when the registration response includes them', () => {
    const values = credentialInsertValues('member-1', fakeRegistrationInfo(['usb', 'nfc']));
    expect(values.transports).toEqual(['usb', 'nfc']);
  });

  it('falls back to null when the registration response has no transports', () => {
    const values = credentialInsertValues('member-1', fakeRegistrationInfo(undefined));
    expect(values.transports).toBeNull();
  });

  it('base64-encodes the public key and carries the rest through as-is', () => {
    const values = credentialInsertValues('member-1', fakeRegistrationInfo(), 'My phone');
    expect(values).toMatchObject({
      memberId: 'member-1',
      credentialId: 'credential-1',
      publicKey: Buffer.from([1, 2, 3]).toString('base64'),
      counter: 0,
      deviceName: 'My phone',
    });
  });
});
