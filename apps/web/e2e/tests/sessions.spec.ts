import en from '../../src/i18n/locales/en';
import { alertWithText, confirmDialog, expect, randomClientIp, test } from '../support/fixtures';
import { addVirtualAuthenticator } from '../support/webauthn';

// A second browser signs in with a copy of the member's passkey, then the
// first one signs it out from the sessions page (step-up auto-approved).
test('lists another signed-in browser and signs it out', async ({
  signedInMember,
  virtualAuthenticator,
  browser,
}) => {
  const { page, email } = signedInMember;
  const otherContext = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    extraHTTPHeaders: { 'X-Forwarded-For': randomClientIp() },
  });
  const otherPage = await otherContext.newPage();
  const otherAuthenticator = await addVirtualAuthenticator(otherPage);
  for (const credential of await virtualAuthenticator.credentials()) {
    await otherAuthenticator.addCredential(credential);
  }

  await otherPage.goto('/en/sign-in');
  await otherPage.getByRole('button', { name: en.auth.signIn.passkeySubmit, exact: true }).click();
  await expect(otherPage).toHaveURL(/\/en\/home$/);
  await expect(otherPage.getByText(email, { exact: true })).toBeVisible();
  // The API refuses a signature counter that doesn't move forward (a cloned
  // passkey): catch this copy up with the other one, as syncing would.
  for (const credential of await otherAuthenticator.credentials()) {
    await virtualAuthenticator.removeCredential(credential.credentialId);
    await virtualAuthenticator.addCredential(credential);
  }

  await page.goto('/en/settings/sessions');
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText(en.settings.sessions.thisDevice);

  await rows
    .nth(1)
    .getByRole('button', { name: en.settings.sessions.signOut, exact: false })
    .click();
  await confirmDialog(page)
    .getByRole('button', { name: en.settings.sessions.signOut, exact: true })
    .click();
  await expect(alertWithText(page, en.settings.sessions.signedOut)).toBeVisible();
  await expect(rows).toHaveCount(1);

  await otherPage.goto('/en/settings/sessions');
  await expect(otherPage).toHaveURL(/\/en\/sign-in/);

  await otherAuthenticator.remove();
  await otherContext.close();
});

// The session cookie copied into another browser ends the session there and
// in the browser that signed in.
test('ends a session whose cookie shows up in another browser', async ({
  signedInMember,
  browser,
}) => {
  const { page } = signedInMember;
  const thiefContext = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  });
  await thiefContext.addCookies(await page.context().cookies());
  const thiefPage = await thiefContext.newPage();

  await thiefPage.goto('/en/settings/sessions');
  await expect(thiefPage).toHaveURL(/\/en\/sign-in/);

  await page.goto('/en/settings/sessions');
  await expect(page).toHaveURL(/\/en\/sign-in/);

  await thiefContext.close();
});
