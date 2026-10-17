import type { PeriodGrouping } from '@bagheera/reference-data';
import { i18n } from '../i18n';
import type { Locale } from '../i18n/locales';

// vue-i18n types `locale` from the eager catalogs (just 'en'); widen it to
// the lazy ones, as i18n/index.ts does.
const translate = i18n.global.t as unknown as (
  key: string,
  named: Record<string, string | number>,
  options: { locale: Locale },
) => string;

// X-axis label for a 'YYYY-MM...' period start, by the bucket size it opens:
// '2026' for a year, 'Q1 2026' / 'T1 2026' for a quarter, otherwise the
// localized short month and year ('Sep 2026' / 'sept. 2026'). 'all' is a
// single bucket dated to a month, so it reads like one.
export function formatPeriodLabel(
  period: string,
  locale: Locale,
  grouping: PeriodGrouping = 'month',
): string {
  const [year, month] = period.split('-');
  if (grouping === 'year') {
    return year;
  }
  if (grouping === 'quarter') {
    const quarter = Math.floor((Number(month) - 1) / 3) + 1;
    return translate('reports.quarterLabel', { quarter, year }, { locale });
  }
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  const monthName = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(
    date,
  );
  return `${monthName} ${year}`;
}
