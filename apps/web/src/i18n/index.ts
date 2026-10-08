import { createI18n } from 'vue-i18n';
import type { Ref } from 'vue';
import en from './locales/en';
import { DEFAULT_LOCALE, type Locale } from './locales';

// The shape every catalog must match (parity.spec.ts checks fr.ts).
type MessageSchema = typeof en;

// Only `en` ships in the initial bundle; other catalogs load on first use.
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

// vue-i18n types the locales from the eager `messages` keys (just `en`);
// widen to `Locale` for the lazy ones.
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
