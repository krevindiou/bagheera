import en from '../../src/i18n/locales/en';
import { alertWithText, expect, test } from '../support/fixtures';
import { addVirtualAuthenticator } from '../support/webauthn';

// The virtual authenticator is a real, spec-compliant WebAuthn
// implementation (see support/webauthn.ts) — no server-side mocking, unlike
// apps/api's own webauthn integration specs, which have no browser to
// produce a genuine ceremony with. signedInMember already registered one
// passkey (the signup ceremony itself, against its own authenticator) —
// this adds a *second*, distinct passkey from a *different* virtual
// authenticator (simulating a second physical device, e.g. a phone next
// to a laptop): registering a second passkey with excludeCredentials
// naming the first one against the SAME authenticator is correctly
// refused (CTAP2_ERR_CREDENTIAL_EXCLUDED) — that's the real spec
// behavior an actual second registration attempt on the same device would
// hit too, not a test artifact.
test('register a second passkey, sign in with it, then remove it', async ({ signedInMember }) => {
  const { page, email } = signedInMember;
  // 'usb' (not the default 'internal'): Chrome allows only one 'internal'
  // authenticator per context, and signedInMember's own setup already
  // attached one — see addVirtualAuthenticator's own comment.
  const secondAuthenticator = await addVirtualAuthenticator(page, 'usb');

  await page.goto('/en/settings/passkeys');
  await expect(page.getByRole('cell', { name: 'E2E test device', exact: true })).not.toBeVisible();

  await page
    .getByLabel(en.settings.passkeys.deviceNameLabel, { exact: true })
    .fill('E2E test device');
  await page.getByRole('button', { name: `+ ${en.settings.passkeys.add}`, exact: true }).click();
  await expect(alertWithText(page, en.settings.passkeys.added)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'E2E test device', exact: true })).toBeVisible();

  await page.getByRole('button', { name: en.home.signOut, exact: true }).click();
  await expect(page).toHaveURL(/\/en\/sign-in$/);

  await page.getByLabel(en.auth.signIn.email, { exact: true }).fill(email);
  await page.getByRole('button', { name: en.auth.signIn.passkeySubmit, exact: true }).click();
  await expect(page).toHaveURL(/\/en\/home$/);
  await expect(page.getByText(email, { exact: true })).toBeVisible();

  await page.goto('/en/settings/passkeys');
  await page
    .getByRole('row', { name: 'E2E test device' })
    .getByRole('button', { name: en.settings.passkeys.remove, exact: true })
    .click();
  await page.getByRole('button', { name: en.common.ok, exact: true }).click();
  await expect(alertWithText(page, en.settings.passkeys.removed)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'E2E test device', exact: true })).not.toBeVisible();

  await secondAuthenticator.remove();
});

test('blocks removing the last remaining passkey', async ({ signedInMember }) => {
  const { page } = signedInMember;

  await page.goto('/en/settings/passkeys');
  await page.getByRole('button', { name: en.settings.passkeys.remove, exact: true }).click();
  await page.getByRole('button', { name: en.common.ok, exact: true }).click();

  await expect(alertWithText(page, en.settings.passkeys.lastPasskeyError)).toBeVisible();
  await expect(page.getByRole('button', { name: en.settings.passkeys.remove })).toHaveCount(1);
});
