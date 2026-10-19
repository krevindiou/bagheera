import { i18n } from './index';

export type ReferenceKind = 'paymentMethods' | 'categories';

// Reference data is stored in English; translated by a slug of the name
// (category ids are database-generated), falling back to the name itself.
// Payment methods and categories have their own key space: both lists can
// hold the same name ("Transfer", "Check").
function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function referenceName(kind: ReferenceKind, name: string): string {
  const key = `referenceData.${kind}.${slug(name)}`;
  return i18n.global.te(key) ? i18n.global.t(key) : name;
}
