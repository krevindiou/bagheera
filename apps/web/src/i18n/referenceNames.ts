import { i18n } from './index';

// Reference data is stored in English; translated by a slug of the name
// (category ids are database-generated), falling back to the name itself.
function slug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}

export function referenceName(name: string): string {
  const key = `referenceData.${slug(name)}`;
  return i18n.global.te(key) ? i18n.global.t(key) : name;
}
