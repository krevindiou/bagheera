import { IMPORT_LIMITS } from '@bagheera/reference-data';
import type { Composer } from 'vue-i18n';
import type { ConfirmResult } from './import.types';

/**
 * What the toast says once an import is confirmed: the counts, then a sentence
 * for each of the extras that happened. The locale gives the separator.
 */
export function importDoneMessage(t: Composer['t'], result: ConfirmResult): string {
  const parts = [
    t(
      'operations.import.done',
      {
        imported: result.importedCount,
        skipped: result.skippedCount,
        invalid: result.invalidCount,
      },
      result.importedCount,
    ),
  ];
  if (result.reconciledCount > 0) {
    parts.push(
      t(
        'operations.import.reconciledDone',
        { count: result.reconciledCount },
        result.reconciledCount,
      ),
    );
  }
  if (result.rememberedCount > 0) {
    parts.push(
      t(
        'operations.import.rememberedDone',
        { count: result.rememberedCount },
        result.rememberedCount,
      ),
    );
  }
  if (result.notRememberedCount > 0) {
    parts.push(
      t(
        'operations.import.notRememberedDone',
        { count: result.notRememberedCount, limit: IMPORT_LIMITS.MAX_LABEL_CORRECTIONS },
        result.notRememberedCount,
      ),
    );
  }
  return parts.join(t('operations.import.doneJoin'));
}
