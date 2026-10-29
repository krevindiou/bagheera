import en from '../../src/i18n/locales/en';
import { alertWithText, expect, fetchCsrfToken, test } from '../support/fixtures';

interface Row {
  date: string;
  amount: string;
  name: string;
  reference?: string;
  type?: string;
}

// A version 1.x bank file with one statement, in the currency of the account.
function ofxFile(currency: string, ...rows: Row[]): Buffer {
  const transactions = rows
    .map(
      (row) =>
        `<STMTTRN>\n<TRNTYPE>${row.type ?? 'DEBIT'}\n<DTPOSTED>${row.date}\n<TRNAMT>${row.amount}\n` +
        `${row.reference ? `<FITID>${row.reference}\n` : ''}<NAME>${row.name}\n</STMTTRN>`,
    )
    .join('\n');
  return Buffer.from(
    'OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\n' +
      'COMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE\n\n' +
      `<OFX>\n<BANKMSGSRSV1>\n<STMTTRNRS>\n<STMTRS>\n<CURDEF>${currency}\n` +
      '<BANKACCTFROM>\n<BANKID>1\n<ACCTID>1\n</BANKACCTFROM>\n<BANKTRANLIST>\n' +
      `${transactions}\n</BANKTRANLIST>\n</STMTRS>\n</STMTTRNRS>\n</BANKMSGSRSV1>\n</OFX>\n`,
    'latin1',
  );
}

test('import a bank file, then find the same file already recorded', async ({
  accountWithBank,
}) => {
  const { page, accountId, currency } = accountWithBank;
  const bankFile = ofxFile(
    currency,
    { date: '20260305', amount: '-12.50', name: 'E2E Bakery', reference: 'E2E-1' },
    { date: '20260306', amount: '1250.00', name: 'E2E Employer', reference: 'E2E-2' },
    { date: 'not a date', amount: '-1.00', name: 'E2E Oops', reference: 'E2E-3' },
  );

  async function uploadAndPreview() {
    await page.goto(`/en/accounts/${accountId}/operations`);
    await page.getByRole('link', { name: en.operations.importLink, exact: true }).click();
    await page.getByTestId('import-file').setInputFiles({
      name: 'bank.ofx',
      mimeType: 'application/x-ofx',
      buffer: bankFile,
    });
    await expect(page.getByTestId('import-preview-section')).toBeVisible();
  }

  await uploadAndPreview();
  const filter = (name: string) => page.getByTestId(`import-filter-${name}`);
  await expect(filter('import')).toContainText('2');
  await expect(filter('invalid')).toContainText('1');
  await expect(page.getByTestId('import-period')).toBeVisible();
  await expect(page.getByTestId('import-credits')).toContainText('1,250.00');
  await expect(page.getByTestId('import-row-invalid')).toContainText(
    en.operations.import.reasons.date_invalid,
  );

  const bakeryMethod = page
    .getByTestId('import-row-import')
    .first()
    .getByTestId('import-row-payment-method');
  await bakeryMethod.selectOption({ label: 'Cash withdrawal' });
  await expect(bakeryMethod.locator('option:checked')).toHaveText('Cash withdrawal');

  await page.getByTestId('import-confirm').click();
  await expect(
    alertWithText(page, '2 operations imported, 0 already recorded, 1 invalid.'),
  ).toBeVisible();
  await expect(page.getByTestId('operation-row').filter({ hasText: 'E2E Bakery' })).toBeVisible();
  await expect(page.getByTestId('operation-row').filter({ hasText: 'E2E Employer' })).toBeVisible();

  await uploadAndPreview();
  await expect(filter('import')).toContainText('0');
  await expect(filter('skipped')).toContainText('2');
  await expect(page.getByTestId('import-confirm')).toBeDisabled();
  await expect(page.getByTestId('import-recorded').first()).toContainText('Already recorded');

  await page.getByTestId('import-include').first().check();
  await expect(page.getByTestId('import-confirm')).toHaveText('Import 1 operation');
});

