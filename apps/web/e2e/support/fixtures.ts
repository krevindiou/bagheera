import { randomUUID } from 'node:crypto';
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import en from '../../src/i18n/locales/en';
import { addVirtualAuthenticator } from './webauthn';
import { waitForEmailLink } from './mailpit';

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

/**
 * Signs out via the real UI — sign-out lives behind the sidebar's account
 * menu (AccountMenu.vue), not as its own always-visible button, so this is
 * a 2-step interaction: open the menu, then click Logout inside it.
 */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: en.home.accountMenu }).click();
  await page.getByRole('button', { name: en.home.signOut, exact: true }).click();
}

// One randomized identifier per test, never a fixed literal — the whole
// suite runs serially against one shared, seeded Postgres/Valkey pair for
// the run (see playwright.config.ts), so uniqueness has to come from the
// data, not from inter-test cleanup.
export function randomEmail(): string {
  return `e2e-${randomUUID()}@example.test`;
}

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
 * Registers a brand-new member via a real HTTP call sharing `page`'s own
 * browser-context cookie jar (`page.request`), then drives the real
 * `/activate` page to complete the WebAuthn signup ceremony — that
 * ceremony has to run inside an actual browser (a real
 * `navigator.credentials.create()` call), so unlike the old
 * password-registration flow, this can't stay entirely `page.request`;
 * only the initial `POST /members/register` does. Requires a
 * `virtualAuthenticator` already attached to `page` (see the
 * `signedInMember` fixture below), or the ceremony has no authenticator to
 * complete against and hangs.
 *
 * Lands `page` fully signed in (the ceremony ends the same way passkey
 * sign-in does — see WebauthnSignupService). Not typed into the real
 * registration form, since that's only the point of auth.spec.ts's own
 * dedicated test.
 */
export async function registerAndCompletePasskeySignup(page: Page): Promise<{ email: string }> {
  const email = randomEmail();

  await page.request.post('/members/register', {
    headers: { 'x-csrf-token': await fetchCsrfToken(page) },
    data: { email, country: REGISTER_COUNTRY },
  });

  const activationLink = await waitForEmailLink(email);
  await page.goto(activationLink);
  // The ceremony can't run on page load — navigator.credentials.create()
  // requires a real user gesture (see ActivatePage.vue's own comment) — so
  // this click is not just UI navigation, it's what starts the ceremony.
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
  /** A `page` that's already authenticated as a fresh, real member with one
   * registered passkey — see registerAndCompletePasskeySignup above for
   * exactly what "authenticated" means here. */
  signedInMember: { page: Page; email: string };
  /** Builds on signedInMember: one bank + one account (1000.00 USD) already
   * exist, ready for operations/schedulers/reports specs to use. */
  accountWithBank: AccountWithBank;
  /** A CDP virtual WebAuthn authenticator attached to `page`, removed
   * automatically after the test. Every account now needs a passkey to
   * exist at all (see registerAndCompletePasskeySignup), so `signedInMember`
   * itself depends on this — request it by name too (as passkeys.spec.ts
   * does) only when a test needs to reason about it directly. */
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
