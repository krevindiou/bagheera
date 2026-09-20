import type { Locale } from '../../common/locale';
import en from './en';
import fr from './fr';

const catalogs = { en, fr } satisfies Record<Locale, typeof en>;

export function emailCatalog(locale: Locale = 'en') {
  return catalogs[locale];
}
