import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { IMPORT_LIMITS } from '@bagheera/reference-data';
import { BusinessError } from '../../common/filters/business-error';
import { MONEY_SCALE } from '../../common/money';
import { AuditService } from '../../security/audit.service';
import { CryptoService } from '../../security/crypto.service';
import { AccountId, MemberId } from '../../security/ids';
import { OwnershipService } from '../../security/ownership.service';
import {
  ConfirmImportDto,
  ImportPreviewDto,
  ImportPreviewRowDto,
  ImportResultDto,
  ImportUploadDto,
  PreviewImportDto,
  StatementSummaryDto,
} from './import.dto';
import { invalidFile, readStatement } from './import.file';
import { ImportHistory } from './import.history';
import { ImportPicks } from './import.picks';
import { ImportStore } from './import.store';
import { ImportWriter } from './import.writer';
import type { OfxRow, OfxStatement } from './ofx';
import { parseBalance } from './rows/cell-values';
import { rememberedLabels, type LabelRules } from './rows/labels';
import { readRows } from './rows/read-rows';
import { markRecorded } from './rows/recorded-match';
import { accountMarkOf, revisionOf } from './rows/revision';
import { importedNetUpTo, totalsOf } from './rows/statement-summary';
import { withCategories, withPaymentMethods, withTransfers } from './rows/suggestions';
import type { ReadyRow, RowOutcome } from './rows/types';

export interface UploadedBankFile {
  buffer: Buffer;
  size: number;
}

function previewStale(): BusinessError {
  return new BusinessError(
    HttpStatus.CONFLICT,
    'import_preview_stale',
    'The operations changed since this preview was shown.',
  );
}

// The file's label is sent for display only, cut short; the full one stays on
// the server (the preview of 5,000 rows must stay small).
function displayLabel(label: string | null): string | null {
  if (!label) return null;
  const characters = Array.from(label);
  return characters.length <= IMPORT_LIMITS.PREVIEW_LABEL_CHARACTERS
    ? label
    : characters.slice(0, IMPORT_LIMITS.PREVIEW_LABEL_CHARACTERS).join('');
}

function toPreviewRow(row: RowOutcome): ImportPreviewRowDto {
  if (row.status === 'invalid') {
    return {
      line: row.line,
      status: 'invalid',
      valueDate: null,
      type: null,
      amount: null,
      thirdParty: null,
      sourceLabel: displayLabel(row.sourceLabel),
      labelOrigin: null,
      paymentMethodId: null,
      paymentMethodOrigin: null,
      categoryId: null,
      categoryOrigin: null,
      transferAccountId: null,
      transferAccountOrigin: null,
      reason: row.reason,
      recorded: null,
    };
  }
  return {
    line: row.line,
    status: row.status,
    valueDate: row.valueDate,
    type: row.type,
    amount: row.amount / MONEY_SCALE,
    thirdParty: row.thirdParty,
    sourceLabel: row.sourceLabel === row.thirdParty ? null : displayLabel(row.sourceLabel),
    labelOrigin: row.labelOrigin,
    paymentMethodId: row.paymentMethodId,
    paymentMethodOrigin: row.paymentMethodOrigin === 'default' ? null : row.paymentMethodOrigin,
    categoryId: row.categoryId,
    categoryOrigin: row.categoryOrigin,
    transferAccountId: row.transferAccountId,
    transferAccountOrigin: row.transferAccountOrigin,
    reason: null,
    recorded: row.recorded && {
      valueDate: row.recorded.valueDate,
      thirdParty: row.recorded.thirdParty,
      matchedBy: row.recorded.matchedBy,
      reconciled: row.recorded.reconciled,
    },
  };
}

interface Evaluated {
  accountId: string;
  account: { id: string };
  currency: string;
  rows: RowOutcome[];
  // The rows before they are matched with the account's operations, and the
  // mark of that matching, to do it again once the account is locked.
  unmarked: RowOutcome[];
  accountMark: string;
  source: OfxRow[];
  statement: OfxStatement;
  // The digests of what the file names of its account, the active key's first;
  // null when it names none.
  fingerprints: string[] | null;
  // A mark of the operations and corrections the rows are worked out from.
  revision: string;
}

