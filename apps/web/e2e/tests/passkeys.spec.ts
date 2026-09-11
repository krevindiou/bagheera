import en from "../../src/i18n/locales/en";
import { alertWithText, expect, test } from "../support/fixtures";

// The virtual authenticator is a real, spec-compliant WebAuthn
// implementation (see support/webauthn.ts) — no server-side mocking, unlike
// apps/api's own webauthn integration specs, which have no browser to
// produce a genuine ceremony with.
test("register a passkey, sign in with it instead of a password, then remove it", async ({
  signedInMember,
  virtualAuthenticator,
}) => {
  void virtualAuthenticator; // requested for its setup/teardown side effect only
  const { page, email } = signedInMember;

  await page.goto("/en/settings/passkeys");
  await expect(page.getByText(en.settings.passkeys.empty)).toBeVisible();

  await page
    .getByLabel(en.settings.passkeys.deviceNameLabel, { exact: true })
    .fill("E2E test device");
  await page.getByRole("button", { name: en.settings.passkeys.add, exact: true }).click();
  await expect(alertWithText(page, en.settings.passkeys.added)).toBeVisible();
  await expect(page.getByRole("cell", { name: "E2E test device", exact: true })).toBeVisible();

  await page.getByRole("button", { name: en.home.signOut, exact: true }).click();
  await expect(page).toHaveURL(/\/en\/sign-in$/);

  await page.getByLabel(en.auth.signIn.email, { exact: true }).fill(email);
  await page.getByRole("button", { name: en.auth.signIn.passkeySubmit, exact: true }).click();
  await expect(page).toHaveURL(/\/en\/home$/);
  await expect(page.getByText(en.home.signedInAs.replace("{email}", email))).toBeVisible();

  await page.goto("/en/settings/passkeys");
  await page.getByRole("button", { name: en.settings.passkeys.remove, exact: true }).click();
  await page.getByRole("button", { name: en.common.ok, exact: true }).click();
  await expect(alertWithText(page, en.settings.passkeys.removed)).toBeVisible();
  await expect(page.getByText(en.settings.passkeys.empty)).toBeVisible();
});
