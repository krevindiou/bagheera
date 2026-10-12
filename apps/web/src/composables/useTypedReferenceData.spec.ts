import type { EntryType } from '@bagheera/reference-data';
import { nextTick, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { Category, PaymentMethod } from '../domain/referenceData';
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
    const type = ref<EntryType>('debit');
    const { filteredCategories, filteredPaymentMethods } = useTypedReferenceData(
      type,
      () => categories,
      () => paymentMethods,
    );
    expect(filteredCategories.value.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(filteredPaymentMethods.value.map((p) => p.id)).toEqual(['p1']);
  });

  it('excludes a null-type payment method (Initial balance) from either type', () => {
    const type = ref<EntryType>('credit');
    const { filteredPaymentMethods } = useTypedReferenceData(
      type,
      () => categories,
      () => paymentMethods,
    );
    expect(filteredPaymentMethods.value.some((p) => p.id === 'p3')).toBe(false);
  });

  it('offers every category and non-system payment method when type is undefined ("any")', () => {
    const type = ref<EntryType | undefined>(undefined);
    const { filteredCategories, filteredPaymentMethods } = useTypedReferenceData(
      type,
      () => categories,
      () => paymentMethods,
    );
    expect(filteredCategories.value.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    expect(filteredPaymentMethods.value.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('re-filters reactively when the type changes', () => {
    const type = ref<EntryType>('debit');
    const { filteredCategories } = useTypedReferenceData(
      type,
      () => categories,
      () => paymentMethods,
    );
    type.value = 'credit';
    expect(filteredCategories.value.map((c) => c.id)).toEqual(['c3']);
  });

  it('groups the filtered categories the same way groupCategories does', () => {
    const type = ref<EntryType>('debit');
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
    // setCategoryId/setPaymentMethodId stand in for vee-validate's
    // setValue: the composable must call them (with shouldValidate: false)
    // rather than assigning the refs directly, since a direct assignment
    // would run vee-validate's own validation on the field.
    function mismatchRefs(
      categoryValue: string | undefined,
      paymentMethodValue: string | undefined,
    ) {
      const categoryId = ref<string | undefined>(categoryValue);
      const paymentMethodId = ref<string | undefined>(paymentMethodValue);
      const setCategoryId = vi.fn((value: string | undefined) => {
        categoryId.value = value;
      });
      const setPaymentMethodId = vi.fn((value: string | undefined) => {
        paymentMethodId.value = value;
      });
      return { categoryId, setCategoryId, paymentMethodId, setPaymentMethodId };
    }

    it('clears a selected categoryId/paymentMethodId once the type switch invalidates them, without validating', async () => {
      const type = ref<EntryType>('debit');
      const refs = mismatchRefs('c1', 'p1');
      useTypedReferenceData(
        type,
        () => categories,
        () => paymentMethods,
        refs,
      );

      type.value = 'credit';
      await nextTick();

      expect(refs.categoryId.value).toBeUndefined();
      expect(refs.paymentMethodId.value).toBeUndefined();
      expect(refs.setCategoryId).toHaveBeenCalledWith(undefined, false);
      expect(refs.setPaymentMethodId).toHaveBeenCalledWith(undefined, false);
    });

    it('leaves an already-empty categoryId alone, without calling its setter', async () => {
      const type = ref<EntryType>('debit');
      const refs = mismatchRefs(undefined, 'p1');
      useTypedReferenceData(
        type,
        () => categories,
        () => paymentMethods,
        refs,
      );

      type.value = 'credit';
      await nextTick();

      expect(refs.categoryId.value).toBeUndefined();
      expect(refs.setCategoryId).not.toHaveBeenCalled();
    });

    it('leaves a still-matching value alone (type switches to "any" offers every category)', async () => {
      const type = ref<EntryType | undefined>('debit');
      const refs = mismatchRefs('c1', 'p1');
      useTypedReferenceData(
        type,
        () => categories,
        () => paymentMethods,
        refs,
      );

      type.value = undefined;
      await nextTick();

      expect(refs.categoryId.value).toBe('c1');
      expect(refs.setCategoryId).not.toHaveBeenCalled();
    });
  });
});
