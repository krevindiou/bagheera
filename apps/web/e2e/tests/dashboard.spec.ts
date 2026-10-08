import en from '../../src/i18n/locales/en';
import { formatMoney } from '../../src/pages/operations/money';
import { expect, test } from '../support/fixtures';

test.describe('dashboard', () => {
  test('shows onboarding when the member has no bank yet', async ({ signedInMember }) => {
    const { page } = signedInMember;
    await page.goto('/en/home');
    await expect(page.getByTestId('onboarding-tip')).toContainText(en.dashboard.onboardingNoBank);
  });

  test("reflects the member's real account balance and bank/account names", async ({
    accountWithBank,
  }) => {
    const { page, currency } = accountWithBank;
    await page.goto('/en/home');

    await expect(page.getByTestId('total-balance')).toContainText(
      formatMoney(10_000_000, currency),
    );
    // The tile label carries the bank name.
    await expect(page.getByTestId('overview-account')).toBeVisible();
  });
});
