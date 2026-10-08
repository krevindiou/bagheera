import type { Locale } from '../i18n/locales';

// X-axis label for a 'YYYY-MM...' period: localized short month and year
// (e.g. 'Sep 2026' / 'sept. 2026').
export function formatPeriodLabel(period: string, locale: Locale): string {
  const [year, month] = period.split('-');
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  const monthName = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(
    date,
  );
  return `${monthName} ${year}`;
}
