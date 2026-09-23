import en from '../../src/i18n/locales/en';
import {
  alertWithText,
  expect,
  randomEmail,
  REGISTER_COUNTRY,
  registerAndCompletePasskeySignup,
  signOut,
  test,
} from '../support/fixtures';
import { waitForEmailLink } from '../support/mailpit';

test.describe('registration, passkey signup ceremony, sign-in, sign-out', () => {
  test('registers, completes the passkey ceremony via the emailed link, signs in, and signs out — all through the real UI', async ({
    page,
    virtualAuthenticator,
  }) => {
    void virtualAuthenticator; // must be attached before the signup ceremony runs
    const email = randomEmail();

    await page.goto('/en/register');
    await page.getByLabel(en.auth.register.email, { exact: true }).fill(email);
    await page.getByLabel(en.auth.register.country, { exact: true }).selectOption(REGISTER_COUNTRY);
    await page.getByRole('button', { name: en.auth.register.submit, exact: true }).click();
    await expect(page).toHaveURL(/\/en\/sign-in$/);

    const activationLink = await waitForEmailLink(email);
    await page.goto(activationLink);
    await page.getByRole('button', { name: en.auth.activate.submit, exact: true }).click();
    await expect(page).toHaveURL(/\/en\/home$/);
    await expect(page.getByText(email, { exact: true })).toBeVisible();

    await signOut(page);
    await expect(page).toHaveURL(/\/en\/sign-in$/);

    // Usernameless: no email to type — the passkey alone says who's back.
    await page.getByRole('button', { name: en.auth.signIn.passkeySubmit, exact: true }).click();
    await expect(page).toHaveURL(/\/en\/home$/);
    await expect(page.getByText(email, { exact: true })).toBeVisible();
  });

  test('a second completion attempt on an already-used link fails without revealing why', async ({
    page,
    virtualAuthenticator,
  }) => {
    void virtualAuthenticator;
    const { email } = await registerAndCompletePasskeySignup(page);

    // The single email this account ever received — still sitting in
    // Mailpit, so re-fetching it (no excludeIds) returns the same link.
    const activationLink = await waitForEmailLink(email);
    await page.goto(activationLink);
    await page.getByRole('button', { name: en.auth.activate.submit, exact: true }).click();
    await expect(alertWithText(page, en.auth.activate.error)).toBeVisible();
  });
});
