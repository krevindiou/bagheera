import { FIELD_LIMITS, type EntryType } from '@bagheera/reference-data';
import type { OfxRow } from '../ofx';
import { parseAmount, parseDate } from './cell-values';
import {
  NO_LABEL_RULES,
  notesWithMemo,
  rawLabelOf,
  resolveLabel,
  truncateLabel,
  type LabelRules,
} from './labels';
import { paymentMethodOf } from './payment-method-wording';
import type { InvalidReason, RowOutcome } from './types';

function bankReferenceOf(row: OfxRow): string | null {
  return row.reference !== null && row.reference.length <= FIELD_LIMITS.BANK_REFERENCE
    ? row.reference
    : null;
}

// Reads every row as an operation to import, or says why it cannot be.
export function readRows(
  rows: OfxRow[],
  rules: LabelRules = NO_LABEL_RULES,
  // The payment methods the Member picked for single rows, by line.
  pickedMethods: ReadonlyMap<number, string> = new Map(),
): RowOutcome[] {
  return rows.map((row, index): RowOutcome => {
    const line = index + 1;
    const rawLabel = rawLabelOf(row);
    const sourceLabel = truncateLabel(rawLabel);
    const invalid = (reason: InvalidReason): RowOutcome => ({
      status: 'invalid',
      line,
      reason,
      sourceLabel,
    });
    if (!row.date || !row.amount) return invalid('cell_missing');

    const date = parseDate(row.date);
    if ('reason' in date) return invalid(date.reason);

    const amount = parseAmount(row.amount);
    if (typeof amount === 'string') return invalid(amount);
    const type: EntryType = amount.negative ? 'debit' : 'credit';

    const { label, origin } = resolveLabel(line, rawLabel, rules);
    if (typeof label === 'string') return invalid(label);

    const picked = pickedMethods.get(line);
    const guessed = paymentMethodOf(type, row.type, rawLabel);
    return {
      status: 'import',
      line,
      valueDate: date.date,
      type,
      amount: amount.minor,
      thirdParty: label.thirdParty,
      notes: notesWithMemo(label.notes, row),
      paymentMethodId: picked ?? guessed.id,
      paymentMethodOrigin: picked !== undefined ? 'picked' : guessed.standard ? 'default' : null,
      categoryId: null,
      categoryOrigin: null,
      transferAccountId: null,
      transferAccountOrigin: null,
      sourceLabel,
      labelOrigin: origin,
      bankReference: bankReferenceOf(row),
      recorded: null,
    };
  });
}
