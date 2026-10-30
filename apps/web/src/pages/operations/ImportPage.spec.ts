import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { queuedToastText } from '../../test-support/queuedToastText';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import type { components } from '../../api/schema';
import { useToast } from '../../composables/useToast';
import { PAYMENT_METHOD_ID } from '../../domain/referenceData';
import type { Account, Bank } from '../accounts/accounts.types';
import ImportPage from './ImportPage.vue';

const apiClient = asMockedApiClient(realApiClient);

const ACCOUNT_ID = '00000000-0000-7000-8000-000000000201';
const IMPORT_ID = '3f2b8d52-6a1e-4c47-9a53-0c1f6a1d9e11';

type Upload = components['schemas']['ImportUploadDto'];
type Preview = components['schemas']['ImportPreviewDto'];

const account: Account = {
  id: ACCOUNT_ID,
  bankId: 'b1',
  name: 'Checking',
  currency: 'EUR',
  closed: false,
  deleted: false,
  balance: 0,
  reconciledBalance: 0,
};
const bank: Bank = { id: 'b1', name: 'Chase', closed: false, deleted: false };
const paymentMethods = [
  { id: PAYMENT_METHOD_ID.CREDIT_CARD, name: 'Credit card', type: 'debit' },
  { id: PAYMENT_METHOD_ID.CHECK_DEBIT, name: 'Check', type: 'debit' },
  { id: PAYMENT_METHOD_ID.TRANSFER_DEBIT, name: 'Transfer', type: 'debit' },
  { id: PAYMENT_METHOD_ID.DEPOSIT, name: 'Deposit', type: 'credit' },
  { id: PAYMENT_METHOD_ID.TRANSFER_CREDIT, name: 'Transfer', type: 'credit' },
  { id: PAYMENT_METHOD_ID.INITIAL_BALANCE, name: 'Initial balance', type: null },
];

const categories = [
  { id: 'cat-food', name: 'Food', type: 'debit', parentId: null },
  { id: 'cat-gift', name: 'Gifts', type: 'debit', parentId: null },
  { id: 'cat-salary', name: 'Salary', type: 'credit', parentId: null },
];

const upload: Upload = { importId: IMPORT_ID, rowCount: 3 };

const statement: Preview['statement'] = {
  periodStart: '2026-03-25',
  periodEnd: '2026-03-26',
  debitTotal: 12.5,
  creditTotal: 1250,
  closing: null,
  accountCheck: 'unknown',
  otherAccountId: null,
};

const REVISION = 'a'.repeat(64);

const preview: Preview = {
  revision: REVISION,
  importCount: 1,
  skippedCount: 1,
  invalidCount: 1,
  statement,
  rows: [
    {
      line: 1,
      status: 'import',
      valueDate: '2026-03-25',
      type: 'debit',
      amount: 12.5,
      thirdParty: 'Boulangerie',
      sourceLabel: null,
      labelOrigin: 'file',
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      paymentMethodOrigin: null,
      categoryId: 'cat-food',
      categoryOrigin: 'history',
      transferAccountId: null,
      transferAccountOrigin: null,
      reason: null,
      recorded: null,
    },
    {
      line: 2,
      status: 'skipped',
      valueDate: '2026-03-26',
      type: 'credit',
      amount: 1250,
      thirdParty: 'Employeur',
      sourceLabel: null,
      labelOrigin: 'file',
      paymentMethodId: PAYMENT_METHOD_ID.DEPOSIT,
      paymentMethodOrigin: null,
      categoryId: null,
      categoryOrigin: null,
      transferAccountId: null,
      transferAccountOrigin: null,
      reason: null,
      recorded: {
        valueDate: '2026-03-26',
        thirdParty: 'employeur',
        matchedBy: 'details',
        reconciled: false,
      },
    },
    {
      line: 3,
      status: 'invalid',
      valueDate: null,
      type: null,
      amount: null,
      thirdParty: null,
      sourceLabel: 'VIR ???',
      labelOrigin: null,
      paymentMethodId: null,
      paymentMethodOrigin: null,
      categoryId: null,
      categoryOrigin: null,
      transferAccountId: null,
      transferAccountOrigin: null,
      reason: 'date_invalid',
      recorded: null,
    },
  ],
};

function createTestRouter(): Router {
  const stub = { template: '<div />' };
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/accounts/:accountId/import', name: 'operations-import', component: stub },
      { path: '/accounts/:accountId/operations', name: 'operations', component: stub },
      { path: '/settings/label-corrections', name: 'settings-label-corrections', component: stub },
    ],
  });
}

function ok(data: unknown) {
  return { data, error: undefined, response: new Response(null, { status: 200 }) };
}

function failure(status: number, error: unknown) {
  return { data: undefined, error, response: new Response(null, { status }) };
}

function mockApi(accounts: Account[] = [account]) {
  apiClient.GET.mockImplementation(async (path: string) => {
    if (path === '/accounts') return ok(accounts);
    if (path === '/banks') return ok([bank]);
    if (path === '/reference-data/payment-methods') return ok(paymentMethods);
    if (path === '/reference-data/categories') return ok(categories);
    return ok(undefined);
  });
  apiClient.POST.mockImplementation(async (path: string) => {
    if (path === '/operations/import') return ok(upload);
    if (path === '/operations/import/{importId}/preview') return ok(preview);
    if (path === '/operations/import/{importId}/confirm') {
      return ok({
        importedCount: 1,
        skippedCount: 1,
        invalidCount: 1,
        rememberedCount: 0,
        notRememberedCount: 0,
        reconciledCount: 0,
        alreadyImported: false,
      });
    }
    return ok(undefined);
  });
}

let router: Router;
let wrapper: VueWrapper | undefined;

async function mountPage() {
  const plugins = withGlobalPlugins(router);
  wrapper = mount(ImportPage, plugins);
  await flushPromises();
  return { wrapper, queryClient: plugins.queryClient };
}

async function chooseFile(page: VueWrapper, file = new File(['<OFX>'], 'bank.ofx')) {
  const input = page.find('[data-testid="import-file"]');
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
  await input.trigger('change');
  await flushPromises();
  return file;
}

