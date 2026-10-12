import en from '../../src/i18n/locales/en';
import { alertWithText, confirmDialog, expect, signOut, test } from '../support/fixtures';
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
  // The row's Remove button now carries a contextual accessible name (e.g.
  // "Remove E2E test device"), so match on the action, not the full name.
  await page
    .getByRole('row', { name: 'E2E test device' })
    .getByRole('button', { name: en.settings.passkeys.remove, exact: false })
    .click();
  await confirmDialog(page)
    .getByRole('button', { name: en.settings.passkeys.remove, exact: true })
    .click();
  await expect(alertWithText(page, en.settings.passkeys.removed)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'E2E test device', exact: true })).not.toBeVisible();

  await secondAuthenticator.remove();
});

test('blocks removing the last remaining passkey', async ({ signedInMember }) => {
  const { page } = signedInMember;

  await page.goto('/en/settings/passkeys');
  // Contextual accessible name (e.g. "Remove Unnamed passkey"); match on the
  // action, not the full name.
  const remove = page.getByRole('button', { name: en.settings.passkeys.remove, exact: false });
  await expect(remove).toHaveCount(1);
  await expect(remove).toBeDisabled();
  await expect(page.getByText(en.settings.passkeys.onlyPasskeyHint)).toBeVisible();
});
