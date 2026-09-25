import { i18n } from './index';

// Payment methods and categories are seeded reference data stored in English
// (apps/api/src/db/seed-data.ts). Their display names are translated here by
// a slug of the seeded name — category ids are database-generated, so the
// name is the only stable key. Anything without a translation (or a future
// seed name not yet in the catalogs) falls back to the stored name.
function slug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}

export function referenceName(name: string): string {
  const key = `referenceData.${slug(name)}`;
  return i18n.global.te(key) ? i18n.global.t(key) : name;
}
