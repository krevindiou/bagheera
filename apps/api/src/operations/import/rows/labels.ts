import { FIELD_LIMITS, IMPORT_LIMITS } from '@bagheera/reference-data';
import type { OfxRow } from '../ofx';
import { withoutLeadingMethod } from './payment-method-wording';
import type { InvalidReason, LabelOrigin } from './types';

// What the Member did to the labels in the preview.
export interface LabelChange {
  line: number;
  thirdParty: string;
  remember: boolean;
}

export interface LabelRules {
  // Remembered corrections: normalised label of the file -> third party.
  corrections: ReadonlyMap<string, string>;
  // This preview's changes, by line.
  changes: ReadonlyMap<number, string>;
}

export const NO_LABEL_RULES: LabelRules = { corrections: new Map(), changes: new Map() };

// Labels are compared ignoring case and surrounding spaces.
export function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

// Banks often write the date, the time or the amount of the operation in its
// label; those change from one row to the next and say nothing about the third
// party, so they are left out of it.
const DAY = '(?:0?[1-9]|[12]\\d|3[01])';
const MONTH = '(?:0?[1-9]|1[0-2])';
const VARIABLE_PARTS = new RegExp(
  [
    `\\d{4}-${MONTH}(?:-${DAY})?`,
    `${DAY}[/.-]${MONTH}(?:[/.-]\\d{2,4})?`,
    `\\d{1,2}:\\d{2}(?::\\d{2})?`,
    `[€$£]\\s?\\d{1,15}(?:[.,]\\d{1,4})?`,
    `\\d{1,15}[.,]\\d{1,4}(?:\\s?(?:eur|usd|gbp|chf|[€$£]))?`,
    // After the amounts, so that 12.50 EUR is read as an amount.
    `${MONTH}[/.-](?:\\d{4}|\\d{2})`,
  ]
    .map((part) => `(?<![\\w.,])${part}(?![\\w])`)
    .join('|'),
  'giu',
);

// The label without its dates, times and amounts and the payment-method
// wording that starts it; the label itself, trimmed, when it holds none or
// nothing else would be left.
export function cleanLabel(label: string): string {
  const trimmed = label.trim();
  const stripped = trimmed.replace(VARIABLE_PARTS, ' ');
  const base =
    stripped === trimmed
      ? trimmed
      : stripped.replace(/\s+/g, ' ').replace(/^[\s*/,;:-]+|[\s*/,;:-]+$/g, '') || trimmed;
  return withoutLeadingMethod(base) || base;
}

// What a label correction is looked up by.
export function labelKey(label: string): string {
  return normalizeLabel(cleanLabel(label));
}

function codePoints(text: string): string[] {
  return Array.from(text);
}

export function truncateLabel(label: string): string {
  const characters = codePoints(label);
  return characters.length <= FIELD_LIMITS.SOURCE_LABEL
    ? label
    : characters.slice(0, FIELD_LIMITS.SOURCE_LABEL).join('');
}

// A third party the Member typed or remembered: held to the rules of an
// operation's field, never cut.
function typedThirdParty(text: string): { thirdParty: string; notes: string } | InvalidReason {
  const label = text.trim();
  if (label === '') return 'third_party_missing';
  if (codePoints(label).length > FIELD_LIMITS.THIRD_PARTY) return 'third_party_too_long';
  return { thirdParty: label, notes: '' };
}

function isFileLabel(text: string, rawLabel: string): boolean {
  const trimmed = text.trim();
  return trimmed === rawLabel || trimmed === cleanLabel(rawLabel);
}

export function resolveLabel(
  line: number,
  rawLabel: string,
  rules: LabelRules,
): { label: { thirdParty: string; notes: string } | InvalidReason; origin: LabelOrigin } {
  const change = rules.changes.get(line);
  // Changing a row back to the label of the file, or to the third party it
  // gives, also drops its correction.
  if (change !== undefined && !isFileLabel(change, rawLabel)) {
    return { label: typedThirdParty(change), origin: 'change' };
  }
  const corrected = change === undefined ? rules.corrections.get(labelKey(rawLabel)) : undefined;
  if (corrected !== undefined && rawLabel !== '') {
    return { label: typedThirdParty(corrected), origin: 'correction' };
  }
  return { label: resolveThirdParty(rawLabel), origin: 'file' };
}

