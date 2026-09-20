import { createI18n } from 'vue-i18n';
import en from './locales/en';
import { DEFAULT_LOCALE, type Locale } from './locales';

// Only `en` ships in the initial bundle; every other catalog is fetched on
// first use via loadLocaleMessages() below (called from the router's
// navigation guard once the active locale segment is known) so the bundle
// doesn't grow with every language this app adds.
const loaders: Record<Locale, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => Promise.resolve({ default: en }),
  fr: () => import('./locales/fr'),
};

export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en },
});

const loadedLocales = new Set<Locale>(['en']);

async function loadLocaleMessages(locale: Locale): Promise<void> {
  if (loadedLocales.has(locale)) return;
  const { default: messages } = await loaders[locale]();
  i18n.global.setLocaleMessage(locale, messages);
  loadedLocales.add(locale);
}

/** Loads (if needed) and activates `locale` — the one place the app's active language actually changes. */
export async function setLocale(locale: Locale): Promise<void> {
  await loadLocaleMessages(locale);
  // legacy: false → i18n.global.locale is a plain ref, not a magic setter.
  i18n.global.locale.value = locale;
  document.documentElement.setAttribute('lang', locale);
}
