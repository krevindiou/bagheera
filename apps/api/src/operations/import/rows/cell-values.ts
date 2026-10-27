import { AMOUNT_CEILING, MONEY_SCALE } from '@bagheera/money';
import { isValueDate } from '../../../common/value-date';
import type { InvalidReason } from './types';

const MAX_MINOR = Math.round(AMOUNT_CEILING * MONEY_SCALE);
// DTPOSTED: the day, then an optional time, fraction and zone.
const OFX_DATE = /^(\d{4})(\d{2})(\d{2})(?:\d{0,6}(?:\.\d{1,3})?)?(?:\[[^\]]*\])?$/;
const OFX_AMOUNT = /^([+-])?(\d+)(?:[.,](\d{1,4}))?$/;

export function parseDate(
  text: string,
): { date: string } | { reason: 'date_invalid' | 'date_out_of_range' } {
  const match = OFX_DATE.exec(text.trim());
  if (!match) return { reason: 'date_invalid' };
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { reason: 'date_invalid' };
  }
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isValueDate(iso) ? { date: iso } : { reason: 'date_out_of_range' };
}

// A signed number with a point or a comma as decimal mark and at most four
// decimals, never rounded; a thousands separator is not read.
export function parseAmount(text: string): { negative: boolean; minor: number } | InvalidReason {
  const match = OFX_AMOUNT.exec(text.trim());
  if (!match) return 'amount_invalid';

  const whole = Number(match[2]);
  if (!Number.isSafeInteger(whole) || whole > AMOUNT_CEILING) return 'amount_too_large';
  const minor = whole * MONEY_SCALE + Number((match[3] ?? '').padEnd(4, '0'));
  if (minor === 0) return 'amount_zero';
  if (minor > MAX_MINOR) return 'amount_too_large';
  return { negative: match[1] === '-', minor };
}

// The closing balance of the statement, signed and in minor units, with its
// date; null when the file gives none that can be read.
export function parseBalance(closing: {
  amount: string;
  date: string;
}): { minor: number; date: string } | null {
  const date = parseDate(closing.date);
  if ('reason' in date) return null;
  const amount = parseAmount(closing.amount);
  if (amount === 'amount_zero') return { minor: 0, date: date.date };
  if (typeof amount === 'string') return null;
  return { minor: amount.negative ? -amount.minor : amount.minor, date: date.date };
}
