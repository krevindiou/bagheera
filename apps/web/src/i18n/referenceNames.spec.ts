import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from './index';
import { referenceName } from './referenceNames';

describe('referenceName', () => {
  afterEach(() => {
    void setLocale('en');
  });

  it('translates a seeded name by its slug', async () => {
    await setLocale('fr');
    expect(referenceName('Credit card')).toBe('Carte bancaire');
    expect(referenceName('Other expense')).toBe('Autres dépenses');
  });

  it('keeps the stored name when there is no translation', () => {
    expect(referenceName('Brand new category')).toBe('Brand new category');
  });
});