test('remember a label correction, see it applied, then delete it without duplicating on re-import', async ({
  accountWithBank,
}) => {
  const { page, accountId, currency } = accountWithBank;
  const bankLabel = 'CB*9999 E2E CARREFOUR';
  const fileOf = (...rows: Row[]) => ofxFile(currency, ...rows);

  async function uploadAndPreview(content: Buffer) {
    await page.goto(`/en/accounts/${accountId}/operations`);
    await page.getByRole('link', { name: en.operations.importLink, exact: true }).click();
    await page.getByTestId('import-file').setInputFiles({
      name: 'bank.ofx',
      mimeType: 'application/x-ofx',
      buffer: content,
    });
    await expect(page.getByTestId('import-preview-section')).toBeVisible();
  }

  await uploadAndPreview(fileOf({ date: '20260305', amount: '-12.50', name: bankLabel }));
  await page.getByTestId('import-change-label').click();
  await page.getByTestId('import-label-input').fill('E2E Carrefour');
  await page.getByTestId('import-label-apply').click();
  // The change applies at once; no further step.
  await expect(page.getByTestId('import-third-party')).toHaveText('E2E Carrefour');
  await expect(page.getByTestId('import-confirm')).toBeEnabled();
  await expect(page.getByTestId('import-label-origin')).toHaveText(
    en.operations.import.preview.origin.change,
  );
  await expect(page.getByTestId('import-source-label')).toContainText(bankLabel);

  await page.getByTestId('import-confirm').click();
  await expect(alertWithText(page, '1 label correction remembered.')).toBeVisible();
  await expect(
    page.getByTestId('operation-row').filter({ hasText: 'E2E Carrefour' }),
  ).toBeVisible();

  // Another day's operation with the same bank label is corrected on its own.
  await uploadAndPreview(fileOf({ date: '20260309', amount: '-8.00', name: bankLabel }));
  await expect(page.getByTestId('import-third-party')).toHaveText('E2E Carrefour');
  await expect(page.getByTestId('import-label-origin')).toHaveText(
    en.operations.import.preview.origin.correction,
  );
  await page.getByTestId('import-cancel').click();

  await page.goto('/en/settings/label-corrections');
  // Remembered without the payment-method wording that starts the bank label.
  const row = page.getByTestId('label-correction-row').filter({ hasText: 'E2E CARREFOUR' });
  await expect(row).toContainText('E2E Carrefour');
  await row.getByRole('checkbox').check();
  await page.getByTestId('label-correction-delete').click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByTestId('label-correction-row')).toHaveCount(0);

  // The first file's operation is still recognised under the bank's own label.
  await uploadAndPreview(fileOf({ date: '20260305', amount: '-12.50', name: bankLabel }));
  await expect(page.getByTestId('import-filter-skipped')).toContainText('1');
});

test('suggest the category given to an earlier operation of the same third party, and change it', async ({
  accountWithBank,
}) => {
  const { page, accountId, currency } = accountWithBank;

  async function uploadAndPreview(row: Row) {
    await page.goto(`/en/accounts/${accountId}/operations`);
    await page.getByRole('link', { name: en.operations.importLink, exact: true }).click();
    await page.getByTestId('import-file').setInputFiles({
      name: 'bank.ofx',
      mimeType: 'application/x-ofx',
      buffer: ofxFile(currency, row),
    });
    await expect(page.getByTestId('import-preview-section')).toBeVisible();
  }

  await uploadAndPreview({ date: '20260305', amount: '-12.50', name: 'E2E Market' });
  const category = page.getByTestId('import-row-category');
  await expect(category.locator('option:checked')).toHaveText(en.operations.noCategory);
  await category.selectOption({ index: 1 });
  const chosen = (await category.locator('option:checked').textContent()) ?? '';
  await page.getByTestId('import-confirm').click();
  await expect(
    alertWithText(page, '1 operation imported, 0 already recorded, 0 invalid.'),
  ).toBeVisible();

  // Another day, same third party: the category comes back on its own.
  await uploadAndPreview({ date: '20260309', amount: '-8.00', name: 'E2E Market' });
  await expect(category.locator('option:checked')).toHaveText(chosen);
  await expect(page.getByTestId('import-category-suggested')).toBeVisible();

  await category.selectOption({ label: en.operations.noCategory });
  await expect(page.getByTestId('import-category-suggested')).toHaveCount(0);
  await page.getByTestId('import-confirm').click();
  await expect(
    alertWithText(page, '1 operation imported, 0 already recorded, 0 invalid.'),
  ).toBeVisible();
});

