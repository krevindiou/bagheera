import { randomUUID } from 'node:crypto';
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import en from '../../src/i18n/locales/en';
import { addVirtualAuthenticator } from './webauthn';
import { waitForEmailLink } from './mailpit';

export { expect };

// Toasts and form banners carry `role="alert"` on their outermost element
// only, so this matches one element where text alone would match several.
export function alertWithText(page: Page, text: string): Locator {
  return page.getByRole('alert').filter({ hasText: text });
}

/** Signs out through the account menu. */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: en.home.accountMenu }).click();
  await page.getByRole('button', { name: en.home.signOut, exact: true }).click();
}

// The whole run shares one database: isolation comes from unique data, not
// cleanup.
export function randomEmail(): string {
  return `e2e-${randomUUID()}@example.test`;
}

// Any valid country; none of the tests depend on it.
export const REGISTER_COUNTRY = 'US';

/**
 * A CSRF token for raw `page.request` mutations, which bypass apiClient's
 * middleware.
 */
export async function fetchCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/auth/csrf-token');
  const body = (await res.json()) as { csrfToken: string };
  return body.csrfToken;
}

/**
 * Registers through `page.request`, then completes the passkey ceremony on
 * the real /activate page (it needs a browser), leaving `page` signed in.
 * Needs a `virtualAuthenticator` attached first, or the ceremony hangs. The
 * registration form itself is auth.spec.ts's subject.
 */
export async function registerAndCompletePasskeySignup(page: Page): Promise<{ email: string }> {
  const email = randomEmail();

  await page.request.post('/api/members/register', {
    headers: { 'x-csrf-token': await fetchCsrfToken(page) },
    data: { email, country: REGISTER_COUNTRY },
  });

  const activationLink = await waitForEmailLink(email);
  await page.goto(activationLink);
  // The click is the user gesture that starts the ceremony.
  await page.getByRole('button', { name: en.auth.activate.submit, exact: true }).click();
  await page.waitForURL(/\/en\/home$/);

  return { email };
}

interface AccountWithBank {
  page: Page;
  bankId: string;
  accountId: string;
  currency: string;
}

/** One bank and one account (1000.00 USD) through the API; the creation UI
 * is accounts.spec.ts's subject. */
async function createAccountWithBank(page: Page): Promise<AccountWithBank> {
  const currency = 'USD';
  const csrf1 = await fetchCsrfToken(page);
  const bankRes = await page.request.post('/api/banks/choice', {
    headers: { 'x-csrf-token': csrf1 },
    data: { name: `E2E bank ${randomUUID().slice(0, 8)}` },
  });
  const bank = (await bankRes.json()) as { id: string };

  const csrf2 = await fetchCsrfToken(page);
  const accountRes = await page.request.post('/api/accounts', {
    headers: { 'x-csrf-token': csrf2 },
    data: {
      bankId: bank.id,
      name: `E2E account ${randomUUID().slice(0, 8)}`,
      currency,
      initialBalance: 1000,
    },
  });
  const created = (await accountRes.json()) as { account: { id: string } };

  return { page, bankId: bank.id, accountId: created.account.id, currency };
}

interface Fixtures {
  /** `page`, signed in as a fresh member with one passkey. */
  signedInMember: { page: Page; email: string };
  /** signedInMember plus one bank and one account (1000.00 USD). */
  accountWithBank: AccountWithBank;
  /** A CDP virtual authenticator on `page`, removed after the test.
   * signedInMember depends on it; request it directly only to inspect it. */
  virtualAuthenticator: { authenticatorId: string };
}

export const test = base.extend<Fixtures>({
  virtualAuthenticator: async ({ page }, use) => {
    const authenticator = await addVirtualAuthenticator(page);
    await use({ authenticatorId: authenticator.authenticatorId });
    await authenticator.remove();
  },

  signedInMember: async ({ page, virtualAuthenticator }, use) => {
    void virtualAuthenticator; // must be attached before the signup ceremony runs
    const { email } = await registerAndCompletePasskeySignup(page);
    await use({ page, email });
  },

  accountWithBank: async ({ page, signedInMember }, use) => {
    void signedInMember; // establishes the session `page` already carries
    await use(await createAccountWithBank(page));
  },
});
