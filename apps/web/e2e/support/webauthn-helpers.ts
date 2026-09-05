import type { Page } from "@playwright/test";

/**
 * Registers a CDP virtual authenticator on `page`'s target so a real
 * WebAuthn ceremony (registration and authentication alike) can run
 * end-to-end in Chromium with no physical hardware — the browser routes
 * every `navigator.credentials.create()`/`.get()` call to it transparently,
 * auto-approving with a simulated user gesture (`automaticPresenceSimulation`)
 * and reporting the user as already verified (`isUserVerified`), so no
 * platform UI ever appears. Persists across in-page navigations (same CDP
 * target) for as long as `page` stays open.
 */
export async function addVirtualAuthenticator(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}
