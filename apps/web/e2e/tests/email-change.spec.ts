import en from '../../src/i18n/locales/en';
import { alertWithText, expect, randomEmail, test } from '../support/fixtures';
import { waitForEmailLink } from '../support/mailpit';

// /en/confirm-email-change had no e2e coverage at all before this rewrite —
// see the plan's "Ground truth" section. The flow: ProfilePage's email
// field (POST /members/profile, gated by a WebAuthn step-up ceremony
// instead of a password) sends a confirmation link to the *new* address;
// the address on file only changes once that link is clicked
// (ConfirmEmailChangePage, POST /members/profile/confirm-email-change).
test('changing the account email requires a step-up passkey confirmation and confirming the new address before it takes effect', async ({
  signedInMember,
}) => {
  const { page, email: oldEmail } = signedInMember;
  const newEmail = randomEmail();

  await page.goto('/en/settings/profile');
  await page.getByLabel(en.settings.profile.email, { exact: true }).fill(newEmail);
  await page.getByRole('button', { name: en.settings.profile.submit, exact: true }).click();
  await expect(alertWithText(page, en.settings.profile.success)).toBeVisible();

  const confirmLink = await waitForEmailLink(newEmail);
  await page.goto(confirmLink);
  await expect(alertWithText(page, en.auth.confirmEmailChange.success)).toBeVisible();
  await expect(page).toHaveURL(/\/en\/sign-in$/);

  await page.getByLabel(en.auth.signIn.email, { exact: true }).fill(newEmail);
  await page.getByRole('button', { name: en.auth.signIn.passkeySubmit, exact: true }).click();
  await expect(page).toHaveURL(/\/en\/home$/);

  await page.getByRole('button', { name: en.home.signOut, exact: true }).click();
  await page.getByLabel(en.auth.signIn.email, { exact: true }).fill(oldEmail);
  await page.getByRole('button', { name: en.auth.signIn.passkeySubmit, exact: true }).click();
  await expect(alertWithText(page, en.auth.signIn.invalidCredentials)).toBeVisible();
});
