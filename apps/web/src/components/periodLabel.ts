import type { Locale } from '../i18n/locales';

// Shared x-axis label formatting for every chart keyed by report period
// (SynthesisChart's line series, RankedChart's stacked bars) — a
// stored period is an ISO date string ('YYYY-MM-DD') or any parseable
// 'YYYY-MM...' string. Month renders as a locale-aware short name (e.g.
// 'Sep' / 'sept.') rather than a raw number, since a bare digit needs the
// reader to already know month-number conventions, a short name doesn't.
export function formatPeriodLabel(period: string, locale: Locale): string {
  const [year, month] = period.split('-');
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  const monthName = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(
    date,
  );
  return `${monthName} ${year}`;
}
