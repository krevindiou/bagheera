import en from './locales/en';
import fr from './locales/fr';
import { SUPPORTED_LOCALES } from './locales';

// The loader's typing catches keys missing from fr.ts, not extra ones; this
// walks both trees and fails on any mismatch.
type Tree = { [key: string]: Tree | string | ((...args: never[]) => unknown) };

function keyPaths(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null ? keyPaths(value, path) : [path];
  });
}

describe('i18n locale catalogs stay in sync', () => {
  it('declares a catalog for every SUPPORTED_LOCALES entry', () => {
    expect(SUPPORTED_LOCALES).toContain('en');
    expect(SUPPORTED_LOCALES).toContain('fr');
  });

  it('fr has exactly the same key paths as en (no missing/extra translations)', () => {
    const enPaths = keyPaths(en).sort();
    const frPaths = keyPaths(fr).sort();
    expect(frPaths).toEqual(enPaths);
  });
});
