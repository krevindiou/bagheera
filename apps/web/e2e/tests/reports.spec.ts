import en from '../../src/i18n/locales/en';
import { alertWithText, confirmDialog, expect, test } from '../support/fixtures';

test('create a sum report, view its chart, then batch-delete it', async ({ accountWithBank }) => {
  const { page } = accountWithBank;
  const title = 'E2E test report';

  await page.goto('/en/reports');
  await page.getByRole('button', { name: en.reports.newSumReport, exact: true }).click();
  await page.getByLabel(en.reports.reportTitle, { exact: true }).fill(title);
  await page.getByRole('button', { name: en.operations.submit, exact: true }).click();
  await expect(alertWithText(page, en.reports.saved)).toBeVisible();

  const row = page.getByTestId('report-row').filter({ hasText: title });
  await expect(row.getByText(en.reports.sum)).toBeVisible();

  // The row's buttons now carry contextual accessible names (e.g. "View
  // chart E2E test report"), so match on the action, not the full name.
  await row.getByRole('button', { name: en.reports.viewChart, exact: false }).click();
  await expect(row.getByRole('button', { name: en.reports.hideChart, exact: false })).toBeVisible();

  await row.getByTestId('report-checkbox').check();
  await page.getByRole('button', { name: en.reports.batch.delete, exact: true }).click();
  await confirmDialog(page).getByRole('button', { name: en.common.delete, exact: true }).click();
  await expect(alertWithText(page, en.reports.batch.deleted)).toBeVisible();
  await expect(page.getByTestId('report-row').filter({ hasText: title })).toHaveCount(0);
});

test('deletes a single report via its own row action', async ({ accountWithBank }) => {
  const { page } = accountWithBank;
  const title = 'E2E single-delete report';

  await page.goto('/en/reports');
  await page.getByRole('button', { name: en.reports.newSumReport, exact: true }).click();
  await page.getByLabel(en.reports.reportTitle, { exact: true }).fill(title);
  await page.getByRole('button', { name: en.operations.submit, exact: true }).click();
  await expect(alertWithText(page, en.reports.saved)).toBeVisible();

  const row = page.getByTestId('report-row').filter({ hasText: title });
  // Full name: every row action's name ends with the title, which itself
  // contains "delete".
  await row.getByRole('button', { name: `${en.accounts.delete} ${title}`, exact: true }).click();
  await confirmDialog(page).getByRole('button', { name: en.common.delete, exact: true }).click();
  await expect(alertWithText(page, en.reports.deleted)).toBeVisible();
  await expect(page.getByTestId('report-row').filter({ hasText: title })).toHaveCount(0);
});
