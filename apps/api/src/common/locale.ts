// Source of truth for UI/email locales: the `locale` pg enum and
// LocaleField() derive from it. Adding one needs a migration too.
export const SUPPORTED_LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
