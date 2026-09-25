import { randomUUID } from 'node:crypto';
import en from '../../src/i18n/locales/en';
import { formatMoney } from '../../src/pages/operations/money';
import { alertWithText, expect, test } from '../support/fixtures';

test('create a bank and an account, then edit the bank and close the account', async ({
  signedInMember,
}) => {
  const { page } = signedInMember;
  const bankName = `E2E bank ${randomUUID().slice(0, 8)}`;
  const renamedBankName = `${bankName} renamed`;
  const accountName = `E2E account ${randomUUID().slice(0, 8)}`;

  await page.goto('/en/accounts');
  await expect(page.getByText(en.accounts.empty)).toBeVisible();

  await page.getByRole('button', { name: en.accounts.addAccount, exact: true }).click();
  await page.getByLabel(en.accounts.newBankName, { exact: true }).fill(bankName);
  await page.getByRole('button', { name: en.accounts.next, exact: true }).click();
  await expect(alertWithText(page, en.accounts.bankSaved)).toBeVisible();

  // Bank-choice submit hands off straight into account creation, pre-scoped
  // to the bank just created.
  await page.getByLabel(en.accounts.accountName, { exact: true }).fill(accountName);
  await page.getByLabel(en.accounts.currency, { exact: true }).selectOption('USD');
  await page.getByLabel(en.accounts.initialBalance, { exact: true }).fill('1000');
  await page.getByRole('button', { name: en.accounts.submit, exact: true }).click();
  await expect(alertWithText(page, en.accounts.accountSaved)).toBeVisible();

  // Account creation redirects straight to its operations page.
  await expect(page).toHaveURL(/\/operations$/);
  await expect(page.getByTestId('account-balances')).toContainText(formatMoney(10_000_000, 'USD'));

  await page.goto('/en/accounts');
  const bankRow = page.getByTestId('bank-row').filter({ hasText: bankName });
  await expect(bankRow.getByText(accountName)).toBeVisible();

  // The bank's own controls render before its nested account list in the
  // DOM, so .first() is the bank's "Edit", not the account row's. Editing
  // now opens a page-level drawer rather than replacing the row inline.
  await bankRow.getByRole('button', { name: en.accounts.edit, exact: true }).first().click();
  const editBankDrawer = page.locator('.drawer-backdrop');
  await editBankDrawer.getByLabel(en.accounts.bankNameLabel, { exact: true }).fill(renamedBankName);
  await editBankDrawer.getByRole('button', { name: en.accounts.submit, exact: true }).click();
  await expect(alertWithText(page, en.accounts.bankSaved)).toBeVisible();
  await expect(page.getByTestId('bank-row').filter({ hasText: renamedBankName })).toBeVisible();

  const accountRow = page.getByTestId('account-row').filter({ hasText: accountName });
  await accountRow.getByRole('button', { name: en.accounts.close, exact: true }).click();
  await page.getByRole('button', { name: en.common.ok, exact: true }).click();
  await expect(alertWithText(page, en.accounts.accountClosed)).toBeVisible();

  // Closed stays listed/reachable rather than disappearing (see
  // CLAUDE.md's ownership-scoping note on "closed").
  await expect(accountRow).toBeVisible();
  await expect(accountRow.getByText(en.accounts.closed)).toBeVisible();
});
