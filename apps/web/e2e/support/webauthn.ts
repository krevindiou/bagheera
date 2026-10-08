import type { Page } from '@playwright/test';

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
): Promise<{ authenticatorId: string; remove: () => Promise<void> }> {
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
    remove: async () => {
      await client.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
    },
  };
}