// The third party of a row read from its label: the label
// without its dates, times and amounts, with the full label kept in the notes.
function resolveThirdParty(cell: string): { thirdParty: string; notes: string } | InvalidReason {
  const label = cell.trim();
  if (label === '') return 'third_party_missing';
  if (codePoints(label).length > FIELD_LIMITS.NOTES) return 'third_party_too_long';

  const cleaned = cleanLabel(label);
  const characters = codePoints(cleaned);
  const thirdParty =
    characters.length <= FIELD_LIMITS.THIRD_PARTY
      ? cleaned
      : characters.slice(0, FIELD_LIMITS.THIRD_PARTY).join('').trim();
  return { thirdParty, notes: thirdParty === label ? '' : label };
}

// The label of the file: the name the bank gives the row, or its memo.
export function rawLabelOf(row: OfxRow): string {
  return row.name !== '' ? row.name : row.memo;
}

// The memo of a row that has a name too: the name is the label, so the memo
// would be lost. It goes after the notes, cut where the notes' cap ends.
export function notesWithMemo(notes: string, row: OfxRow): string {
  if (row.name === '' || row.memo === '' || row.memo === row.name) return notes;
  const joined = notes === '' ? row.memo : `${notes}\n${row.memo}`;
  return codePoints(joined).length <= FIELD_LIMITS.NOTES
    ? joined
    : codePoints(joined).slice(0, FIELD_LIMITS.NOTES).join('');
}

// What confirming remembers or forgets: a null third party
// removes the correction of that label of the file.
export interface LabelIntent {
  sourceLabel: string;
  thirdParty: string | null;
}

// The corrections the Member chose to keep. A label that is empty or, once
// cleaned, too long to keep, and a change that is not itself a valid third
// party, are one-off.
// When several rows share a label of the file, the last one wins.
export function rememberedLabels(rows: OfxRow[], changes: LabelChange[]): LabelIntent[] {
  const intents = new Map<string, LabelIntent>();
  for (const change of [...changes].sort((a, b) => a.line - b.line)) {
    const row = rows[change.line - 1] as OfxRow | undefined;
    if (!change.remember || !row) continue;
    const rawLabel = rawLabelOf(row);
    if (rawLabel === '') continue;

    const sourceLabel = cleanLabel(rawLabel);
    if (codePoints(sourceLabel).length > IMPORT_LIMITS.MAX_CORRECTION_LABEL_CHARACTERS) continue;
    const changed = change.thirdParty.trim();
    if (isFileLabel(changed, rawLabel)) {
      intents.set(labelKey(rawLabel), { sourceLabel, thirdParty: null });
      continue;
    }
    const typed = typedThirdParty(changed);
    if (typeof typed === 'string') continue;
    intents.set(labelKey(rawLabel), { sourceLabel, thirdParty: typed.thirdParty });
  }
  return [...intents.values()];
}

export interface RememberedLabel {
  id: string;
  sourceLabel: string;
  thirdParty: string;
}

export interface LabelPlan {
  deletes: string[];
  updates: { id: string; thirdParty: string }[];
  inserts: LabelIntent[];
  // New corrections the quota left out.
  notRemembered: number;
}

// What to do with the corrections the Member already has so that they match
// the intents. Remembering is a convenience: what does not fit under `max` is
// left out, not the import.
export function planLabelIntents(
  existing: RememberedLabel[],
  intents: LabelIntent[],
  max: number,
): LabelPlan {
  const byKey = new Map(existing.map((row) => [labelKey(row.sourceLabel), row]));
  const deletes: string[] = [];
  const toInsert: LabelIntent[] = [];
  const updates: LabelPlan['updates'] = [];
  for (const intent of intents) {
    const current = byKey.get(labelKey(intent.sourceLabel));
    if (intent.thirdParty === null) {
      if (current) deletes.push(current.id);
    } else if (!current) {
      toInsert.push(intent);
    } else if (current.thirdParty !== intent.thirdParty) {
      updates.push({ id: current.id, thirdParty: intent.thirdParty });
    }
  }
  const room = Math.max(0, max - (existing.length - deletes.length));
  const inserts = toInsert.slice(0, room);
  return { deletes, updates, inserts, notRemembered: toInsert.length - inserts.length };
}
