import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from './index';
import { referenceName } from './referenceNames';

describe('referenceName', () => {
  afterEach(() => {
    void setLocale('en');
  });

  it('translates a seeded name by its slug', async () => {
    await setLocale('fr');
    expect(referenceName('paymentMethods', 'Credit card')).toBe('Carte bancaire');
    expect(referenceName('categories', 'Other expense')).toBe('Autres dépenses');
  });

  it('translates names holding punctuation by their alphanumeric slug', async () => {
    await setLocale('fr');
    expect(referenceName('categories', 'Taxi and ride-hailing')).toBe('Taxi et VTC');
    expect(referenceName('categories', 'Self-employment income')).toBe(
      'Revenus d’activité indépendante',
    );
  });

  it('looks a name up only in its own kind', async () => {
    await setLocale('fr');
    expect(referenceName('paymentMethods', 'Transfer')).toBe('Virement');
    expect(referenceName('categories', 'Transfer')).toBe('Transfer');
  });

  it('keeps the stored name when there is no translation', () => {
    expect(referenceName('categories', 'Brand new category')).toBe('Brand new category');
  });
});
