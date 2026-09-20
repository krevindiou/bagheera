// Single source of truth for which UI locales exist client-side — mirrors
// apps/api/src/common/locale.ts's SUPPORTED_LOCALES exactly (the pg enum
// and every DTO's LocaleField() there derive from that copy). Adding a
// language means updating both arrays plus adding the two catalog files
// (this app's src/i18n/locales/<code>.ts and the API's
// email/i18n/<code>.ts).
export const SUPPORTED_LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

const STORAGE_KEY = 'bagheera.locale';

/**
 * A locale the visitor picked manually via the language switcher, for
 * whoever's viewing this browser right now — read back before the account
 * itself is known (signed out, or before `/auth/me` has resolved). An
 * authenticated member's actual preference lives server-side on
 * `member.locale` instead (see session.store.ts) and travels with the
 * account; this is only ever the anonymous/pre-fetch fallback, and the
 * signal that a locale was *chosen* rather than guessed (see router's
 * navigation guard).
 */
export function getStoredLocale(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isSupportedLocale(value) ? value : null;
  } catch {
    // Private browsing/blocked storage — no persisted choice, every visit
    // re-detects instead.
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
 * Best-guess locale for a first-time or signed-out visitor: a previously
 * stored manual choice first, else the browser's own language list, else
 * DEFAULT_LOCALE. Never throws — every step here is best-effort.
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
