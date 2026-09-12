import en from '../../src/i18n/locales/en';
import { PAYMENT_METHOD_ID } from '../../src/pages/operations/operations.types';
import { expect, fetchCsrfToken, test } from '../support/fixtures';

test('filtering operations by third-party text narrows the list, and clearing restores it', async ({
  accountWithBank,
}) => {
  const { page, accountId } = accountWithBank;

  for (const thirdParty of ['Coffee Shop', 'Electronics Store']) {
    await page.request.post('/operations', {
      headers: { 'x-csrf-token': await fetchCsrfToken(page) },
      data: {
        accountId,
        type: 'debit',
        thirdParty,
        amount: 10,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        valueDate: new Date().toISOString().slice(0, 10),
        notes: '',
        reconciled: false,
      },
    });
  }

  await page.goto(`/en/accounts/${accountId}/operations`);
  await expect(page.getByTestId('operation-row').filter({ hasText: 'Coffee Shop' })).toBeVisible();
  await expect(
    page.getByTestId('operation-row').filter({ hasText: 'Electronics Store' }),
  ).toBeVisible();

  await page.getByTestId('toggle-search').click();
  await page.getByLabel(en.operations.thirdParty, { exact: true }).fill('Coffee');
  await page.getByRole('button', { name: en.operations.search.submit, exact: true }).click();

  await expect(page.getByTestId('operation-row').filter({ hasText: 'Coffee Shop' })).toBeVisible();
  await expect(
    page.getByTestId('operation-row').filter({ hasText: 'Electronics Store' }),
  ).toHaveCount(0);

  await page.getByRole('button', { name: en.operations.search.clear, exact: true }).click();
  await expect(
    page.getByTestId('operation-row').filter({ hasText: 'Electronics Store' }),
  ).toBeVisible();
});