test('record a transfer between two of my accounts from the preview', async ({
  accountWithBank,
}) => {
  const { page, accountId, bankId, currency } = accountWithBank;
  const created = await page.request.post('/api/accounts', {
    headers: { 'x-csrf-token': await fetchCsrfToken(page) },
    data: { bankId, name: 'E2E Savings', currency, initialBalance: 0 },
  });
  const savingsId = ((await created.json()) as { account: { id: string } }).account.id;

  await page.goto(`/en/accounts/${accountId}/operations`);
  await page.getByRole('link', { name: en.operations.importLink, exact: true }).click();
  await page.getByTestId('import-file').setInputFiles({
    name: 'bank.ofx',
    mimeType: 'application/x-ofx',
    buffer: ofxFile(currency, {
      date: '20260305',
      amount: '-40.00',
      name: 'E2E Top-up',
      type: 'XFER',
    }),
  });
  await expect(page.getByTestId('import-preview-section')).toBeVisible();

  await page.getByTestId('import-row-payment-method').selectOption(`transfer:${savingsId}`);
  await page.getByTestId('import-confirm').click();
  await expect(
    alertWithText(page, '1 operation imported, 0 already recorded, 0 invalid.'),
  ).toBeVisible();

  await page.goto(`/en/accounts/${savingsId}/operations`);
  await expect(page.getByTestId('operation-row').filter({ hasText: 'E2E Top-up' })).toBeVisible();

  // The next top-up comes with the same account suggested.
  await page.goto(`/en/accounts/${accountId}/operations`);
  await page.getByRole('link', { name: en.operations.importLink, exact: true }).click();
  await page.getByTestId('import-file').setInputFiles({
    name: 'bank.ofx',
    mimeType: 'application/x-ofx',
    buffer: ofxFile(currency, {
      date: '20260405',
      amount: '-40.00',
      name: 'E2E Top-up',
      type: 'XFER',
    }),
  });
  await expect(page.getByTestId('import-preview-section')).toBeVisible();
  await expect(
    page.getByTestId('import-row-payment-method').locator('option:checked'),
  ).toContainText('E2E Savings');
  await expect(page.getByTestId('import-transfer-suggested')).toBeVisible();
});

test('import without reconciling, then reconcile the recorded operations from the next file', async ({
  accountWithBank,
}) => {
  const { page, accountId, currency } = accountWithBank;
  const file = ofxFile(
    currency,
    { date: '20260305', amount: '-12.50', name: 'E2E Bakery', reference: 'E2E-R1' },
    { date: '20260306', amount: '1250.00', name: 'E2E Employer', reference: 'E2E-R2' },
  );

  async function uploadAndPreview() {
    await page.goto(`/en/accounts/${accountId}/operations`);
    await page.getByRole('link', { name: en.operations.importLink, exact: true }).click();
    await page.getByTestId('import-file').setInputFiles({
      name: 'bank.ofx',
      mimeType: 'application/x-ofx',
      buffer: file,
    });
    await expect(page.getByTestId('import-preview-section')).toBeVisible();
  }

  await uploadAndPreview();
  await expect(page.getByTestId('import-reconcile')).toBeChecked();
  await page.getByTestId('import-reconcile').uncheck();
  await page.getByTestId('import-confirm').click();
  await expect(
    alertWithText(page, '2 operations imported, 0 already recorded, 0 invalid.'),
  ).toBeVisible();

  // One switch: the recorded operations the file matches are reconciled too.
  await uploadAndPreview();
  await expect(page.getByTestId('import-reconcile')).toBeChecked();
  await expect(page.getByTestId('import-reconcile-recorded')).toHaveCount(2);
  await expect(page.getByTestId('import-confirm')).toHaveText('Reconcile 2 recorded operations');
  await page.getByTestId('import-confirm').click();
  await expect(alertWithText(page, '2 recorded operations reconciled.')).toBeVisible();

  // Nothing is left to reconcile: the same file now finds them reconciled.
  await uploadAndPreview();
  await expect(page.getByTestId('import-recorded-reconciled').first()).toBeVisible();
  await expect(page.getByTestId('import-reconcile-recorded')).toHaveCount(0);
});
