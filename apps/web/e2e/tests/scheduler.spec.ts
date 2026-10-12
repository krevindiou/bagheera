import en from '../../src/i18n/locales/en';
import { PAYMENT_METHOD_ID } from '../../src/domain/referenceData';
import { alertWithText, confirmDialog, expect, test } from '../support/fixtures';

test('create, pause, then batch-delete a recurring scheduler', async ({ accountWithBank }) => {
  const { page, accountId } = accountWithBank;

  await page.goto(`/en/accounts/${accountId}/schedulers`);
  await page.getByRole('button', { name: en.schedulers.addScheduler, exact: true }).click();
  await page.getByLabel(en.operations.thirdParty, { exact: true }).fill('Rent');
  await page.getByLabel(en.operations.amount, { exact: true }).fill('800');
  await page
    .getByLabel(en.operations.paymentMethod, { exact: true })
    .selectOption(PAYMENT_METHOD_ID.DIRECT_DEBIT);
  await page.getByRole('button', { name: en.operations.submit, exact: true }).click();
  await expect(alertWithText(page, en.schedulers.created)).toBeVisible();

  const row = page.getByTestId('scheduler-row').filter({ hasText: 'Rent' });
  await expect(row.getByTitle(en.schedulers.active)).toBeVisible();

  // The row's Edit button now carries a contextual accessible name (e.g.
  // "Edit Rent"), so match on the action, not the full name.
  await row.getByRole('button', { name: en.operations.edit, exact: false }).click();
  await page.getByLabel(en.schedulers.active, { exact: true }).uncheck();
  await page.getByRole('button', { name: en.operations.submit, exact: true }).click();
  await expect(alertWithText(page, en.schedulers.updated)).toBeVisible();
  await expect(row.getByTitle(en.schedulers.paused)).toBeVisible();

  await row.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: en.schedulers.batch.delete, exact: true }).click();
  await confirmDialog(page).getByRole('button', { name: en.common.delete, exact: true }).click();
  await expect(alertWithText(page, en.schedulers.batch.deleted)).toBeVisible();
  await expect(page.getByTestId('scheduler-row').filter({ hasText: 'Rent' })).toHaveCount(0);
});
