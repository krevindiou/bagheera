import { computed, ref, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTransferTargets } from '../../composables/useTransferTargets';
import {
  useAccountsQuery,
  useBanksQuery,
  useCategoriesQuery,
  usePaymentMethodsQuery,
} from '../../composables/useReferenceQueries';
import { accountLabel } from '../../domain/accounts';
import {
  categoryLabel,
  groupCategories,
  PAYMENT_METHOD_ID,
  paymentMethodName,
  TRANSFER_PAYMENT_METHOD_IDS,
} from '../../domain/referenceData';
import type {
  CategoryChange,
  LabelChange,
  PaymentMethodChange,
  PreviewRow,
  TransferAccountChange,
} from './import.types';

// A transfer is chosen together with its other account in the one list of the
// row: `transfer:<account id>`, or `transfer:external` for an account that is
// none of the Member's.
const TRANSFER_CHOICE = 'transfer:';
const OUTSIDE_ACCOUNT = 'external';

/**
 * What the Member changed on the rows of an import preview, and what each row
 * shows once those changes are applied to it. The changes are sent with every
 * preview and with the confirmation; none of them is saved before.
 */
export function useImportChoices(accountId: Readonly<Ref<string>>) {
  const { t } = useI18n();
  const { accounts } = useAccountsQuery();
  const { banks } = useBanksQuery();
  const { transferTargets } = useTransferTargets(
    () => accountId.value,
    () => accounts.value,
    () => banks.value,
    () => null,
  );
  const { paymentMethods } = usePaymentMethodsQuery();
  const { categories } = useCategoriesQuery();

  // The accounts a transfer can go to, by bank name then account name.
  const sortedTransferTargets = computed(() => {
    const bankName = (account: { bankId: string }) =>
      banks.value.find((b) => b.id === account.bankId)?.name ?? '';
    const compare = (a: string, b: string) =>
      a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
    return [...transferTargets.value].sort(
      (a, b) => compare(bankName(a), bankName(b)) || compare(a.name, b.name),
    );
  });

  const debitMethods = computed(() => paymentMethods.value.filter((pm) => pm.type === 'debit'));
  const creditMethods = computed(() => paymentMethods.value.filter((pm) => pm.type === 'credit'));
  const debitCategories = computed(() =>
    groupCategories(categories.value.filter((c) => c.type === 'debit')),
  );
  const creditCategories = computed(() =>
    groupCategories(categories.value.filter((c) => c.type === 'credit')),
  );

  // The labels the Member changed in the preview, by row, and the set the
  // shown preview was built with: they differ until the changes are applied.
  const labelEdits = ref<Map<number, { thirdParty: string; remember: boolean }>>(new Map());
  const appliedKey = ref('[]');
  // The payment methods picked for single rows.
  const methodEdits = ref<Map<number, string>>(new Map());
  // The other account of a transfer, picked for single rows; null is an
  // external transfer.
  const transferEdits = ref<Map<number, string | null>>(new Map());
  // The categories picked, or removed (null), for single rows.
  const categoryEdits = ref<Map<number, string | null>>(new Map());

  const labelChanges = computed<LabelChange[]>(() =>
    [...labelEdits.value.entries()]
      .sort(([a], [b]) => a - b)
      .map(([line, edit]) => ({ line, thirdParty: edit.thirdParty, remember: edit.remember })),
  );
  const paymentMethodChanges = computed<PaymentMethodChange[]>(() =>
    [...methodEdits.value.entries()]
      .sort(([a], [b]) => a - b)
      .map(([line, paymentMethodId]) => ({ line, paymentMethodId })),
  );
  const transferAccountChanges = computed<TransferAccountChange[]>(() =>
    [...transferEdits.value.entries()]
      .sort(([a], [b]) => a - b)
      .map(([line, accountId]) => ({ line, accountId })),
  );
  const categoryChanges = computed<CategoryChange[]>(() =>
    [...categoryEdits.value.entries()]
      .sort(([a], [b]) => a - b)
      .map(([line, categoryId]) => ({ line, categoryId })),
  );

  // A transfer method is matched against the account's operations, any other
  // is not, so a pick moves a row only when it makes the row a transfer or
  // stops it being one: this counts those picks, for the preview to be worked
  // out again.
  const placeChanges = ref(0);

  const labelChangesKey = computed(() => JSON.stringify(labelChanges.value));
  const labelChangesPending = computed(() => labelChangesKey.value !== appliedKey.value);

  function markLabelsApplied(key: string) {
    appliedKey.value = key;
  }

  function reset() {
    methodEdits.value = new Map();
    categoryEdits.value = new Map();
    transferEdits.value = new Map();
    labelEdits.value = new Map();
    appliedKey.value = '[]';
  }

  function keepLabel(row: PreviewRow, change: { thirdParty: string; remember: boolean }) {
    // Nothing to apply when the text is what the preview already shows.
    if (change.thirdParty === (row.thirdParty ?? '') && !labelEdits.value.has(row.line)) return;
    labelEdits.value = new Map(labelEdits.value).set(row.line, change);
  }

  function editorText(row: PreviewRow): string {
    return labelEdits.value.get(row.line)?.thirdParty ?? row.thirdParty ?? row.sourceLabel ?? '';
  }

  function labelRemember(line: number): boolean {
    return labelEdits.value.get(line)?.remember ?? true;
  }

  function shownMethod(row: PreviewRow): string {
    return methodEdits.value.get(row.line) ?? row.paymentMethodId ?? '';
  }

  function isTransfer(row: PreviewRow): boolean {
    return TRANSFER_PAYMENT_METHOD_IDS.includes(shownMethod(row));
  }

  function shownTransferAccount(row: PreviewRow): string {
    return transferEdits.value.has(row.line)
      ? (transferEdits.value.get(row.line) ?? '')
      : (row.transferAccountId ?? '');
  }

  // The account the row's transfer goes to or comes from once the Member's
  // choices are applied; null when the row is no transfer, or an external one.
  function transferAccountOf(row: PreviewRow): string | null {
    return isTransfer(row) ? shownTransferAccount(row) || null : null;
  }

  function shownChoice(row: PreviewRow): string {
    return isTransfer(row)
      ? `${TRANSFER_CHOICE}${shownTransferAccount(row) || OUTSIDE_ACCOUNT}`
      : shownMethod(row);
  }

  function plainMethodsFor(row: PreviewRow) {
    return (row.type === 'debit' ? debitMethods.value : creditMethods.value).filter(
      (method) => !TRANSFER_PAYMENT_METHOD_IDS.includes(method.id),
    );
  }

  function transferChoiceLabel(row: PreviewRow, account: string | null) {
    if (account === null) {
      return t(
        row.type === 'debit'
          ? 'operations.import.preview.transferOutsideTo'
          : 'operations.import.preview.transferOutsideFrom',
      );
    }
    return t(
      row.type === 'debit'
        ? 'operations.import.preview.transferTo'
        : 'operations.import.preview.transferFrom',
      { account },
    );
  }

  // The transfer entries of the row's list: each account, then an account that
  // is none of the Member's.
  function transferOptions(row: PreviewRow): { value: string; label: string }[] {
    return [
      ...sortedTransferTargets.value.map((target) => ({
        value: `${TRANSFER_CHOICE}${target.id}`,
        label: transferChoiceLabel(row, accountLabel(target, banks.value)),
      })),
      {
        value: `${TRANSFER_CHOICE}${OUTSIDE_ACCOUNT}`,
        label: transferChoiceLabel(row, null),
      },
    ];
  }

  function methodName(id: string): string {
    return paymentMethodName(id, paymentMethods.value);
  }

  // The whole selected choice, for a tooltip: a select shows only what fits.
  function choiceTitle(row: PreviewRow): string {
    if (!isTransfer(row)) return methodName(shownMethod(row));
    const chosen = shownTransferAccount(row);
    const target = sortedTransferTargets.value.find((a) => a.id === chosen);
    return transferChoiceLabel(row, target ? accountLabel(target, banks.value) : null);
  }

  function pickChoice(row: PreviewRow, choice: string) {
    const becomesTransfer =
      choice.startsWith(TRANSFER_CHOICE) || TRANSFER_PAYMENT_METHOD_IDS.includes(choice);
    if (becomesTransfer !== isTransfer(row)) placeChanges.value++;
    if (choice.startsWith(TRANSFER_CHOICE)) {
      const account = choice.slice(TRANSFER_CHOICE.length);
      methodEdits.value = new Map(methodEdits.value).set(
        row.line,
        row.type === 'debit' ? PAYMENT_METHOD_ID.TRANSFER_DEBIT : PAYMENT_METHOD_ID.TRANSFER_CREDIT,
      );
      transferEdits.value = new Map(transferEdits.value).set(
        row.line,
        account === OUTSIDE_ACCOUNT ? null : account,
      );
      return;
    }
    methodEdits.value = new Map(methodEdits.value).set(row.line, choice);
    // A counterpart account only goes with a transfer method.
    if (transferEdits.value.has(row.line)) {
      const next = new Map(transferEdits.value);
      next.delete(row.line);
      transferEdits.value = next;
    }
  }

  // The name of the account the row's transfer goes to, for the mirror note.
  function mirrorAccountName(row: PreviewRow): string | null {
    const chosen = shownTransferAccount(row);
    const target = chosen ? transferTargets.value.find((a) => a.id === chosen) : undefined;
    return target ? accountLabel(target, banks.value) : null;
  }

  function shownCategory(row: PreviewRow): string {
    return categoryEdits.value.has(row.line)
      ? (categoryEdits.value.get(row.line) ?? '')
      : (row.categoryId ?? '');
  }

  function categoriesFor(row: PreviewRow) {
    return row.type === 'debit' ? debitCategories.value : creditCategories.value;
  }

  function categoryTitle(row: PreviewRow): string {
    const chosen = categories.value.find((c) => c.id === shownCategory(row));
    return chosen ? categoryLabel(chosen, categories.value) : t('operations.noCategory');
  }

  function pickCategory(row: PreviewRow, categoryId: string | undefined) {
    categoryEdits.value = new Map(categoryEdits.value).set(row.line, categoryId || null);
  }

  return {
    // What is sent with a preview and with the confirmation.
    labelChanges,
    paymentMethodChanges,
    categoryChanges,
    transferAccountChanges,
    labelChangesKey,
    labelChangesPending,
    placeChanges,
    labelEditCount: computed(() => labelEdits.value.size),
    markLabelsApplied,
    reset,
    keepLabel,
    editorText,
    labelRemember,
    // What a row shows and offers.
    isTransfer,
    transferAccountOf,
    shownChoice,
    choiceTitle,
    plainMethodsFor,
    transferOptions,
    methodName,
    pickChoice,
    mirrorAccountName,
    shownCategory,
    categoriesFor,
    categoryTitle,
    allCategories: () => categories.value,
    pickCategory,
    // Whether the Member changed it, so that the row's suggestion mark goes.
    methodPicked: (line: number) => methodEdits.value.has(line),
    transferPicked: (line: number) => transferEdits.value.has(line),
    categoryPicked: (line: number) => categoryEdits.value.has(line),
  };
}

export type ImportChoices = ReturnType<typeof useImportChoices>;

// What a row needs of the choices: what it shows and offers, and the picks it
// makes. The page holds the rest (the changes it sends).
export type RowChoices = Pick<
  ImportChoices,
  | 'editorText'
  | 'labelRemember'
  | 'isTransfer'
  | 'shownChoice'
  | 'choiceTitle'
  | 'plainMethodsFor'
  | 'transferOptions'
  | 'methodName'
  | 'pickChoice'
  | 'mirrorAccountName'
  | 'shownCategory'
  | 'categoriesFor'
  | 'categoryTitle'
  | 'allCategories'
  | 'pickCategory'
  | 'methodPicked'
  | 'transferPicked'
  | 'categoryPicked'
>;
