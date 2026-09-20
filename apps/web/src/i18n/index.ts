import { createI18n } from 'vue-i18n';
import type { Ref } from 'vue';
import en from './locales/en';
import { DEFAULT_LOCALE, type Locale } from './locales';

// The shape every locale catalog must match — en.ts is the reference,
// fr.ts's parity is checked at build time by parity.spec.ts.
type MessageSchema = typeof en;

// Only `en` ships in the initial bundle; every other catalog is fetched on
// first use via loadLocaleMessages() below (called from the router's
// navigation guard once the active locale segment is known) so the bundle
// doesn't grow with every language this app adds.
const loaders: Record<Locale, () => Promise<{ default: MessageSchema }>> = {
  en: () => Promise.resolve({ default: en }),
  fr: () => import('./locales/fr'),
};

export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en },
});

// vue-i18n infers the available locales from the *keys of the eagerly-passed*
// `messages` map above — just `en`, since `fr` is lazy-loaded — not from the
// app's full `Locale` union. That leaves `i18n.global` statically typed as if
// only 'en' could ever be active; widen it back to `Locale` for the two spots
// below that add/activate a locale it didn't statically know about.
const global = i18n.global as unknown as {
  locale: Ref<Locale>;
  setLocaleMessage(locale: Locale, message: MessageSchema): void;
};

const loadedLocales = new Set<Locale>(['en']);

async function loadLocaleMessages(locale: Locale): Promise<void> {
  if (loadedLocales.has(locale)) return;
  const { default: messages } = await loaders[locale]();
  global.setLocaleMessage(locale, messages);
  loadedLocales.add(locale);
}

/** Loads (if needed) and activates `locale` — the one place the app's active language actually changes. */
export async function setLocale(locale: Locale): Promise<void> {
  await loadLocaleMessages(locale);
  // legacy: false → i18n.global.locale is a plain ref, not a magic setter.
  global.locale.value = locale;
  document.documentElement.setAttribute('lang', locale);
}
