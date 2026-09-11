import type { Page } from "@playwright/test";

/**
 * Adds a resident-key-capable virtual authenticator to `page` via Chrome
 * DevTools Protocol's WebAuthn domain — no physical key involved, and no
 * server-side mocking needed either: a CDP virtual authenticator is a real,
 * spec-compliant implementation, so the API's actual
 * `@simplewebauthn/server` verification runs for real against it (unlike
 * apps/api's own webauthn integration specs, which mock at that boundary
 * because there's no browser there to produce a genuine ceremony).
 *
 * Call `remove()` when done (fixtures.ts does this in its teardown).
 */
export async function addVirtualAuthenticator(
  page: Page,
): Promise<{ authenticatorId: string; remove: () => Promise<void> }> {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  const { authenticatorId } = await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  return {
    authenticatorId,
    remove: async () => {
      await client.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    },
  };
}