/**
 * Bank file import: upload, preview, confirm. The file is read once, at
 * upload; what it holds lives only in ImportStore, for 30 minutes at most, and
 * an import is all-or-nothing.
 */
@Injectable()
export class ImportService {
  private readonly logger = new Logger('ImportService');

  constructor(
    private readonly ownership: OwnershipService,
    private readonly store: ImportStore,
    private readonly audit: AuditService,
    private readonly crypto: CryptoService,
    private readonly history: ImportHistory,
    private readonly writer: ImportWriter,
    private readonly picks: ImportPicks,
  ) {}

  async upload(
    memberId: MemberId,
    accountId: string,
    file: UploadedBankFile | undefined,
  ): Promise<ImportUploadDto> {
    const { account } = await this.ownership.requireOwnedFullyActiveAccount(
      accountId as AccountId,
      memberId,
    );

    if (!file || file.size === 0) throw invalidFile('The file is empty.');
    if (file.size > IMPORT_LIMITS.MAX_FILE_BYTES) {
      throw new BusinessError(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'import_file_too_large',
        'The file is too large.',
      );
    }

    const statement = readStatement(file.buffer);
    if (statement.rows.length === 0) throw invalidFile('The file holds no row.');
    if (statement.currency.toUpperCase() !== account.currency) {
      throw new BusinessError(
        HttpStatus.BAD_REQUEST,
        'import_statement_currency',
        'The statement is in another currency than the account.',
        { expected: account.currency, found: statement.currency },
      );
    }

    const importId = await this.store.save(memberId, accountId, statement);
    return { importId, rowCount: statement.rows.length };
  }

  async preview(
    memberId: MemberId,
    importId: string,
    dto: PreviewImportDto,
  ): Promise<ImportPreviewDto> {
    const evaluated = await this.evaluate(memberId, importId, dto);
    const { rows } = evaluated;
    return {
      importCount: rows.filter((row) => row.status === 'import').length,
      skippedCount: rows.filter((row) => row.status === 'skipped').length,
      invalidCount: rows.filter((row) => row.status === 'invalid').length,
      statement: await this.summarize(memberId, evaluated),
      rows: rows.map(toPreviewRow),
      revision: evaluated.revision,
    };
  }

