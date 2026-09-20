// Single source of truth for which UI/email locales exist server-side —
// the `locale` pg enum (db/schema/enums.ts) and every DTO's LocaleField()
// (dto-fields.ts) derive from this tuple, so adding a language is one
// array edit plus a migration, not a value hand-copied across files.
export const SUPPORTED_LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