describe('ImportPage', () => {
  beforeEach(async () => {
    router = createTestRouter();
    await router.push({ name: 'operations-import', params: { accountId: ACCOUNT_ID } });
    for (const method of [apiClient.GET, apiClient.POST, apiClient.DELETE]) method.mockReset();
    apiClient.DELETE.mockResolvedValue(ok(undefined));
    mockApi();
    useToast().toasts.splice(0);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('introduces the import until a file is read, then keeps the reassurance next to the confirmation', async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.find('[data-testid="import-intro"]').text()).toBe(
      'Load the operations of an OFX file exported from your bank. Nothing is saved until you confirm.',
    );
    expect(wrapper.find('[data-testid="import-not-saved"]').exists()).toBe(false);

    await chooseFile(wrapper);

    expect(wrapper.find('[data-testid="import-intro"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="import-not-saved"]').text()).toBe(
      'Nothing is saved until you confirm.',
    );
  });

  it('offers only the file choice before a file is uploaded', async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.find('[data-testid="import-file"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="import-preview-section"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Chase — Checking');
  });

  it('refuses a closed account instead of offering the upload', async () => {
    mockApi([{ ...account, closed: true }]);
    const { wrapper } = await mountPage();
    expect(wrapper.find('[data-testid="import-inactive"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="import-file"]').exists()).toBe(false);
  });

  describe('upload', () => {
    it('sends the account and the file as a multipart form', async () => {
      const { wrapper } = await mountPage();
      const file = await chooseFile(wrapper);

      const [path, options] = apiClient.POST.mock.calls[0] as [
        string,
        { body: { accountId: string }; bodySerializer: (body: unknown) => FormData },
      ];
      expect(path).toBe('/operations/import');
      const formData = options.bodySerializer(options.body);
      expect(formData.get('accountId')).toBe(ACCOUNT_ID);
      expect((formData.get('file') as File).name).toBe(file.name);
    });

    it('refuses a file over 5 MB without sending it', async () => {
      const { wrapper } = await mountPage();
      const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.ofx');
      await chooseFile(wrapper, big);
      expect(apiClient.POST).not.toHaveBeenCalled();
      expect(queuedToastText()).toContain('5 MB');
    });

    it('shows the API error and stays on the file step when the file is refused', async () => {
      apiClient.POST.mockResolvedValueOnce(
        failure(400, { category: 'business_rule', code: 'import_file_invalid', message: 'x' }),
      );
      const { wrapper } = await mountPage();
      await chooseFile(wrapper);
      expect(queuedToastText()).toContain('cannot be imported');
      expect(wrapper.find('[data-testid="import-preview-section"]').exists()).toBe(false);
    });

    it('previews at once', async () => {
      const { wrapper } = await mountPage();
      await chooseFile(wrapper);

      expect(wrapper.find('[data-testid="import-preview-section"]').exists()).toBe(true);
    });
  });

  describe('preview', () => {
    it('shows the three counts and the rows', async () => {
      const { wrapper } = await mountPage();
      await chooseFile(wrapper);

      expect(apiClient.POST).toHaveBeenLastCalledWith('/operations/import/{importId}/preview', {
        params: { path: { importId: IMPORT_ID } },
        body: {
          labelChanges: [],
          paymentMethodChanges: [],
          categoryChanges: [],
          transferAccountChanges: [],
        },
      });
      const counts = (name: string) => wrapper.find(`[data-testid="import-filter-${name}"]`).text();
      expect(counts('all')).toBe('All rows 3');
      expect(counts('import')).toBe('To import 1');
      expect(counts('skipped')).toBe('Already recorded 1');
      expect(counts('invalid')).toBe('Invalid 1');
      expect(wrapper.find('[data-testid="import-row-import"]').text()).toContain('-€12.50');
      expect(wrapper.find('[data-testid="import-row-skipped"]').text()).toContain('+€1,250.00');
      expect(wrapper.find('[data-testid="import-row-invalid"]').text()).toContain(
        'The date is not a valid day.',
      );
      // Only credits are tinted; the invalid row's reason stays red as an error.
      const amountCell = (status: string) =>
        wrapper.get(`[data-testid="import-row-${status}"] td.import-amount-cell`).classes();
      expect(amountCell('import')).not.toContain('text-danger');
      expect(amountCell('import')).not.toContain('text-success');
      expect(amountCell('skipped')).toContain('text-success');
      expect(wrapper.find('[data-testid="import-row-invalid"] .text-danger').exists()).toBe(true);
    });

    it('filters the rows by status', async () => {
      const { wrapper } = await mountPage();
      await chooseFile(wrapper);

      await wrapper.find('[data-testid="import-filter-invalid"]').trigger('click');
      expect(wrapper.findAll('[data-testid="import-rows"] tbody tr')).toHaveLength(1);
      expect(wrapper.find('[data-testid="import-row-invalid"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="import-filter-invalid"]').attributes('aria-pressed')).toBe(
        'true',
      );
    });

    it('returns to the file step when the held file has expired', async () => {
      apiClient.POST.mockImplementation(async (path: string) =>
        path === '/operations/import'
          ? ok(upload)
          : failure(404, { category: 'not_found', code: 'import_not_found', message: 'x' }),
      );
      const { wrapper } = await mountPage();
      await chooseFile(wrapper);

      expect(queuedToastText()).toContain('no longer available');
      expect(wrapper.find('[data-testid="import-preview-section"]').exists()).toBe(false);
    });
  });

  describe('confirmation', () => {
    it('counts only the rows that would be imported', async () => {
      const { wrapper } = await mountPage();
      await chooseFile(wrapper);
      const confirm = wrapper.find('[data-testid="import-confirm"]');
      expect(confirm.text()).toBe('Import 1 operation');

      await wrapper.find('[data-testid="import-include"]').setValue(true);
      expect(confirm.text()).toBe('Import 2 operations');
    });

    it('is disabled with a notice when nothing would be imported', async () => {
      apiClient.POST.mockImplementation(async (path: string) =>
        path === '/operations/import'
          ? ok(upload)
          : ok({
              ...preview,
              importCount: 0,
              rows: [
                {
                  ...preview.rows[1],
                  recorded: { ...preview.rows[1].recorded!, reconciled: true },
                },
                preview.rows[2],
              ],
            }),
      );
      const { wrapper } = await mountPage();
      await chooseFile(wrapper);

      expect(wrapper.find('[data-testid="import-confirm"]').attributes('disabled')).toBeDefined();
      expect(wrapper.find('[data-testid="import-nothing"]').exists()).toBe(true);
    });

    it('sends the included skipped lines, then refreshes the account and goes back to its operations', async () => {
      const { wrapper, queryClient } = await mountPage();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      await chooseFile(wrapper);
      await wrapper.find('[data-testid="import-include"]').setValue(true);
      await wrapper.find('[data-testid="import-confirm"]').trigger('click');
      await flushPromises();

      const [path, options] = apiClient.POST.mock.calls.at(-1) as [string, { body: object }];
      expect(path).toBe('/operations/import/{importId}/confirm');
      expect(options.body).toMatchObject({
        revision: REVISION,
        includedLines: [2],
        labelChanges: [],
        paymentMethodChanges: [],
      });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.operations.all(ACCOUNT_ID) });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.accounts });
      expect(queuedToastText()).toContain('1 operation imported, 1 already recorded, 1 invalid.');
      expect(router.currentRoute.value.name).toBe('operations');
    });

    it('says the counts, then each extra, in one message', async () => {
      const result = {
        importedCount: 3,
        skippedCount: 0,
        invalidCount: 0,
        rememberedCount: 2,
        notRememberedCount: 0,
        reconciledCount: 1,
        alreadyImported: false,
      };
      apiClient.POST.mockImplementation(async (path: string) => {
        if (path === '/operations/import') return ok(upload);
        if (path === '/operations/import/{importId}/confirm') return ok(result);
        return ok(preview);
      });
      const { wrapper } = await mountPage();
      await chooseFile(wrapper);
      await wrapper.find('[data-testid="import-confirm"]').trigger('click');
      await flushPromises();

      expect(queuedToastText()).toBe(
        '3 operations imported, 0 already recorded, 0 invalid. 1 recorded operation reconciled. 2 label corrections remembered.',
      );
    });

    it('sends the confirmation once when it is asked for twice before the answer', async () => {
      const { wrapper } = await mountPage();
      await chooseFile(wrapper);
      const page = wrapper.vm as unknown as { confirmImport: () => Promise<void> };

      await Promise.all([page.confirmImport(), page.confirmImport()]);

      const confirmations = apiClient.POST.mock.calls.filter(
        ([path]) => path === '/operations/import/{importId}/confirm',
      );
      expect(confirmations).toHaveLength(1);
    });

    it('refreshes the other account of a transfer imported, suggested or not, and not one left behind', async () => {
      const savings: Account = { ...account, id: 'a2', name: 'Savings' };
      const other: Account = { ...account, id: 'a3', name: 'Other' };
      const transferRow = (line: number, status: 'import' | 'skipped', accountId: string) => ({
        ...preview.rows[0],
        line,
        status,
        paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
        transferAccountId: accountId,
        transferAccountOrigin: 'history' as const,
      });
      const withTransfers = {
        ...preview,
        rows: [transferRow(1, 'import', savings.id), transferRow(2, 'skipped', other.id)],
      };
      mockApi([account, savings, other]);
      const post = apiClient.POST.getMockImplementation()!;
      apiClient.POST.mockImplementation(async (path: string, options: unknown) =>
        path.endsWith('/preview') ? ok(withTransfers) : post(path, options),
      );
      const { wrapper, queryClient } = await mountPage();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      await chooseFile(wrapper);
      await wrapper.find('[data-testid="import-confirm"]').trigger('click');
      await flushPromises();

      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.operations.all(savings.id) });
      expect(invalidate).not.toHaveBeenCalledWith({ queryKey: queryKeys.operations.all(other.id) });
    });

    describe.each([
      [0, false],
      [2, true],
    ])('when the import remembered %i label corrections', (rememberedCount, refreshed) => {
      it(`${refreshed ? 'refreshes' : 'leaves alone'} the list of label corrections`, async () => {
        const post = apiClient.POST.getMockImplementation()!;
        apiClient.POST.mockImplementation(async (path: string, options: unknown) =>
          path.endsWith('/confirm')
            ? ok({
                importedCount: 1,
                skippedCount: 0,
                invalidCount: 0,
                rememberedCount,
                notRememberedCount: 0,
                reconciledCount: 0,
                alreadyImported: false,
              })
            : post(path, options),
        );
        const { wrapper, queryClient } = await mountPage();
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
        await chooseFile(wrapper);
        await wrapper.find('[data-testid="import-confirm"]').trigger('click');
        await flushPromises();

        const call = { queryKey: queryKeys.labelCorrections };
        if (refreshed) expect(invalidate).toHaveBeenCalledWith(call);
        else expect(invalidate).not.toHaveBeenCalledWith(call);
      });
    });

    it('shows the preview again, and imports nothing, when the operations behind it changed', async () => {
      const refreshed = { ...preview, revision: 'b'.repeat(64) };
      let confirms = 0;
      apiClient.POST.mockImplementation(async (path: string) => {
        if (path === '/operations/import') return ok(upload);
        if (path.endsWith('/preview')) return ok(confirms === 0 ? preview : refreshed);
        confirms += 1;
        return failure(409, { code: 'import_preview_stale', message: 'stale' });
      });
      const { wrapper } = await mountPage();
      await chooseFile(wrapper);
      await wrapper.find('[data-testid="import-confirm"]').trigger('click');
      await flushPromises();

      expect(queuedToastText()).toContain('Your operations changed since this preview was shown');
      expect(router.currentRoute.value.name).toBe('operations-import');
      await wrapper.find('[data-testid="import-confirm"]').trigger('click');
      await flushPromises();
      const sent = apiClient.POST.mock.calls
        .filter(([path]) => String(path).endsWith('/confirm'))
        .map(([, options]) => (options as { body: object }).body);
      expect(sent).toMatchObject([{ revision: REVISION }, { revision: 'b'.repeat(64) }]);
    });

    it('shows the error and stays when the import is refused', async () => {
      apiClient.POST.mockImplementation(async (path: string) => {
        if (path === '/operations/import') return ok(upload);
        if (path.endsWith('/preview')) return ok(preview);
        return failure(422, {
          category: 'business_rule',
          code: 'account_not_active',
          message: 'x',
        });
      });
      const { wrapper } = await mountPage();
      await chooseFile(wrapper);
      await wrapper.find('[data-testid="import-confirm"]').trigger('click');
      await flushPromises();

      expect(queuedToastText()).toContain('This account is not active.');
      expect(router.currentRoute.value.name).toBe('operations-import');
    });
  });

  describe('label changes', () => {
    const correctedRow = {
      ...preview.rows[0],
      thirdParty: 'Bakery',
      sourceLabel: 'CB*1234 BOULANGERIE',
      labelOrigin: 'correction' as const,
    };
    const changedRow = { ...correctedRow, labelOrigin: 'change' as const };
    const withRows = (rows: Preview['rows']): Preview => ({ ...preview, rows });

    const previewCalls = () =>
      apiClient.POST.mock.calls.filter(([path]) => String(path).endsWith('/preview'));
    const lastBody = (suffix: string) =>
      (
        apiClient.POST.mock.calls.filter(([path]) => String(path).endsWith(suffix)).at(-1) as [
          string,
          { body: Record<string, unknown> },
        ]
      )[1].body;

    // Previews answer with the first row as the Member left it.
    function previewAnswers(...answers: Preview[]) {
      const queue = [...answers];
      apiClient.POST.mockImplementation(async (path: string) => {
        if (path === '/operations/import') return ok(upload);
        if (path.endsWith('/preview')) return ok(queue.length > 1 ? queue.shift() : queue[0]);
        return ok({
          importedCount: 2,
          skippedCount: 0,
          invalidCount: 0,
          rememberedCount: 1,
          alreadyImported: false,
        });
      });
    }

    async function startPreview() {
      const { wrapper } = await mountPage();
      await chooseFile(wrapper);
      return wrapper;
    }

    async function editFirstRow(wrapper: VueWrapper, text: string, remember = true) {
      await wrapper
        .find('[data-testid="import-row-import"] [data-testid="import-change-label"]')
        .trigger('click');
      await wrapper.find('[data-testid="import-label-input"]').setValue(text);
      await wrapper.find('[data-testid="import-label-remember"]').setValue(remember);
      await wrapper.find('[data-testid="import-label-apply"]').trigger('submit');
      await flushPromises();
    }

    it('shows where a label comes from, with the label of the file', async () => {
      previewAnswers(withRows([correctedRow, preview.rows[1], preview.rows[2]]));
      const wrapper = await startPreview();

      const row = wrapper.find('[data-testid="import-row-import"]');
      expect(row.find('[data-testid="import-third-party"]').text()).toBe('Bakery');
      expect(row.find('[data-testid="import-label-origin"]').text()).toBe('Remembered correction');
      expect(row.find('[data-testid="import-source-label"]').text()).toContain(
        'CB*1234 BOULANGERIE',
      );
      const source = row.find('[data-testid="import-source-label"]');
      expect(source.classes()).toContain('text-truncate');
      expect(source.attributes('title')).toBe('CB*1234 BOULANGERIE');
    });

    it('offers the label change as a small icon button beside the name', async () => {
      previewAnswers(preview);
      const wrapper = await startPreview();

      const button = wrapper.find(
        '[data-testid="import-row-import"] [data-testid="import-change-label"]',
      );
      expect(button.find('svg').exists()).toBe(true);
      expect(button.text()).toBe('');
      expect(button.attributes('title')).toBe('Edit');
      expect(button.attributes('aria-label')).toBe('Change third party of row 1');
    });

    it('shows no origin for a label taken as the file gives it', async () => {
      const wrapper = await startPreview();
      expect(wrapper.find('[data-testid="import-label-origin"]').exists()).toBe(false);
      expect(
        wrapper
          .find('[data-testid="import-row-import"] [data-testid="import-source-label"]')
          .exists(),
      ).toBe(false);
    });

    it('applies a change at once, and blocks the confirmation until the new preview is read', async () => {
      let answer: (value: unknown) => void = () => {};
      apiClient.POST.mockImplementation(async (path: string) => {
        if (path === '/operations/import') return ok(upload);
        if (path.endsWith('/preview') && previewCalls().length > 1) {
          return new Promise((resolve) => {
            answer = resolve;
          });
        }
        return ok(preview);
      });
      const wrapper = await startPreview();

      await wrapper
        .find('[data-testid="import-row-import"] [data-testid="import-change-label"]')
        .trigger('click');
      await wrapper.find('[data-testid="import-label-input"]').setValue('Bakery');
      await wrapper.find('[data-testid="import-label-apply"]').trigger('submit');
      await flushPromises();

      expect(previewCalls()).toHaveLength(2);
      expect(lastBody('/preview').labelChanges).toEqual([
        { line: 1, thirdParty: 'Bakery', remember: true },
      ]);
      expect(wrapper.find('[data-testid="import-busy"]').exists()).toBe(true);
      expect(wrapper.find('.table-responsive').attributes('aria-busy')).toBe('true');
      expect(wrapper.find('[data-testid="import-confirm"]').attributes('disabled')).toBeDefined();

      answer(ok(withRows([changedRow, preview.rows[1], preview.rows[2]])));
      await flushPromises();

      expect(wrapper.find('[data-testid="import-busy"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="import-pending-labels"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="import-confirm"]').attributes('disabled')).toBeUndefined();
    });

    it('offers to try again when the change could not be applied', async () => {
      let failing = false;
      apiClient.POST.mockImplementation(async (path: string) => {
        if (path === '/operations/import') return ok(upload);
        if (path.endsWith('/preview')) {
          return failing
            ? failure(500, { category: 'internal', code: 'x', message: 'x' })
            : ok(preview);
        }
        return ok(undefined);
      });
      const wrapper = await startPreview();
      failing = true;
      await editFirstRow(wrapper, 'Bakery');

      expect(wrapper.find('[data-testid="import-pending-labels"]').text()).toContain(
        '1 label change could not be applied',
      );
      expect(wrapper.find('[data-testid="import-confirm"]').attributes('disabled')).toBeDefined();

      failing = false;
      await wrapper.find('[data-testid="import-apply-labels"]').trigger('click');
      await flushPromises();

      expect(wrapper.find('[data-testid="import-pending-labels"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="import-confirm"]').attributes('disabled')).toBeUndefined();
    });

    it('keeps only the answer of the latest preview', async () => {
      const answers: ((value: unknown) => void)[] = [];
      apiClient.POST.mockImplementation(async (path: string) => {
        if (path === '/operations/import') return ok(upload);
        if (path.endsWith('/preview') && previewCalls().length > 1) {
          return new Promise((resolve) => answers.push(resolve));
        }
        return ok(preview);
      });
      const wrapper = await startPreview();
      await editFirstRow(wrapper, 'First');
      await wrapper
        .find('[data-testid="import-row-import"] [data-testid="import-change-label"]')
        .trigger('click');
      await wrapper.find('[data-testid="import-label-input"]').setValue('Second');
      await wrapper.find('[data-testid="import-label-apply"]').trigger('submit');
      await flushPromises();
      expect(answers).toHaveLength(2);

      answers[1](
        ok(withRows([{ ...changedRow, thirdParty: 'Second' }, preview.rows[1], preview.rows[2]])),
      );
      await flushPromises();
      answers[0](
        ok(withRows([{ ...changedRow, thirdParty: 'First' }, preview.rows[1], preview.rows[2]])),
      );
      await flushPromises();

      expect(wrapper.find('[data-testid="import-third-party"]').text()).toBe('Second');
      expect(wrapper.find('[data-testid="import-busy"]').exists()).toBe(false);
    });

    it('re-runs the preview with the changes and the remember choice, then lets the Member confirm', async () => {
      previewAnswers(preview, withRows([changedRow, preview.rows[1], preview.rows[2]]));
      const wrapper = await startPreview();
      await editFirstRow(wrapper, 'Bakery', false);

      expect(lastBody('/preview').labelChanges).toEqual([
        { line: 1, thirdParty: 'Bakery', remember: false },
      ]);
      expect(wrapper.find('[data-testid="import-pending-labels"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="import-label-origin"]').text()).toBe('Changed');
      expect(wrapper.find('[data-testid="import-confirm"]').attributes('disabled')).toBeUndefined();
    });

    it('sends the changes with the confirmation, and tells how many were remembered', async () => {
      previewAnswers(preview, withRows([changedRow, preview.rows[1], preview.rows[2]]));
      const wrapper = await startPreview();
      await editFirstRow(wrapper, 'Bakery');

      await wrapper.find('[data-testid="import-confirm"]').trigger('click');
      await flushPromises();

      expect(lastBody('/confirm').labelChanges).toEqual([
        { line: 1, thirdParty: 'Bakery', remember: true },
      ]);
      expect(queuedToastText()).toContain('1 label correction remembered.');
    });

    it('keeps the skipped rows the Member included while applying changes', async () => {
      previewAnswers(preview, withRows([changedRow, preview.rows[1], preview.rows[2]]));
      const wrapper = await startPreview();
      await wrapper.find('[data-testid="import-include"]').setValue(true);
      await editFirstRow(wrapper, 'Bakery');

      expect(wrapper.find('[data-testid="import-confirm"]').text()).toBe('Import 2 operations');
    });

    it('forgets an included row that is no longer skipped after the changes', async () => {
      previewAnswers(
        preview,
        withRows([changedRow, { ...preview.rows[1], status: 'import' }, preview.rows[2]]),
      );
      const wrapper = await startPreview();
      await wrapper.find('[data-testid="import-include"]').setValue(true);
      await editFirstRow(wrapper, 'Bakery');

      await wrapper.find('[data-testid="import-confirm"]').trigger('click');
      await flushPromises();

      expect(lastBody('/confirm').includedLines).toEqual([]);
    });

    it('lets the Member pick another payment method for a row, among those of its type', async () => {
      previewAnswers(preview);
      const wrapper = await startPreview();
      const select = wrapper.find(
        '[data-testid="import-row-import"] [data-testid="import-row-payment-method"]',
      );

      expect(select.findAll('option').map((option) => option.text())).toEqual([
        'Credit card',
        'Check',
        'Transfer to outside',
      ]);
      await select.setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);

      expect((select.element as HTMLSelectElement).value).toBe(PAYMENT_METHOD_ID.CHECK_DEBIT);
      expect(previewCalls()).toHaveLength(1);
    });

    it('sends the picked payment methods with the confirmation', async () => {
      previewAnswers(preview);
      const wrapper = await startPreview();
      await wrapper
        .find('[data-testid="import-row-import"] [data-testid="import-row-payment-method"]')
        .setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);

      await wrapper.find('[data-testid="import-confirm"]').trigger('click');
      await flushPromises();

      expect(lastBody('/confirm')).toMatchObject({
        paymentMethodChanges: [{ line: 1, paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT }],
      });
    });

    it('keeps the picked payment methods when changed labels are applied', async () => {
      previewAnswers(preview);
      const wrapper = await startPreview();
      await wrapper
        .find('[data-testid="import-row-import"] [data-testid="import-row-payment-method"]')
        .setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
      await editFirstRow(wrapper, 'Bakery');

      expect(lastBody('/preview')).toEqual({
        labelChanges: [{ line: 1, thirdParty: 'Bakery', remember: true }],
        paymentMethodChanges: [{ line: 1, paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT }],
        categoryChanges: [],
        transferAccountChanges: [],
      });
    });

    it('shows the suggested category of a row, among those of its type', async () => {
      previewAnswers(preview);
      const wrapper = await startPreview();
      const select = wrapper.find(
        '[data-testid="import-row-import"] [data-testid="import-row-category"]',
      );

      expect((select.element as HTMLSelectElement).value).toBe('cat-food');
      expect(select.findAll('option').map((option) => option.text())).toEqual([
        'No category',
        'Food',
        'Gifts',
      ]);
      expect(
        wrapper
          .find('[data-testid="import-row-import"] [data-testid="import-category-suggested"]')
          .exists(),
      ).toBe(true);
      expect(
        wrapper
          .find('[data-testid="import-row-skipped"] [data-testid="import-row-category"]')
          .findAll('option')
          .map((option) => option.text()),
      ).toEqual(['No category', 'Salary']);
    });

    it('sends the picked and the removed categories with the confirmation', async () => {
      previewAnswers(preview);
      const wrapper = await startPreview();
      const first = wrapper.find(
        '[data-testid="import-row-import"] [data-testid="import-row-category"]',
      );
      await first.setValue('cat-gift');
      expect(
        wrapper
          .find('[data-testid="import-row-import"] [data-testid="import-category-suggested"]')
          .exists(),
      ).toBe(false);
      await wrapper
        .find('[data-testid="import-row-skipped"] [data-testid="import-row-category"]')
        .setValue('cat-salary');
      await wrapper
        .find('[data-testid="import-row-skipped"] [data-testid="import-row-category"]')
        .setValue('');

      await wrapper.find('[data-testid="import-confirm"]').trigger('click');
      await flushPromises();

      expect(lastBody('/confirm')).toMatchObject({
        categoryChanges: [
          { line: 1, categoryId: 'cat-gift' },
          { line: 2, categoryId: null },
        ],
      });
    });

    it('keeps the picked categories when changed labels are applied', async () => {
      previewAnswers(preview);
      const wrapper = await startPreview();
      await wrapper
        .find('[data-testid="import-row-import"] [data-testid="import-row-category"]')
        .setValue('');
      await editFirstRow(wrapper, 'Bakery');

      expect(lastBody('/preview')).toMatchObject({
        categoryChanges: [{ line: 1, categoryId: null }],
      });
    });

    it('offers a category on a skipped row but not on an invalid one', async () => {
      previewAnswers(preview);
      const wrapper = await startPreview();
      expect(
        wrapper
          .find('[data-testid="import-row-invalid"] [data-testid="import-row-category"]')
          .exists(),
      ).toBe(false);
    });

    describe('transfers, chosen with their account in the one list', () => {
      const savings: Account = { ...account, id: 'a2', name: 'Savings' };
      const closed: Account = { ...account, id: 'a3', name: 'Old', closed: true };
      const dollars: Account = { ...account, id: 'a4', name: 'Dollars', currency: 'USD' };
      const transferPreview: Preview = {
        ...preview,
        rows: [
          {
            ...preview.rows[0],
            paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
            categoryId: null,
            categoryOrigin: null,
          },
          { ...preview.rows[1], paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_CREDIT },
          preview.rows[2],
        ],
      };
      const methodSelect = (wrapper: VueWrapper, status: string) =>
        wrapper.find(
          `[data-testid="import-row-${status}"] [data-testid="import-row-payment-method"]`,
        );
      const valueOf = (select: ReturnType<typeof methodSelect>) =>
        (select.element as HTMLSelectElement).value;
      const previews = () =>
        apiClient.POST.mock.calls.filter(([path]) => String(path).endsWith('/preview')).length;

      async function startTransferPreview(answer: Preview = transferPreview) {
        mockApi([account, savings, closed, dollars]);
        previewAnswers(answer);
        return startPreview();
      }

      it('offers the other active accounts of the same currency, in a group of their own', async () => {
        const wrapper = await startTransferPreview();
        const select = methodSelect(wrapper, 'import');

        expect(select.find('optgroup').attributes('label')).toBe('Transfers');
        expect(select.findAll('option').map((option) => option.text())).toEqual([
          'Credit card',
          'Check',
          expect.stringContaining('Transfer to'),
          'Transfer to outside',
        ]);
        expect(select.findAll('optgroup option')[0].text()).toContain('Savings');
        expect(
          methodSelect(wrapper, 'skipped')
            .findAll('optgroup option')
            .map((option) => option.text()),
        ).toEqual([expect.stringMatching(/^Transfer from .*Savings/), 'Transfer from outside']);
      });

      it('sorts the accounts by bank name, then by account name', async () => {
        const banks = [
          bank,
          { ...bank, id: 'b2', name: 'Alpha Bank' },
          { ...bank, id: 'b3', name: 'zeta bank' },
        ];
        const accounts: Account[] = [
          account,
          { ...account, id: 'a5', bankId: 'b3', name: 'Main' },
          { ...account, id: 'a6', bankId: 'b1', name: 'Savings' },
          { ...account, id: 'a7', bankId: 'b2', name: 'Zoo' },
          { ...account, id: 'a8', bankId: 'b2', name: 'Avenue' },
          { ...account, id: 'a9', bankId: 'b1', name: 'Account 10' },
          { ...account, id: 'a10', bankId: 'b1', name: 'Account 2' },
        ];
        mockApi(accounts);
        apiClient.GET.mockImplementation(async (path: string) => {
          if (path === '/accounts') return ok(accounts);
          if (path === '/banks') return ok(banks);
          if (path === '/reference-data/payment-methods') return ok(paymentMethods);
          if (path === '/reference-data/categories') return ok(categories);
          return ok(undefined);
        });
        previewAnswers(transferPreview);
        const wrapper = await startPreview();

        const options = methodSelect(wrapper, 'import')
          .findAll('optgroup option')
          .map((option) => option.text());

        expect(options).toEqual([
          expect.stringContaining('Alpha Bank — Avenue'),
          expect.stringContaining('Alpha Bank — Zoo'),
          expect.stringContaining('Chase — Account 2'),
          expect.stringContaining('Chase — Account 10'),
          expect.stringContaining('Chase — Savings'),
          expect.stringContaining('zeta bank — Main'),
          'Transfer to outside',
        ]);
      });

      it('shows a transfer without a known account as going outside', async () => {
        const wrapper = await startTransferPreview();
        expect(valueOf(methodSelect(wrapper, 'import'))).toBe('transfer:external');
      });

      it('shows no second list', async () => {
        const wrapper = await startTransferPreview();
        expect(wrapper.findAll('[data-testid="import-row-transfer-account"]')).toHaveLength(0);
      });

      it('sends a transfer with its account, and the outside choice, with the confirmation', async () => {
        const wrapper = await startTransferPreview();
        await methodSelect(wrapper, 'import').setValue('transfer:a2');
        await methodSelect(wrapper, 'skipped').setValue('transfer:a2');
        await methodSelect(wrapper, 'skipped').setValue('transfer:external');

        await wrapper.find('[data-testid="import-confirm"]').trigger('click');
        await flushPromises();

        expect(lastBody('/confirm')).toMatchObject({
          paymentMethodChanges: [
            { line: 1, paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT },
            { line: 2, paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_CREDIT },
          ],
          transferAccountChanges: [
            { line: 1, accountId: 'a2' },
            { line: 2, accountId: null },
          ],
        });
      });

      it('shows the suggested account of a transfer row until another is picked', async () => {
        const suggested: Preview = {
          ...transferPreview,
          rows: [
            {
              ...transferPreview.rows[0],
              transferAccountId: 'a2',
              transferAccountOrigin: 'history',
            },
            ...transferPreview.rows.slice(1),
          ],
        };
        const wrapper = await startTransferPreview(suggested);
        const select = methodSelect(wrapper, 'import');
        const note = () =>
          wrapper.find(
            '[data-testid="import-row-import"] [data-testid="import-transfer-suggested"]',
          );

        expect(valueOf(select)).toBe('transfer:a2');
        expect(note().exists()).toBe(true);
        await select.setValue('transfer:external');
        expect(note().exists()).toBe(false);
      });

      it('becomes a transfer in one pick, and reads the preview again as a transfer is matched', async () => {
        const wrapper = await startTransferPreview(preview);
        expect(previews()).toBe(1);

        await methodSelect(wrapper, 'import').setValue('transfer:a2');
        await flushPromises();

        expect(previews()).toBe(2);
        expect(lastBody('/preview')).toMatchObject({
          paymentMethodChanges: [{ line: 1, paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT }],
        });
        expect(valueOf(methodSelect(wrapper, 'import'))).toBe('transfer:a2');
        await wrapper.find('[data-testid="import-confirm"]').trigger('click');
        await flushPromises();
        expect(lastBody('/confirm')).toMatchObject({
          paymentMethodChanges: [{ line: 1, paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT }],
          transferAccountChanges: [{ line: 1, accountId: 'a2' }],
        });
      });

      it('reads the preview again when a transfer row stops being one', async () => {
        const wrapper = await startTransferPreview();
        expect(previews()).toBe(1);

        await methodSelect(wrapper, 'import').setValue(PAYMENT_METHOD_ID.CREDIT_CARD);
        await flushPromises();

        expect(previews()).toBe(2);
        expect(lastBody('/preview')).toMatchObject({
          paymentMethodChanges: [{ line: 1, paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD }],
        });
      });

      it('does not read the preview again when only the account of a transfer changes', async () => {
        const wrapper = await startTransferPreview(preview);

        await methodSelect(wrapper, 'import').setValue('transfer:a2');
        await flushPromises();
        expect(previews()).toBe(2);
        await methodSelect(wrapper, 'import').setValue('transfer:external');
        await flushPromises();

        expect(previews()).toBe(2);
      });

      it('drops the account when the row stops being a transfer', async () => {
        const wrapper = await startTransferPreview();
        await methodSelect(wrapper, 'import').setValue('transfer:a2');

        await methodSelect(wrapper, 'import').setValue(PAYMENT_METHOD_ID.CREDIT_CARD);
        await wrapper.find('[data-testid="import-confirm"]').trigger('click');
        await flushPromises();

        expect(lastBody('/confirm')).toMatchObject({ transferAccountChanges: [] });
        expect(valueOf(methodSelect(wrapper, 'import'))).toBe(PAYMENT_METHOD_ID.CREDIT_CARD);
      });

      it('marks a payment method taken from history when no account goes with it', async () => {
        const wrapper = await startTransferPreview({
          ...transferPreview,
          rows: [
            { ...transferPreview.rows[0], paymentMethodOrigin: 'history' },
            ...transferPreview.rows.slice(1),
          ],
        });
        expect(
          wrapper
            .find('[data-testid="import-row-import"] [data-testid="import-method-suggested"]')
            .exists(),
        ).toBe(true);
      });
    });

    it('offers a payment method on a skipped row but not on an invalid one', async () => {
      previewAnswers(preview);
      const wrapper = await startPreview();

      expect(
        wrapper
          .find('[data-testid="import-row-skipped"] [data-testid="import-row-payment-method"]')
          .findAll('option')
          .map((option) => option.text()),
      ).toEqual(['Deposit', 'Transfer from outside']);
      expect(
        wrapper
          .find('[data-testid="import-row-invalid"] [data-testid="import-row-payment-method"]')
          .exists(),
      ).toBe(false);
    });

    it('leaves nothing pending when the edit is cancelled or changes nothing', async () => {
      previewAnswers(preview);
      const wrapper = await startPreview();

      await wrapper
        .find('[data-testid="import-row-import"] [data-testid="import-change-label"]')
        .trigger('click');
      await wrapper.find('[data-testid="import-label-input"]').setValue('Other');
      await wrapper.find('[data-testid="import-label-cancel"]').trigger('click');
      expect(previewCalls()).toHaveLength(1);

      await editFirstRow(wrapper, 'Boulangerie');
      expect(previewCalls()).toHaveLength(1);
    });

    it('closes the editor of an invalid row without changing it', async () => {
      previewAnswers(
        withRows([{ ...preview.rows[2], reason: 'third_party_missing', sourceLabel: '' }]),
      );
      const wrapper = await startPreview();

      await wrapper.find('[data-testid="import-change-label"]').trigger('click');
      expect(wrapper.find('[data-testid="import-label-input"]').exists()).toBe(true);
      await wrapper.find('[data-testid="import-label-cancel"]').trigger('click');

      expect(wrapper.find('[data-testid="import-label-input"]').exists()).toBe(false);
      expect(previewCalls()).toHaveLength(1);
    });

    it('sends several label changes in the order of the lines', async () => {
      previewAnswers(
        withRows([
          preview.rows[0],
          { ...preview.rows[2], line: 5, reason: 'third_party_missing', sourceLabel: '' },
        ]),
      );
      const wrapper = await startPreview();

      await wrapper
        .find('[data-testid="import-row-invalid"] [data-testid="import-change-label"]')
        .trigger('click');
      await wrapper.find('[data-testid="import-label-input"]').setValue('Butcher');
      await wrapper.find('[data-testid="import-label-apply"]').trigger('submit');
      await flushPromises();
      await editFirstRow(wrapper, 'Bakery');

      expect(lastBody('/preview').labelChanges).toEqual([
        { line: 1, thirdParty: 'Bakery', remember: true },
        { line: 5, thirdParty: 'Butcher', remember: true },
      ]);
    });

    it('shows the rows fifty at a time', async () => {
      previewAnswers(
        withRows(
          Array.from({ length: 51 }, (_, index) => ({
            ...preview.rows[0],
            line: index + 1,
            thirdParty: `Shop ${index + 1}`,
          })),
        ),
      );
      const wrapper = await startPreview();
      expect(wrapper.findAll('[data-testid="import-row-import"]')).toHaveLength(50);

      await wrapper.find('nav.pager button:last-of-type').trigger('click');

      expect(wrapper.findAll('[data-testid="import-row-import"]')).toHaveLength(1);
    });

    it('offers to fix a missing or too long third party, but not other invalid rows', async () => {
      previewAnswers(
        withRows([
          preview.rows[0],
          { ...preview.rows[2], line: 2, reason: 'third_party_missing', sourceLabel: '' },
          {
            ...preview.rows[2],
            line: 3,
            reason: 'third_party_too_long',
            sourceLabel: 'x'.repeat(50),
          },
          preview.rows[2],
        ]),
      );
      const wrapper = await startPreview();

      const invalid = wrapper.findAll('[data-testid="import-row-invalid"]');
      expect(
        invalid.map((row) => row.find('[data-testid="import-change-label"]').exists()),
      ).toEqual([true, true, false]);
      expect(invalid[2].find('[data-testid="import-source-label"]').text()).toContain('VIR ???');
    });

    it('lets a Member fix an invalid row with a typed label', async () => {
      previewAnswers(
        withRows([{ ...preview.rows[2], reason: 'third_party_missing', sourceLabel: '' }]),
      );
      const wrapper = await startPreview();

      await wrapper.find('[data-testid="import-change-label"]').trigger('click');
      await wrapper.find('[data-testid="import-label-input"]').setValue('Butcher');
      await wrapper.find('[data-testid="import-label-apply"]').trigger('submit');
      await flushPromises();

      expect(lastBody('/preview').labelChanges).toEqual([
        { line: 3, thirdParty: 'Butcher', remember: true },
      ]);
    });

    it('says how many corrections the limit left out, once the import is done', async () => {
      apiClient.POST.mockImplementation(async (path: string) => {
        if (path === '/operations/import') return ok(upload);
        if (path.endsWith('/preview')) return ok(preview);
        return ok({
          importedCount: 1,
          skippedCount: 0,
          invalidCount: 0,
          rememberedCount: 0,
          notRememberedCount: 3,
          reconciledCount: 0,
          alreadyImported: false,
        });
      });
      const wrapper = await startPreview();
      await wrapper.find('[data-testid="import-confirm"]').trigger('click');
      await flushPromises();

      expect(queuedToastText()).toContain('3 label corrections were not remembered');
      expect(queuedToastText()).toContain('limit of 1000');
      expect(router.currentRoute.value.name).toBe('operations');
    });

    it('links to the remembered corrections', async () => {
      const { wrapper } = await mountPage();
      expect(wrapper.find('[data-testid="import-corrections-link"]').attributes('href')).toBe(
        '/settings/label-corrections',
      );
    });
  });

  describe('review aids', () => {
    const savings: Account = { ...account, id: 'a2', name: 'Savings' };

    async function startWith(answer: Preview, accounts: Account[] = [account]) {
      mockApi(accounts);
      apiClient.POST.mockImplementation(async (path: string) => {
        if (path === '/operations/import') return ok(upload);
        if (path.endsWith('/preview')) return ok(answer);
        return ok(undefined);
      });
      const { wrapper } = await mountPage();
      await chooseFile(wrapper);
      return wrapper;
    }
    const confirmed = {
      importedCount: 1,
      skippedCount: 1,
      invalidCount: 1,
      rememberedCount: 0,
      notRememberedCount: 0,
      reconciledCount: 0,
      alreadyImported: false,
    };
    const count = (wrapper: VueWrapper, name: string) =>
      wrapper.find(`[data-testid="import-filter-${name}"]`).text();

    describe('the file step', () => {
      it('uploads a file dropped on the zone, and shows its name', async () => {
        const { wrapper } = await mountPage();
        const file = new File(['<OFX>'], 'dropped.ofx');

        await wrapper.find('[data-testid="import-drop"]').trigger('drop', {
          dataTransfer: { files: [file] },
        });
        await flushPromises();

        const [path, options] = apiClient.POST.mock.calls[0] as [
          string,
          { bodySerializer: (body: unknown) => FormData; body: unknown },
        ];
        expect(path).toBe('/operations/import');
        expect((options.bodySerializer(options.body).get('file') as File).name).toBe('dropped.ofx');
        expect(wrapper.find('[data-testid="import-file-name"]').text()).toBe('File: dropped.ofx');
      });

      it('shows the name of the file chosen', async () => {
        const { wrapper } = await mountPage();
        await chooseFile(wrapper, new File(['<OFX>'], 'chosen.ofx'));
        expect(wrapper.find('[data-testid="import-file-name"]').text()).toBe('File: chosen.ofx');
      });
    });

    describe('announcements', () => {
      it('tells the rows read and the preview that results, without moving the focus', async () => {
        const wrapper = await startWith(preview);
        const live = wrapper.find('[data-testid="import-announce"]');

        expect(live.attributes('role')).toBe('status');
        expect(live.attributes('aria-live')).toBe('polite');
        expect(live.text()).toBe('Preview updated: 1 to import, 1 already recorded, 1 invalid.');
      });

      it('announces the rows read as soon as the file is read', async () => {
        let answer: (value: unknown) => void = () => {};
        apiClient.POST.mockImplementation(async (path: string) => {
          if (path === '/operations/import') return ok(upload);
          return new Promise((resolve) => {
            answer = resolve;
          });
        });
        const { wrapper } = await mountPage();
        await chooseFile(wrapper);

        expect(wrapper.find('[data-testid="import-announce"]').text()).toBe(
          '3 rows read from the file.',
        );
        answer(ok(preview));
      });
    });

    describe('the statement', () => {
      it('gives the statement to the summary', async () => {
        const wrapper = await startWith(preview);
        expect(wrapper.find('[data-testid="import-period"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="import-debits"]').text()).toContain('€12.50');
        expect(wrapper.find('[data-testid="import-account-warning"]').exists()).toBe(false);
      });

      it('names the account of the Member the file seems to come from', async () => {
        const wrapper = await startWith(
          {
            ...preview,
            statement: { ...statement, accountCheck: 'elsewhere', otherAccountId: 'a2' },
          },
          [account, savings],
        );
        expect(wrapper.find('[data-testid="import-account-warning"]').text()).toContain('Savings');
      });

      describe('when the file seems to come from another account', () => {
        const mismatched: Preview = {
          ...preview,
          statement: { ...statement, accountCheck: 'different' },
        };
        const confirmButton = (wrapper: VueWrapper) =>
          wrapper.find('[data-testid="import-confirm"]');

        it('keeps the import from being confirmed until the Member accepts it', async () => {
          const wrapper = await startWith(mismatched);
          expect(confirmButton(wrapper).attributes('disabled')).toBeDefined();

          await wrapper.find('[data-testid="import-accept-mismatch"]').setValue(true);

          expect(confirmButton(wrapper).attributes('disabled')).toBeUndefined();
        });

        it('sends that the Member accepted it', async () => {
          const wrapper = await startWith(mismatched);
          await wrapper.find('[data-testid="import-accept-mismatch"]').setValue(true);
          await confirmButton(wrapper).trigger('click');
          await flushPromises();

          const body = apiClient.POST.mock.calls
            .filter(([path]) => String(path).endsWith('/confirm'))
            .at(-1)![1].body;
          expect(body.acceptAccountMismatch).toBe(true);
        });

        it('sends nothing of the sort for a file that fits the account', async () => {
          const wrapper = await startWith(preview);
          await confirmButton(wrapper).trigger('click');
          await flushPromises();

          const body = apiClient.POST.mock.calls
            .filter(([path]) => String(path).endsWith('/confirm'))
            .at(-1)![1].body;
          expect(body.acceptAccountMismatch).toBe(false);
        });
      });
    });

    describe('rows needing attention', () => {
      const attention = (wrapper: VueWrapper) => count(wrapper, 'attention');

      it('counts the invalid rows and the rows to import without a category', async () => {
        const wrapper = await startWith({
          ...preview,
          importCount: 2,
          rows: [
            preview.rows[0],
            { ...preview.rows[0], line: 4, categoryId: null, categoryOrigin: null },
            preview.rows[1],
            preview.rows[2],
          ],
        });

        expect(attention(wrapper)).toBe('Needs attention 2');
        await wrapper.find('[data-testid="import-filter-attention"]').trigger('click');
        expect(wrapper.findAll('[data-testid="import-rows"] tbody tr')).toHaveLength(2);
      });

      it('leaves out a skipped row, until the Member includes it', async () => {
        const wrapper = await startWith(preview);
        expect(attention(wrapper)).toBe('Needs attention 1');

        await wrapper.find('[data-testid="import-include"]').setValue(true);

        expect(attention(wrapper)).toBe('Needs attention 2');
      });

      it('drops a row once it has a category, and counts it again when the category is removed', async () => {
        const wrapper = await startWith({
          ...preview,
          rows: [
            { ...preview.rows[0], categoryId: null, categoryOrigin: null },
            preview.rows[1],
            preview.rows[2],
          ],
        });
        expect(attention(wrapper)).toBe('Needs attention 2');

        const select = wrapper.find(
          '[data-testid="import-row-import"] [data-testid="import-row-category"]',
        );
        await select.setValue('cat-gift');
        expect(attention(wrapper)).toBe('Needs attention 1');

        await select.setValue('');
        expect(attention(wrapper)).toBe('Needs attention 2');
      });
    });

    describe('skipped rows', () => {
      it('shows the operation a skipped row matches, and how', async () => {
        const wrapper = await startWith({
          ...preview,
          rows: [
            preview.rows[0],
            {
              ...preview.rows[1],
              recorded: {
                valueDate: '2026-01-05',
                thirdParty: 'Old name',
                matchedBy: 'reference',
                reconciled: false,
              },
            },
            preview.rows[2],
          ],
        });

        expect(wrapper.find('[data-testid="import-recorded"]').text()).toBe(
          'Already recorded on Jan 5, 2026 as Old name (same bank reference).',
        );
      });

      it('says when the row is the other side of a transfer already recorded', async () => {
        const wrapper = await startWith({
          ...preview,
          rows: [
            preview.rows[0],
            {
              ...preview.rows[1],
              recorded: {
                valueDate: '2026-03-24',
                thirdParty: 'Livret A',
                matchedBy: 'transfer',
                reconciled: false,
              },
            },
            preview.rows[2],
          ],
        });

        expect(wrapper.find('[data-testid="import-recorded"]').text()).toBe(
          'Already recorded on Mar 24, 2026 as Livret A (the other side of this transfer: same amount, within 3 days).',
        );
      });

      it('says when the date, amount and label matched', async () => {
        const wrapper = await startWith(preview);
        expect(wrapper.find('[data-testid="import-recorded"]').text()).toContain(
          'as employeur (same amount and label, within 2 days)',
        );
      });
    });

    describe('suggestions', () => {
      const suggested = (origin: 'history' | 'picked' | null): Preview => ({
        ...preview,
        rows: [
          { ...preview.rows[0], paymentMethodOrigin: origin },
          preview.rows[1],
          preview.rows[2],
        ],
      });
      const mark = (wrapper: VueWrapper) =>
        wrapper.find('[data-testid="import-row-import"] [data-testid="import-method-suggested"]');

      it('marks a payment method taken from history, until another is picked', async () => {
        const wrapper = await startWith(suggested('history'));

        expect(mark(wrapper).text()).toBe('Suggested from your earlier operations');
        expect(mark(wrapper).attributes('title')).toBe('Suggested from your earlier operations');

        await wrapper
          .find('[data-testid="import-row-import"] [data-testid="import-row-payment-method"]')
          .setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
        expect(mark(wrapper).exists()).toBe(false);
      });

      it('marks nothing for a payment method the file or the Member settled', async () => {
        expect(mark(await startWith(suggested(null))).exists()).toBe(false);
        expect(mark(await startWith(suggested('picked'))).exists()).toBe(false);
      });

      it('says which account a transfer also goes to, for a row that will be imported', async () => {
        const wrapper = await startWith(
          {
            ...preview,
            rows: [
              {
                ...preview.rows[0],
                paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
                transferAccountId: 'a2',
                transferAccountOrigin: 'history',
              },
              {
                ...preview.rows[1],
                paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_CREDIT,
                transferAccountId: 'a2',
                transferAccountOrigin: 'history',
              },
              preview.rows[2],
            ],
          },
          [account, savings],
        );
        const notice = (status: string) =>
          wrapper.find(
            `[data-testid="import-row-${status}"] [data-testid="import-transfer-mirror"]`,
          );

        expect(notice('import').text()).toContain('A matching operation will also be recorded in');
        expect(notice('import').text()).toContain('Savings');
        expect(notice('skipped').exists()).toBe(false);

        await wrapper.find('[data-testid="import-include"]').setValue(true);
        expect(notice('skipped').exists()).toBe(true);

        await wrapper
          .find('[data-testid="import-row-import"] [data-testid="import-row-payment-method"]')
          .setValue('transfer:external');
        expect(notice('import').exists()).toBe(false);
      });
    });

    describe('reconciliation', () => {
      const lastConfirm = () =>
        (
          apiClient.POST.mock.calls
            .filter(([path]) => String(path).endsWith('/confirm'))
            .at(-1) as [string, { body: Record<string, unknown> }]
        )[1].body;
      const confirmBar = (wrapper: VueWrapper) => wrapper.find('[data-testid="import-confirm"]');
      const recordedRow = (reconciled: boolean, line = 2): Preview['rows'][number] => ({
        ...preview.rows[1],
        line,
        recorded: {
          valueDate: '2026-03-26',
          thirdParty: 'employeur',
          matchedBy: 'details',
          reconciled,
        },
      });
      const twoRecorded: Preview = {
        ...preview,
        skippedCount: 2,
        rows: [preview.rows[0], recordedRow(false, 2), recordedRow(false, 4), preview.rows[2]],
      };
      const boxes = (wrapper: VueWrapper) =>
        wrapper
          .findAll('[data-testid="import-reconcile-recorded"]')
          .map((box) => (box.element as HTMLInputElement).checked);
      const confirm = async (wrapper: VueWrapper) => {
        await confirmBar(wrapper).trigger('click');
        await flushPromises();
      };

      it('reconciles by default, the imported operations and the recorded ones they match', async () => {
        const wrapper = await startWith(preview);
        expect(
          (wrapper.find('[data-testid="import-reconcile"]').element as HTMLInputElement).checked,
        ).toBe(true);
        expect(boxes(wrapper)).toEqual([true]);
        expect(wrapper.find('[data-testid="import-reconcile-recorded-count"]').text()).toBe(
          '1 recorded operation will be reconciled instead of imported.',
        );

        await confirm(wrapper);

        expect(lastConfirm()).toMatchObject({ reconcile: true, reconcileLines: [2] });
      });

      it('reconciles neither when the Member unticks the switch', async () => {
        const wrapper = await startWith(preview);

        await wrapper.find('[data-testid="import-reconcile"]').setValue(false);

        expect(boxes(wrapper)).toEqual([false]);
        expect(wrapper.find('[data-testid="import-reconcile-recorded-count"]').exists()).toBe(
          false,
        );
        await confirm(wrapper);
        expect(lastConfirm()).toMatchObject({ reconcile: false, reconcileLines: [] });
      });

      it('excludes a row from the reconciliation, and takes it back', async () => {
        const wrapper = await startWith(twoRecorded);
        const [first] = wrapper.findAll('[data-testid="import-reconcile-recorded"]');

        await first.setValue(false);
        expect(boxes(wrapper)).toEqual([false, true]);
        expect(wrapper.find('[data-testid="import-reconcile-recorded-count"]').text()).toContain(
          '1 recorded operation',
        );
        await confirm(wrapper);
        expect(lastConfirm()).toMatchObject({ reconcile: true, reconcileLines: [4] });

        await first.setValue(true);
        expect(boxes(wrapper)).toEqual([true, true]);
      });

      it('includes a row when the switch is off', async () => {
        const wrapper = await startWith(twoRecorded);
        await wrapper.find('[data-testid="import-reconcile"]').setValue(false);

        await wrapper.findAll('[data-testid="import-reconcile-recorded"]')[1].setValue(true);

        expect(boxes(wrapper)).toEqual([false, true]);
        await confirm(wrapper);
        expect(lastConfirm()).toMatchObject({ reconcile: false, reconcileLines: [4] });
      });

      it('lets a new choice for the whole file replace the choices made row by row', async () => {
        const wrapper = await startWith(twoRecorded);
        await wrapper.findAll('[data-testid="import-reconcile-recorded"]')[0].setValue(false);

        await wrapper.find('[data-testid="import-reconcile"]').setValue(false);
        await wrapper.find('[data-testid="import-reconcile"]').setValue(true);

        expect(boxes(wrapper)).toEqual([true, true]);
      });

      it('keeps the row choices short, with the whole meaning in a tooltip', async () => {
        const wrapper = await startWith(preview);
        const row = wrapper.find('[data-testid="import-row-skipped"]');

        const labels = row.findAll('label');
        expect(labels.map((label) => label.text())).toEqual([
          'Import anyway',
          'Reconcile existing',
        ]);
        expect(labels.every((label) => label.classes().includes('text-nowrap'))).toBe(true);
        expect(labels[1].attributes('title')).toBe(
          'Reconcile the recorded operation this row matches, instead of importing it',
        );
      });

      it('offers nothing for an operation that is reconciled already, and says so', async () => {
        const wrapper = await startWith({
          ...preview,
          rows: [preview.rows[0], recordedRow(true), preview.rows[2]],
        });

        const row = wrapper.find('[data-testid="import-row-skipped"]');
        expect(row.find('[data-testid="import-reconcile-recorded"]').exists()).toBe(false);
        expect(row.find('[data-testid="import-recorded-reconciled"]').text()).toBe(
          'It is reconciled already.',
        );
        expect(wrapper.find('[data-testid="import-reconcile-recorded-count"]').exists()).toBe(
          false,
        );
        await confirm(wrapper);
        expect(lastConfirm()).toMatchObject({ reconcileLines: [] });
      });

      it('imports the row instead when the Member includes it anyway', async () => {
        const wrapper = await startWith(preview);
        const row = () => wrapper.find('[data-testid="import-row-skipped"]');

        await row().find('[data-testid="import-include"]').setValue(true);

        const box = row().find('[data-testid="import-reconcile-recorded"]');
        expect(box.attributes('disabled')).toBeDefined();
        expect(wrapper.find('[data-testid="import-reconcile-recorded-count"]').exists()).toBe(
          false,
        );
        await confirm(wrapper);
        expect(lastConfirm()).toMatchObject({ includedLines: [2], reconcileLines: [] });
      });

      it('confirms at once when reconciling is all the import does', async () => {
        const wrapper = await startWith({
          ...preview,
          importCount: 0,
          rows: [recordedRow(false), preview.rows[2]],
        });

        expect(confirmBar(wrapper).attributes('disabled')).toBeUndefined();
        expect(confirmBar(wrapper).text()).toBe('Reconcile 1 recorded operation');
        expect(wrapper.find('[data-testid="import-nothing"]').exists()).toBe(false);

        await wrapper.find('[data-testid="import-reconcile-recorded"]').setValue(false);

        expect(confirmBar(wrapper).attributes('disabled')).toBeDefined();
        expect(wrapper.find('[data-testid="import-nothing"]').exists()).toBe(true);
      });

      it('tells how many recorded operations were reconciled', async () => {
        const wrapper = await startWith(preview);
        apiClient.POST.mockImplementation(async (path: string) =>
          path.endsWith('/confirm') ? ok({ ...confirmed, reconciledCount: 1 }) : ok(preview),
        );

        await confirm(wrapper);

        expect(queuedToastText()).toContain('1 recorded operation reconciled.');
      });

      it('forgets a row choice when the row stops being a reconcilable skipped row', async () => {
        const changed = {
          ...preview,
          rows: [
            preview.rows[0],
            { ...preview.rows[1], status: 'import' as const, recorded: null },
            preview.rows[2],
          ],
        };
        let current = preview;
        mockApi();
        apiClient.POST.mockImplementation(async (path: string) => {
          if (path === '/operations/import') return ok(upload);
          if (path.endsWith('/preview')) return ok(current);
          return ok({ ...confirmed });
        });
        const { wrapper } = await mountPage();
        await chooseFile(wrapper);
        await wrapper.find('[data-testid="import-reconcile-recorded"]').setValue(false);

        current = changed;
        await wrapper
          .find('[data-testid="import-row-import"] [data-testid="import-change-label"]')
          .trigger('click');
        await wrapper.find('[data-testid="import-label-input"]').setValue('Bakery');
        await wrapper.find('[data-testid="import-label-apply"]').trigger('submit');
        await flushPromises();
        await confirm(wrapper);

        expect(lastConfirm()).toMatchObject({ reconcileLines: [] });
      });
    });

    describe('readable choices', () => {
      const savings: Account = { ...account, id: 'a2', name: 'Savings' };
      const nested = [
        { id: 'cat-housing', name: 'Housing', type: 'debit', parentId: null },
        { id: 'cat-rent', name: 'Rent', type: 'debit', parentId: 'cat-housing' },
      ];
      const select = (wrapper: VueWrapper, testid: string) =>
        wrapper.find(`[data-testid="import-row-import"] [data-testid="${testid}"]`);

      it('gives the whole selected payment method and category as a tooltip', async () => {
        const wrapper = await startWith(preview);
        expect(select(wrapper, 'import-row-payment-method').attributes('title')).toBe(
          'Credit card',
        );
        expect(select(wrapper, 'import-row-category').attributes('title')).toBe('Food');

        await select(wrapper, 'import-row-category').setValue('');
        expect(select(wrapper, 'import-row-category').attributes('title')).toBe('No category');
      });

      it('names the account of a transfer in the tooltip, and an outside one as such', async () => {
        const wrapper = await startWith(
          {
            ...preview,
            rows: [
              {
                ...preview.rows[0],
                paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
                transferAccountId: 'a2',
                transferAccountOrigin: 'history',
              },
              preview.rows[1],
              preview.rows[2],
            ],
          },
          [account, savings],
        );
        const method = () => select(wrapper, 'import-row-payment-method');

        expect(method().attributes('title')).toBe('Transfer to Chase — Savings');
        await method().setValue('transfer:external');
        expect(method().attributes('title')).toBe('Transfer to outside');
      });

      it('shows a nested category as Parent > Child in the tooltip', async () => {
        mockApi();
        apiClient.GET.mockImplementation(async (path: string) => {
          if (path === '/accounts') return ok([account]);
          if (path === '/banks') return ok([bank]);
          if (path === '/reference-data/payment-methods') return ok(paymentMethods);
          if (path === '/reference-data/categories') return ok([...categories, ...nested]);
          return ok(undefined);
        });
        apiClient.POST.mockImplementation(async (path: string) => {
          if (path === '/operations/import') return ok(upload);
          return ok({
            ...preview,
            rows: [
              { ...preview.rows[0], categoryId: 'cat-rent' },
              preview.rows[1],
              preview.rows[2],
            ],
          });
        });
        const { wrapper } = await mountPage();
        await chooseFile(wrapper);

        expect(select(wrapper, 'import-row-category').attributes('title')).toBe('Housing > Rent');
      });
    });

    describe('actions', () => {
      it('keeps the confirmation and the cancel together in one bar', async () => {
        const wrapper = await startWith(preview);
        const bar = wrapper.find('[data-testid="import-actions"]');

        expect(bar.find('[data-testid="import-confirm"]').exists()).toBe(true);
        expect(bar.find('[data-testid="import-cancel"]').exists()).toBe(true);
      });

      it('offers only the cancel before a file is read', async () => {
        const { wrapper } = await mountPage();
        const bar = wrapper.find('[data-testid="import-actions"]');

        expect(bar.find('[data-testid="import-confirm"]').exists()).toBe(false);
        expect(bar.find('[data-testid="import-cancel"]').exists()).toBe(true);
      });
    });
  });

  describe('cancel', () => {
    it('discards the held file and goes back to the operations', async () => {
      const { wrapper } = await mountPage();
      await chooseFile(wrapper);
      await wrapper.find('[data-testid="import-cancel"]').trigger('click');
      await flushPromises();

      expect(apiClient.DELETE).toHaveBeenCalledWith('/operations/import/{importId}', {
        params: { path: { importId: IMPORT_ID } },
      });
      expect(router.currentRoute.value.name).toBe('operations');
    });

    it('discards the held file when the page is left without cancelling', async () => {
      const { wrapper } = await mountPage();
      await chooseFile(wrapper);

      wrapper.unmount();

      expect(apiClient.DELETE).toHaveBeenCalledTimes(1);
      expect(apiClient.DELETE).toHaveBeenCalledWith('/operations/import/{importId}', {
        params: { path: { importId: IMPORT_ID } },
      });
    });

    it('discards the file it replaces when another one is uploaded', async () => {
      const { wrapper } = await mountPage();
      await chooseFile(wrapper);
      apiClient.POST.mockImplementation(async (path: string) =>
        path === '/operations/import' ? ok({ importId: 'import-2', rowCount: 3 }) : ok(preview),
      );

      await chooseFile(wrapper);

      expect(apiClient.DELETE).toHaveBeenCalledTimes(1);
      expect(apiClient.DELETE).toHaveBeenCalledWith('/operations/import/{importId}', {
        params: { path: { importId: IMPORT_ID } },
      });
    });

    it('discards nothing once the import is confirmed', async () => {
      const { wrapper } = await mountPage();
      await chooseFile(wrapper);
      await wrapper.find('[data-testid="import-confirm"]').trigger('click');
      await flushPromises();

      wrapper.unmount();

      expect(apiClient.DELETE).not.toHaveBeenCalled();
    });

    it('does not call the API when no file was uploaded', async () => {
      const { wrapper } = await mountPage();
      await wrapper.find('[data-testid="import-cancel"]').trigger('click');
      await flushPromises();
      expect(apiClient.DELETE).not.toHaveBeenCalled();
      expect(router.currentRoute.value.name).toBe('operations');
    });
  });
});
