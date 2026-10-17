import { describe, expect, it } from 'vitest';
import type { Operation } from '../../domain/referenceData';
import { deleteConfirmKey } from './deleteConfirm';

function operation(transferOperationId: string | null): Operation {
  return { id: 'o1', transferOperationId } as Operation;
}

describe('deleteConfirmKey', () => {
  it('uses the plain wording without a transfer', () => {
    expect(deleteConfirmKey([operation(null), operation(null)])).toBe(
      'operations.batch.confirmDelete',
    );
  });

  it('uses the transfer wording as soon as one operation is a transfer', () => {
    expect(deleteConfirmKey([operation(null), operation('o2')])).toBe(
      'operations.batch.confirmDeleteTransfers',
    );
  });
});
