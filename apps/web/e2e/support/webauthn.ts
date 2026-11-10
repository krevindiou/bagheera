import type { Page } from '@playwright/test';

// CDP's WebAuthn.Credential, as getCredentials returns it and addCredential
// takes it back.
export interface VirtualCredential {
  credentialId: string;
  isResidentKey: boolean;
  rpId?: string;
  privateKey: string;
  userHandle?: string;
  signCount: number;
}

export interface VirtualAuthenticator {
  authenticatorId: string;
  /** The passkeys it holds, private keys included. */
  credentials: () => Promise<VirtualCredential[]>;
  /** Copies a passkey in, e.g. one from another context's authenticator. */
  addCredential: (credential: VirtualCredential) => Promise<void>;
  removeCredential: (credentialId: string) => Promise<void>;
  remove: () => Promise<void>;
}

/**
 * Adds a CDP virtual authenticator with resident keys to `page`: a real
 * implementation, so the API's verification runs for real (no mocking,
 * unlike the API's integration specs).
 *
 * Chrome allows one `'internal'` authenticator per context, so a second
 * device (passkeys.spec.ts) needs another transport, e.g. `'usb'`. Call
 * `remove()` when done.
 */
export async function addVirtualAuthenticator(
  page: Page,
  transport: 'internal' | 'usb' | 'nfc' | 'ble' = 'internal',
): Promise<VirtualAuthenticator> {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport,
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  return {
    authenticatorId,
    credentials: async () =>
      (await client.send('WebAuthn.getCredentials', { authenticatorId })).credentials,
    addCredential: async (credential) => {
      await client.send('WebAuthn.addCredential', { authenticatorId, credential });
    },
    removeCredential: async (credentialId) => {
      await client.send('WebAuthn.removeCredential', { authenticatorId, credentialId });
    },
    remove: async () => {
      await client.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
    },
  };
}
