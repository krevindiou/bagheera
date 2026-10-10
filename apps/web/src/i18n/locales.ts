import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@bagheera/reference-data';

// A new language needs src/i18n/locales/<code>.ts too.
export { DEFAULT_LOCALE, SUPPORTED_LOCALES };
export type { Locale };

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

const STORAGE_KEY = 'bagheera.locale';

/**
 * A locale picked in the language switcher on this browser: the fallback
 * before the member is known (their own is `member.locale`), and the sign
 * that a locale was chosen rather than guessed.
 */
export function getStoredLocale(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isSupportedLocale(value) ? value : null;
  } catch {
    // Blocked storage.
    return null;
  }
}

export function setStoredLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage blocked — the choice just won't survive a reload.
  }
}

/**
 * For a visitor not yet known: the stored choice, else the browser's
 * languages, else DEFAULT_LOCALE. Never throws.
 */
export function detectLocale(): Locale {
  const stored = getStoredLocale();
  if (stored) return stored;

  for (const tag of navigator.languages ?? [navigator.language]) {
    try {
      const language = new Intl.Locale(tag).language;
      if (isSupportedLocale(language)) return language;
    } catch {
      // Unparsable tag — try the next one in the list.
    }
  }

  return DEFAULT_LOCALE;
}