  async confirm(
    memberId: MemberId,
    ip: string,
    importId: string,
    dto: ConfirmImportDto,
  ): Promise<ImportResultDto> {
    const confirmed = await this.store.loadOutcome(memberId, importId);
    if (confirmed) return { ...confirmed, alreadyImported: true };

    const lock = await this.store.lockConfirmation(memberId, importId);
    if (!lock) {
      throw new BusinessError(
        HttpStatus.CONFLICT,
        'import_in_progress',
        'This import is already being confirmed.',
      );
    }
    try {
      // The confirmation holding the lock may have finished between the first
      // look and this one.
      const finished = await this.store.loadOutcome(memberId, importId);
      if (finished) return { ...finished, alreadyImported: true };

      const evaluated = await this.evaluate(memberId, importId, dto);
      const { accountId, currency, rows, source, fingerprints } = evaluated;
      if (evaluated.revision !== dto.revision) throw previewStale();
      const { accountCheck } = await this.history.accountCheck(
        memberId,
        evaluated.account,
        fingerprints,
      );
      const mismatch = accountCheck === 'different' || accountCheck === 'elsewhere';
      if (mismatch && !dto.acceptAccountMismatch) {
        throw new BusinessError(
          HttpStatus.CONFLICT,
          'import_account_mismatch',
          'The file seems to come from another account.',
        );
      }
      const included = new Set(dto.includedLines ?? []);
      const toImport = rows.filter(
        (row): row is ReadyRow =>
          row.status === 'import' || (row.status === 'skipped' && included.has(row.line)),
      );
      const includedSkipped = toImport.filter((row) => row.status === 'skipped').length;
      // A row imported anyway reconciles nothing.
      const reconcileLines = new Set(dto.reconcileLines ?? []);
      const toReconcile = rows.flatMap((row) =>
        row.status === 'skipped' &&
        !included.has(row.line) &&
        reconcileLines.has(row.line) &&
        row.recorded &&
        !row.recorded.reconciled
          ? [
              {
                id: row.recorded.operationId,
                // The other side of a transfer takes the bank reference and
                // the label of its row, so the next import finds it by them.
                identity:
                  row.recorded.matchedBy === 'transfer'
                    ? {
                        bankReference: row.bankReference,
                        sourceLabel: row.sourceLabel === '' ? null : row.sourceLabel,
                      }
                    : null,
              },
            ]
          : [],
      );
      const outcome = {
        importedCount: toImport.length,
        skippedCount: rows.filter((row) => row.status === 'skipped').length - includedSkipped,
        invalidCount: rows.filter((row) => row.status === 'invalid').length,
        rememberedCount: 0,
        notRememberedCount: 0,
        reconciledCount: 0,
      };

      if (toImport.length > 0 || toReconcile.length > 0) {
        const intents = rememberedLabels(source, dto.labelChanges ?? []);
        const done = await this.writer.insertAll({
          accountId: accountId as AccountId,
          memberId,
          currency,
          rows: toImport,
          intents,
          fingerprint: fingerprints?.[0] ?? null,
          replaceFingerprint: mismatch,
          reconcile: dto.reconcile ?? true,
          reconcileOps: toReconcile,
          // The account's operations may have changed since they were read,
          // before it was locked.
          recheck: async (tx) => {
            const recorded = await this.history.recordedAround(accountId, evaluated.unmarked, tx);
            const mark = accountMarkOf(recorded, markRecorded(evaluated.unmarked, recorded));
            if (mark !== evaluated.accountMark) throw previewStale();
          },
        });
        outcome.rememberedCount = done.remembered;
        outcome.notRememberedCount = done.notRemembered;
        outcome.reconciledCount = done.reconciled;
        await this.afterRecording(() =>
          this.audit.record('operations_imported', memberId, ip, {
            accountId,
            imported: toImport.length,
            mirrored: toImport.filter((row) => row.transferAccountId !== null).length,
            reconciled: done.reconciled,
            remembered: done.remembered,
          }),
        );
      }
      // Also when nothing was created: confirming again answers the same.
      await this.afterRecording(() => this.store.saveOutcome(memberId, importId, outcome));
      await this.afterRecording(() => this.store.discard(memberId, importId));
      return { ...outcome, alreadyImported: false };
    } finally {
      // The lock expires by itself.
      await this.afterRecording(() => this.store.unlockConfirmation(memberId, importId, lock));
    }
  }

  // What is recorded stays recorded: a store that fails once the rows are in
  // must not turn the confirmation into an error.
  private async afterRecording(step: () => Promise<unknown>): Promise<void> {
    try {
      await step();
    } catch (err) {
      this.logger.error(`Import follow-up failed: ${(err as Error).message}`);
    }
  }

  async discard(memberId: MemberId, importId: string): Promise<void> {
    await this.store.discard(memberId, importId);
  }

