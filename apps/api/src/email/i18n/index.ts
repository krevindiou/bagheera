import en from './en';

// Only English (`en`) is currently enabled.
const catalogs = { en };

export function emailCatalog(locale: keyof typeof catalogs = 'en') {
  return catalogs[locale];
}
