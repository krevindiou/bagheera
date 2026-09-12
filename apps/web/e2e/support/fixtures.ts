import { randomUUID } from 'node:crypto';
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { addVirtualAuthenticator } from './webauthn';
import { keyFromLink, waitForEmailLink } from './mailpit';

export { expect };

// Every toast (useToast/ToastContainer.vue) and every inline form banner
// (e.g. SignInPage.vue's invalid-credentials alert) renders as a Bootstrap
// `.alert`/`.toast` carrying `role="alert"` — the one attribute that's only
// ever on the outermost element of either, so filtering on it (rather than
// on rendered text alone, which nests inside a few wrapping elements for a
// toast) can't accidentally match more than one real element.
export function alertWithText(page: Page, text: string): Locator {
  return page.getByRole('alert').filter({ hasText: text });
}

// One randomized identifier per test, never a fixed literal — the whole
// suite runs serially against one shared, seeded Postgres/Valkey pair for
// the run (see playwright.config.ts), so uniqueness has to come from the
// data, not from inter-test cleanup.
export function randomEmail(): string {
  return `e2e-${randomUUID()}@example.test`;
}

export const TEST_PASSWORD = 'Correct-Horse-Battery-Staple-1!';
// Registration needs a 2-letter country code (see auth.schemas.ts); the
// actual country has no bearing on anything under test.
export const REGISTER_COUNTRY = 'US';

/**
 * The API's CSRF protection (double-submit, apps/api/src/session/csrf.ts)
 * applies to every mutating request including anonymous ones — a real UI
 * mutation gets this for free from apiClient's own middleware
 * (apps/web/src/api/client.ts). The raw `page.request` calls below are the
 * one place that middleware doesn't run, so they mint a token themselves,
 * the same way it does.
 */
export async function fetchCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/auth/csrf-token');
  const body = (await res.json()) as { csrfToken: string };
  return body.csrfToken;
}

/**
 * Registers and activates a brand-new member via real HTTP calls sharing
 * `page`'s own browser-context cookie jar (`page.request`) — never a direct
 * DB write (this suite treats the app as a black box, one layer above where
 * that belongs — see the plan's "no direct DB access" convention) — but
 * without typing into the real registration form, since that's only the
 * point of auth.spec.ts's own dedicated test. Every request goes through
 * Vite's dev-server proxy at the same origin the browser itself uses (see
 * apps/web/vite.config.ts), so the session/CSRF cookies this mints are the
 * exact ones a real browser sign-in would carry — no cookie-domain
 * transplanting needed.
 *
 * Deliberately does *not* sign in — used both by tests that need a signed
 * -in member (via signInAsFreshMember below) and by auth.spec.ts's negative
 * -path tests, which need a real, activated account to test a *wrong*
 * password against.
 */
export async function registerAndActivate(
  page: Page,
): Promise<{ email: string; password: string }> {
  const email = randomEmail();
  const password = TEST_PASSWORD;

  await page.request.post('/members/register', {
    headers: { 'x-csrf-token': await fetchCsrfToken(page) },
    data: { email, country: REGISTER_COUNTRY, password, passwordConfirmation: password },
  });

  const activationLink = await waitForEmailLink(email);
  await page.request.post('/members/activate', {
    headers: { 'x-csrf-token': await fetchCsrfToken(page) },
    data: { key: keyFromLink(activationLink) },
  });

  return { email, password };
}

async function signInAsFreshMember(page: Page): Promise<{ email: string; password: string }> {
  const member = await registerAndActivate(page);
  await page.request.post('/auth/sign-in', {
    headers: { 'x-csrf-token': await fetchCsrfToken(page) },
    data: { email: member.email, password: member.password },
  });
  return member;
}

interface AccountWithBank {
  page: Page;
  bankId: string;
  accountId: string;
  currency: string;
}

/** Creates one bank + one account (1000.00 in `currency`) for the signed-in
 * member via the real API, bypassing the bank-choice/account-creation UI —
 * that UI is accounts.spec.ts's own subject; every other domain spec just
 * needs an account to already exist. */
async function createAccountWithBank(page: Page): Promise<AccountWithBank> {
  const currency = 'USD';
  const csrf1 = await fetchCsrfToken(page);
  const bankRes = await page.request.post('/banks/choice', {
    headers: { 'x-csrf-token': csrf1 },
    data: { name: `E2E bank ${randomUUID().slice(0, 8)}` },
  });
  const bank = (await bankRes.json()) as { id: string };

  const csrf2 = await fetchCsrfToken(page);
  const accountRes = await page.request.post('/accounts', {
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
  /** A `page` that's already authenticated as a fresh, real member — see
   * signInAsFreshMember above for exactly what "authenticated" means here. */
  signedInMember: { page: Page; email: string; password: string };
  /** Builds on signedInMember: one bank + one account (1000.00 USD) already
   * exist, ready for operations/schedulers/reports specs to use. */
  accountWithBank: AccountWithBank;
  /** A CDP virtual WebAuthn authenticator attached to `page`, removed
   * automatically after the test. */
  virtualAuthenticator: { authenticatorId: string };
}

export const test = base.extend<Fixtures>({
  signedInMember: async ({ page }, use) => {
    const { email, password } = await signInAsFreshMember(page);
    await use({ page, email, password });
  },

  accountWithBank: async ({ page, signedInMember }, use) => {
    void signedInMember; // establishes the session `page` already carries
    await use(await createAccountWithBank(page));
  },

  virtualAuthenticator: async ({ page }, use) => {
    const authenticator = await addVirtualAuthenticator(page);
    await use({ authenticatorId: authenticator.authenticatorId });
    await authenticator.remove();
  },
});
