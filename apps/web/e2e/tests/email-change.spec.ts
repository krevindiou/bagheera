import en from '../../src/i18n/locales/en';
import { alertWithText, expect, randomEmail, test } from '../support/fixtures';
import { waitForEmailLink } from '../support/mailpit';

// /en/confirm-email-change had no e2e coverage at all before this rewrite —
// see the plan's "Ground truth" section. The flow: ProfilePage's email
// field (POST /members/profile, current-password-gated) sends a
// confirmation link to the *new* address; the address on file only changes
// once that link is clicked (ConfirmEmailChangePage, POST
// /members/profile/confirm-email-change).
test('changing the account email requires confirming the new address before it takes effect', async ({
  signedInMember,
}) => {
  const { page, email: oldEmail, password } = signedInMember;
  const newEmail = randomEmail();

  await page.goto('/en/settings/profile');
  await page.getByLabel(en.settings.profile.email, { exact: true }).fill(newEmail);
  await page.getByLabel(en.settings.profile.currentPassword, { exact: true }).fill(password);
  await page.getByRole('button', { name: en.settings.profile.submit, exact: true }).click();
  await expect(alertWithText(page, en.settings.profile.success)).toBeVisible();

  const confirmLink = await waitForEmailLink(newEmail);
  await page.goto(confirmLink);
  await expect(alertWithText(page, en.auth.confirmEmailChange.success)).toBeVisible();
  await expect(page).toHaveURL(/\/en\/sign-in$/);

  await page.getByLabel(en.auth.signIn.email, { exact: true }).fill(newEmail);
  await page.getByLabel(en.auth.signIn.password, { exact: true }).fill(password);
  await page.getByRole('button', { name: en.auth.signIn.submit, exact: true }).click();
  await expect(page).toHaveURL(/\/en\/home$/);

  await page.getByRole('button', { name: en.home.signOut, exact: true }).click();
  await page.getByLabel(en.auth.signIn.email, { exact: true }).fill(oldEmail);
  await page.getByLabel(en.auth.signIn.password, { exact: true }).fill(password);
  await page.getByRole('button', { name: en.auth.signIn.submit, exact: true }).click();
  await expect(alertWithText(page, en.auth.signIn.invalidCredentials)).toBeVisible();
});
