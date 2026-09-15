import en from '../../src/i18n/locales/en';
import {
  alertWithText,
  expect,
  randomEmail,
  REGISTER_COUNTRY,
  registerAndActivate,
  test,
  TEST_PASSWORD,
} from '../support/fixtures';
import { existingMessageIds, keyFromLink, waitForEmailLink } from '../support/mailpit';

test.describe('registration, activation, sign-in, sign-out', () => {
  test('registers, activates via the emailed link, signs in, and signs out — all through the real UI', async ({
    page,
  }) => {
    const email = randomEmail();

    await page.goto('/en/register');
    await page.getByLabel(en.auth.register.email, { exact: true }).fill(email);
    await page.getByLabel(en.auth.register.country, { exact: true }).selectOption(REGISTER_COUNTRY);
    await page.getByLabel(en.auth.register.password, { exact: true }).fill(TEST_PASSWORD);
    await page
      .getByLabel(en.auth.register.passwordConfirmation, { exact: true })
      .fill(TEST_PASSWORD);
    await page.getByRole('button', { name: en.auth.register.submit, exact: true }).click();
    await expect(page).toHaveURL(/\/en\/sign-in$/);

    const activationLink = await waitForEmailLink(email);
    await page.goto(activationLink);
    await expect(alertWithText(page, en.auth.activate.success)).toBeVisible();
    await expect(page).toHaveURL(/\/en\/sign-in$/);

    await page.getByLabel(en.auth.signIn.email, { exact: true }).fill(email);
    await page.getByLabel(en.auth.signIn.password, { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: en.auth.signIn.submit, exact: true }).click();
    await expect(page).toHaveURL(/\/en\/home$/);
    await expect(page.getByText(email, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: en.home.signOut, exact: true }).click();
    await expect(page).toHaveURL(/\/en\/sign-in$/);
  });

  test('a too-short password shows its validation message on screen, not just in the DOM', async ({
    page,
  }) => {
    // PasswordInput.vue wraps its real <input> in its own .input-group (for
    // the show/hide toggle), so the sibling .invalid-feedback div next to it
    // needs an explicit d-block — Bootstrap's own
    // ".is-invalid ~ .invalid-feedback" rule only fires between true
    // siblings sharing a parent, and the input now sits one level deeper.
    // A DOM-presence assertion alone can't catch a CSS-visibility
    // regression here; this needs a real browser.
    await page.goto('/en/register');
    await page.getByLabel(en.auth.register.email, { exact: true }).fill(randomEmail());
    await page.getByLabel(en.auth.register.country, { exact: true }).selectOption(REGISTER_COUNTRY);
    await page.getByLabel(en.auth.register.password, { exact: true }).fill('short1');
    await page.getByLabel(en.auth.register.passwordConfirmation, { exact: true }).fill('short1');
    await page.getByRole('button', { name: en.auth.register.submit, exact: true }).click();

    await expect(page.getByText(en.auth.validation.passwordLength)).toBeVisible();
  });

  test('a second activation attempt on an already-used link fails without revealing why', async ({
    page,
  }) => {
    const { email } = await registerAndActivate(page);
    const activationLink = await waitForEmailLink(email);

    await page.goto(activationLink);
    await expect(alertWithText(page, en.auth.activate.error)).toBeVisible();
  });

  test('wrong password and an unknown email both show the same generic error', async ({ page }) => {
    const { email } = await registerAndActivate(page);

    await page.goto('/en/sign-in');
    await page.getByLabel(en.auth.signIn.email, { exact: true }).fill(email);
    await page.getByLabel(en.auth.signIn.password, { exact: true }).fill('not-the-password-1!');
    await page.getByRole('button', { name: en.auth.signIn.submit, exact: true }).click();
    await expect(alertWithText(page, en.auth.signIn.invalidCredentials)).toBeVisible();

    await page.getByLabel(en.auth.signIn.email, { exact: true }).fill(randomEmail());
    await page.getByLabel(en.auth.signIn.password, { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: en.auth.signIn.submit, exact: true }).click();
    await expect(alertWithText(page, en.auth.signIn.invalidCredentials)).toBeVisible();
  });

  test('an inactive account shows a dedicated banner and can resend its activation email', async ({
    page,
  }) => {
    const email = randomEmail();

    // A raw, unactivated register call — the one case that needs to bypass
    // registerAndActivate's own activation step. `page.request` mints its
    // own anonymous session/CSRF cookie via the csrf-token GET below,
    // independent of whatever `page` currently shows.
    const csrfRes = await page.request.get('/auth/csrf-token');
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
    await page.request.post('/members/register', {
      headers: { 'x-csrf-token': csrfToken },
      data: {
        email,
        country: REGISTER_COUNTRY,
        password: TEST_PASSWORD,
        passwordConfirmation: TEST_PASSWORD,
      },
    });

    const originalKey = keyFromLink(await waitForEmailLink(email));

    await page.goto('/en/sign-in');
    await page.getByLabel(en.auth.signIn.email, { exact: true }).fill(email);
    await page.getByLabel(en.auth.signIn.password, { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: en.auth.signIn.submit, exact: true }).click();
    await expect(alertWithText(page, en.auth.signIn.inactiveAccount)).toBeVisible();

    // Captured before resending — the original registration email is still
    // in this inbox, so waitForEmailLink needs to know to ignore it.
    const seenBefore = await existingMessageIds(email);
    await page.getByRole('button', { name: en.auth.signIn.resendActivation, exact: true }).click();
    await expect(alertWithText(page, en.auth.signIn.resendSent)).toBeVisible();

    // The resend really did send a usable, fresh (different) activation link.
    const resentKey = keyFromLink(await waitForEmailLink(email, { excludeIds: seenBefore }));
    expect(resentKey).not.toBe(originalKey);
  });
});