  // Reads the held file with the Member's changes and marks what the account
  // already holds. The preview and the confirmation both run exactly this.
  private async evaluate(
    memberId: MemberId,
    importId: string,
    dto: PreviewImportDto,
  ): Promise<Evaluated> {
    const [pending, rules] = await Promise.all([
      this.store.load(memberId, importId),
      this.labelRules(memberId, dto),
    ]);
    if (!pending) {
      throw new BusinessError(
        HttpStatus.NOT_FOUND,
        'import_not_found',
        'This import is no longer available.',
      );
    }
    const { account: target } = await this.ownership.requireOwnedAccount(
      pending.accountId as AccountId,
      memberId,
    );

    const { statement } = pending;
    const source = statement.rows;
    const picks = new Map((dto.paymentMethodChanges ?? []).map((c) => [c.line, c.paymentMethodId]));
    const categoryPicks = new Map((dto.categoryChanges ?? []).map((c) => [c.line, c.categoryId]));
    const readWithDefaults = readRows(source, rules, picks);
    // None of these reads depends on a pick or a suggestion: they look rows up
    // by third party, value date and bank reference, which the picks never
    // change.
    const [methods, categories, transfers, recorded] = await Promise.all([
      this.history.methodUsage(memberId, readWithDefaults),
      this.history.categoryUsage(memberId, readWithDefaults),
      this.history.transferUsage(memberId, target, readWithDefaults),
      this.history.recordedAround(pending.accountId, readWithDefaults),
    ]);
    const read = withPaymentMethods(readWithDefaults, methods);
    await this.picks.requirePicksSuit(read, picks, categoryPicks);
    const categorized = withCategories(read, categories, categoryPicks);
    const transferPicks = new Map(
      (dto.transferAccountChanges ?? []).map((c) => [c.line, c.accountId]),
    );
    const transferred = withTransfers(categorized, transfers, transferPicks);
    await this.picks.requireTransferAccounts(memberId, target, transferred);
    const marked = markRecorded(transferred, recorded);
    return {
      accountId: pending.accountId,
      account: target,
      currency: target.currency,
      rows: marked,
      unmarked: transferred,
      accountMark: accountMarkOf(recorded, marked),
      source,
      statement,
      fingerprints: this.fingerprintsOf(memberId, statement),
      revision: revisionOf({
        corrections: rules.corrections,
        methods,
        categories,
        transfers,
        recorded,
        rows: marked,
      }),
    };
  }

  // What the file names of its account, as digests that cannot be read back
  // without the service's keys: the Member's own id keeps two Members' values
  // apart, and one digest is made for each key so that a rotation keeps the
  // fingerprints already remembered.
  private fingerprintsOf(memberId: string, statement: OfxStatement): string[] | null {
    if (!statement.accountRef) return null;
    const { bankId, accountId } = statement.accountRef;
    const normalize = (text: string) => text.replace(/\s+/g, '').toUpperCase();
    return this.crypto.digests(
      'statement-account',
      `${memberId}|${normalize(bankId)}|${normalize(accountId)}`,
    );
  }

  // The period and totals of the file, its closing balance against the
  // account's, and whether it seems to come from another account.
  private async summarize(memberId: MemberId, evaluated: Evaluated): Promise<StatementSummaryDto> {
    const { rows, statement, account: target, fingerprints } = evaluated;
    const totals = totalsOf(rows);
    const parsed = statement.closing ? parseBalance(statement.closing) : null;
    // Without earlier operations the account lacks the history the balance
    // depends on, so the two balances are not compared.
    const [accountCheck, expected] = await Promise.all([
      this.history.accountCheck(memberId, target, fingerprints),
      this.expectedBalance(target.id, parsed, totals.periodStart, rows),
    ]);
    // Banks write a zero when they have no balance to report, so a zero counts
    // as given only when the account holds a zero on that date too.
    const closing = parsed && (parsed.minor !== 0 || expected === 0) ? parsed : null;
    return {
      periodStart: totals.periodStart,
      periodEnd: totals.periodEnd,
      debitTotal: totals.debit / MONEY_SCALE,
      creditTotal: totals.credit / MONEY_SCALE,
      closing: closing
        ? {
            date: closing.date,
            amount: closing.minor / MONEY_SCALE,
            expected: expected === null ? null : expected / MONEY_SCALE,
          }
        : null,
      ...accountCheck,
    };
  }

  // What the account would hold on the closing date once the rows to import
  // were recorded; null when the file gives no closing balance or the account
  // has no earlier operation to compare with.
  private async expectedBalance(
    accountId: string,
    closing: { date: string } | null,
    periodStart: string | null,
    rows: RowOutcome[],
  ): Promise<number | null> {
    if (closing === null || periodStart === null) return null;
    if (!(await this.history.hasOperationBefore(accountId, periodStart))) return null;
    return (
      (await this.history.balanceUpTo(accountId, closing.date)) +
      importedNetUpTo(rows, closing.date)
    );
  }

  // The Member's remembered corrections and the changes made in this preview.
  private async labelRules(memberId: MemberId, dto: PreviewImportDto): Promise<LabelRules> {
    return {
      corrections: await this.history.corrections(memberId),
      changes: new Map((dto.labelChanges ?? []).map((change) => [change.line, change.thirdParty])),
    };
  }
}
