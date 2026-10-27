import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BusinessError } from '../../common/filters/business-error';
import { DRIZZLE } from '../../db/db.constants';
import { MemberId } from '../../security/ids';
import { TransferService } from '../transfer.service';
import { ImportHistory } from './import.history';
import type { RowOutcome } from './rows/types';

/** Checks what the Member picked in the preview against the rows it applies to. */
@Injectable()
export class ImportPicks {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly history: ImportHistory,
    private readonly transfers: TransferService,
  ) {}

  // The accounts chosen for transfers must be able to take them, the same rules as for an operation entered by hand.
  async requireTransferAccounts(
    memberId: MemberId,
    importedInto: { id: string; currency: string },
    rows: RowOutcome[],
  ) {
    const chosen = new Set(
      rows.flatMap((row) =>
        row.status !== 'invalid' && row.transferAccountId !== null ? [row.transferAccountId] : [],
      ),
    );
    for (const targetAccountId of chosen) {
      await this.transfers.requireEligibleTarget(this.db, targetAccountId, {
        sourceAccountId: importedInto.id,
        sourceCurrency: importedInto.currency,
        memberId,
      });
    }
  }

  // A payment method or category picked for a row must exist and suit the
  // row's type; a line that is no readable row has nothing to apply it to.
  async requirePicksSuit(
    rows: RowOutcome[],
    methodPicks: ReadonlyMap<number, string>,
    categoryPicks: ReadonlyMap<number, string | null>,
  ) {
    const typeOfRow = new Map(
      rows.flatMap((row) => (row.status === 'invalid' ? [] : [[row.line, row.type] as const])),
    );
    if (methodPicks.size > 0) {
      const typeOfMethod = await this.history.paymentMethodTypes([
        ...new Set(methodPicks.values()),
      ]);
      for (const [line, id] of methodPicks) {
        const rowType = typeOfRow.get(line);
        if (rowType !== undefined && typeOfMethod.get(id) !== rowType) {
          throw new BusinessError(
            HttpStatus.BAD_REQUEST,
            'payment_method_invalid',
            'Invalid payment method for this type.',
          );
        }
      }
    }

    const categoryIds = [...new Set([...categoryPicks.values()].flatMap((id) => (id ? [id] : [])))];
    if (categoryIds.length > 0) {
      const typeOfCategory = await this.history.categoryTypes(categoryIds);
      for (const [line, id] of categoryPicks) {
        const rowType = typeOfRow.get(line);
        if (id !== null && rowType !== undefined && typeOfCategory.get(id) !== rowType) {
          throw new BusinessError(
            HttpStatus.BAD_REQUEST,
            'category_invalid',
            'Invalid category for this type.',
          );
        }
      }
    }
  }
}
