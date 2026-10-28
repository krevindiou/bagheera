import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IMPORT_LIMITS } from '@bagheera/reference-data';
import { MinorUnits } from '../../common/money';
import { DRIZZLE } from '../../db/db.constants';
import { accountStatement, labelCorrection, operation } from '../../db/schema';
import { AccountId, MemberId } from '../../security/ids';
import { requireFullyActiveLocked } from '../entry-rules';
import { TransferService } from '../transfer.service';
import { planLabelIntents, type LabelIntent } from './rows/labels';
import type { ReadyRow } from './rows/types';

// Operations adopting the identity of a row per statement.
const ADOPT_CHUNK = 500;

type Executor = Pick<NodePgDatabase, 'select' | 'insert' | 'update' | 'delete' | 'execute'>;

// A recorded operation to reconcile, with the identity of its row to keep when
// it is the other side of a transfer.
export interface ReconcileOp {
  id: string;
  identity: { bankReference: string | null; sourceLabel: string | null } | null;
}

/**
 * Records what an import confirms, all or nothing: the operations, the mirrors
 * of their transfers, the reconciliations and the label corrections.
 */
@Injectable()
export class ImportWriter {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly transfers: TransferService,
  ) {}

  // Records the operations, the mirrors of their transfers and the label
  // corrections together; returns how many corrections were created or
  // replaced, and how many the quota left out. `recheck` runs once the account is locked, before anything is
  // written: it throws when what the rows rest on changed in the meantime.
  async insertAll(input: {
    accountId: AccountId;
    memberId: MemberId;
    currency: string;
    rows: ReadyRow[];
    intents: LabelIntent[];
    fingerprint: string | null;
    replaceFingerprint: boolean;
    reconcile: boolean;
    reconcileOps: ReconcileOp[];
    recheck: (tx: Executor) => Promise<void>;
  }): Promise<{ remembered: number; notRemembered: number; reconciled: number }> {
    const {
      accountId,
      memberId,
      currency,
      rows,
      intents,
      fingerprint,
      replaceFingerprint,
      reconcile,
      reconcileOps,
    } = input;
    return this.db.transaction(async (tx) => {
      await requireFullyActiveLocked(tx, accountId);
      await input.recheck(tx);
      // The first file that names its account is what later ones are compared
      // with; a later import replaces it only when the Member accepted a
      // mismatch, so a wrong first file does not stay the reference.
      if (fingerprint !== null) {
        const remembering = tx.insert(accountStatement).values({ accountId, fingerprint });
        await (replaceFingerprint
          ? remembering.onConflictDoUpdate({
              target: accountStatement.accountId,
              set: { fingerprint },
            })
          : remembering.onConflictDoNothing());
      }
      const { remembered, notRemembered } = await this.applyLabelIntents(tx, memberId, intents);

      const valuesOf = (row: ReadyRow) => ({
        accountId,
        thirdParty: row.thirdParty,
        sourceLabel: row.sourceLabel === '' ? null : row.sourceLabel,
        bankReference: row.bankReference,
        debit: row.type === 'debit' ? (row.amount as MinorUnits) : null,
        credit: row.type === 'credit' ? (row.amount as MinorUnits) : null,
        valueDate: row.valueDate,
        notes: row.notes,
        paymentMethodId: row.paymentMethodId,
        categoryId: row.categoryId,
        reconciled: reconcile,
      });
      await this.transfers.insertManyWithMirrors(
        tx,
        rows.map((row) => ({ ...valuesOf(row), transferAccountId: row.transferAccountId })),
        { sourceAccountId: accountId, sourceCurrency: currency, memberId },
      );

      // Only the flag changes, and only on an operation of this account that
      // is not reconciled yet; the other side of a transfer also takes the
      // identity of its row.
      let reconciled = 0;
      const withoutIdentity = reconcileOps.filter((op) => op.identity === null).map((op) => op.id);
      if (withoutIdentity.length > 0) {
        const done = await tx
          .update(operation)
          .set({ reconciled: true })
          .where(
            and(
              inArray(operation.id, withoutIdentity),
              eq(operation.accountId, accountId),
              eq(operation.reconciled, false),
            ),
          )
          .returning({ id: operation.id });
        reconciled += done.length;
      }
      const withIdentity = reconcileOps.flatMap((op) =>
        op.identity === null ? [] : [{ id: op.id, ...op.identity }],
      );
      for (let start = 0; start < withIdentity.length; start += ADOPT_CHUNK) {
        // Each operation takes its own values, so the update joins them in;
        // raw SQL does not stamp updated_at the way the builder does.
        const done = await tx.execute(sql`
          update ${operation}
          set reconciled = true,
              bank_reference = adopted.bank_reference,
              source_label = adopted.source_label,
              updated_at = now()
          from (values ${sql.join(
            withIdentity
              .slice(start, start + ADOPT_CHUNK)
              .map(
                (op) =>
                  sql`(${op.id}::uuid, ${op.bankReference}::varchar, ${op.sourceLabel}::varchar)`,
              ),
            sql`, `,
          )}) as adopted(id, bank_reference, source_label)
          where ${operation.id} = adopted.id
            and ${operation.accountId} = ${accountId}
            and ${operation.reconciled} = false`);
        reconciled += done.rowCount ?? 0;
      }
      return { remembered, notRemembered, reconciled };
    });
  }

  private async applyLabelIntents(
    tx: Executor,
    memberId: MemberId,
    intents: LabelIntent[],
  ): Promise<{ remembered: number; notRemembered: number }> {
    if (intents.length === 0) return { remembered: 0, notRemembered: 0 };
    // Two imports of one Member must not both fit under the quota.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${memberId}, 0))`);
    const existing = await tx
      .select()
      .from(labelCorrection)
      .where(eq(labelCorrection.memberId, memberId));
    const { deletes, updates, inserts, notRemembered } = planLabelIntents(
      existing,
      intents,
      IMPORT_LIMITS.MAX_LABEL_CORRECTIONS,
    );

    if (deletes.length > 0) {
      await tx.delete(labelCorrection).where(inArray(labelCorrection.id, deletes));
    }
    for (const change of updates) {
      await tx
        .update(labelCorrection)
        .set({ thirdParty: change.thirdParty })
        .where(eq(labelCorrection.id, change.id));
    }
    if (inserts.length > 0) {
      await tx.insert(labelCorrection).values(
        inserts.map((intent) => ({
          memberId,
          sourceLabel: intent.sourceLabel,
          thirdParty: intent.thirdParty as string,
        })),
      );
    }
    return { remembered: inserts.length + updates.length, notRemembered };
  }
}
