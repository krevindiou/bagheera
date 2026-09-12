import { nextTick, ref } from 'vue';
import { describe, expect, it } from 'vitest';
import type { Category, PaymentMethod } from '../pages/operations/operations.types';
import { useTypedReferenceData } from './useTypedReferenceData';

const categories: Category[] = [
  { id: 'c1', parentId: null, type: 'debit', name: 'Food' },
  { id: 'c2', parentId: 'c1', type: 'debit', name: 'Groceries' },
  { id: 'c3', parentId: null, type: 'credit', name: 'Salary' },
];
const paymentMethods: PaymentMethod[] = [
  { id: 'p1', name: 'Cash', type: 'debit' },
  { id: 'p2', name: 'Deposit', type: 'credit' },
  { id: 'p3', name: 'Initial balance', type: null },
];

describe('useTypedReferenceData', () => {
  it('filters categories and payment methods to the selected type', () => {
    const type = ref<'debit' | 'credit'>('debit');
    const { filteredCategories, filteredPaymentMethods } = useTypedReferenceData(
      type,
      () => categories,
      () => paymentMethods,
    );
    expect(filteredCategories.value.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(filteredPaymentMethods.value.map((p) => p.id)).toEqual(['p1']);
  });

  it('excludes a null-type payment method (Initial balance) from either type', () => {
    const type = ref<'debit' | 'credit'>('credit');
    const { filteredPaymentMethods } = useTypedReferenceData(
      type,
      () => categories,
      () => paymentMethods,
    );
    expect(filteredPaymentMethods.value.some((p) => p.id === 'p3')).toBe(false);
  });

  it('re-filters reactively when the type changes', () => {
    const type = ref<'debit' | 'credit'>('debit');
    const { filteredCategories } = useTypedReferenceData(
      type,
      () => categories,
      () => paymentMethods,
    );
    type.value = 'credit';
    expect(filteredCategories.value.map((c) => c.id)).toEqual(['c3']);
  });

  it('groups the filtered categories the same way groupCategories does', () => {
    const type = ref<'debit' | 'credit'>('debit');
    const { groupedCategories } = useTypedReferenceData(
      type,
      () => categories,
      () => paymentMethods,
    );
    expect(groupedCategories.value).toEqual([
      { label: 'Food', categories: [categories[0], categories[1]] },
    ]);
  });

  describe('clearOnMismatch', () => {
    it('clears a selected categoryId/paymentMethodId once the type switch invalidates them', async () => {
      const type = ref<'debit' | 'credit'>('debit');
      const categoryId = ref<string | undefined>('c1');
      const paymentMethodId = ref<string>('p1');
      useTypedReferenceData(
        type,
        () => categories,
        () => paymentMethods,
        {
          categoryId,
          paymentMethodId,
        },
      );

      type.value = 'credit';
      await nextTick();

      expect(categoryId.value).toBeUndefined();
      expect(paymentMethodId.value).toBeUndefined();
    });

    it('leaves an already-empty categoryId alone', async () => {
      const type = ref<'debit' | 'credit'>('debit');
      const categoryId = ref<string | undefined>(undefined);
      const paymentMethodId = ref<string>('p1');
      useTypedReferenceData(
        type,
        () => categories,
        () => paymentMethods,
        {
          categoryId,
          paymentMethodId,
        },
      );

      type.value = 'credit';
      await nextTick();

      expect(categoryId.value).toBeUndefined();
    });
  });
});
