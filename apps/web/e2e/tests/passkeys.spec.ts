import en from '../../src/i18n/locales/en';
import { alertWithText, expect, signOut, test } from '../support/fixtures';
import { addVirtualAuthenticator } from '../support/webauthn';

// The second passkey comes from a second virtual authenticator (a second
// device): the same one would refuse it (CTAP2_ERR_CREDENTIAL_EXCLUDED, as
// a real device does). The step-ups before adding and removing are
// auto-approved (automaticPresenceSimulation).
test('register a second passkey, sign in with it, then remove it', async ({ signedInMember }) => {
  const { page, email } = signedInMember;
  // 'usb': signedInMember already holds the context's one 'internal'.
  const secondAuthenticator = await addVirtualAuthenticator(page, 'usb');

  await page.goto('/en/settings/passkeys');
  await expect(page.getByRole('cell', { name: 'E2E test device', exact: true })).not.toBeVisible();

  await page
    .getByLabel(en.settings.passkeys.deviceNameLabel, { exact: true })
    .fill('E2E test device');
  await page.getByRole('button', { name: en.settings.passkeys.add, exact: true }).click();
  await expect(alertWithText(page, en.settings.passkeys.added)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'E2E test device', exact: true })).toBeVisible();

  await signOut(page);
  await expect(page).toHaveURL(/\/en\/sign-in$/);

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
