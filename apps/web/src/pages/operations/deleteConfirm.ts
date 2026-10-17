import type { Operation } from '../../domain/referenceData';

// Deleting one side of a transfer leaves its counterpart in the other
// account, turned into an external operation, so the confirmation says so.
export function deleteConfirmKey(operations: Operation[]): string {
  return operations.some((operation) => operation.transferOperationId !== null)
    ? 'operations.batch.confirmDeleteTransfers'
    : 'operations.batch.confirmDelete';
}
