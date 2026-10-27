import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { FIELD_LIMITS, IMPORT_LIMITS, type EntryType } from '@bagheera/reference-data';
import type { InvalidReason, LabelOrigin, SuggestionOrigin } from './rows/types';

export class StartImportDto {
  @IsUUID('7')
  accountId!: string;
}

export class LabelChangeDto {
  @IsInt()
  @Min(1)
  @Max(IMPORT_LIMITS.MAX_ROWS)
  line!: number;

  // The rules of a third party apply when the preview reads it; this only
  // bounds the request.
  @IsString()
  @MaxLength(FIELD_LIMITS.SOURCE_LABEL)
  thirdParty!: string;

  // Keep the change for later imports.
  @IsBoolean()
  remember!: boolean;
}

export class PaymentMethodChangeDto {
  @IsInt()
  @Min(1)
  @Max(IMPORT_LIMITS.MAX_ROWS)
  line!: number;

  // Must suit the type of the row; checked when the preview reads it.
  @IsUUID('7')
  paymentMethodId!: string;
}

export class CategoryChangeDto {
  @IsInt()
  @Min(1)
  @Max(IMPORT_LIMITS.MAX_ROWS)
  line!: number;

  // Null removes the category. Must suit the type of the row; checked when the
  // preview reads it.
  @ValidateIf((change: CategoryChangeDto) => change.categoryId !== null)
  @IsUUID('7')
  categoryId!: string | null;
}

export class TransferAccountChangeDto {
  @IsInt()
  @Min(1)
  @Max(IMPORT_LIMITS.MAX_ROWS)
  line!: number;

  // Null means an external transfer. Must be an account that can take the
  // transfer; checked when the preview reads it.
  @ValidateIf((change: TransferAccountChangeDto) => change.accountId !== null)
  @IsUUID('7')
  accountId!: string | null;
}

export class PreviewImportDto {
  // The third parties the Member changed in the preview, one per line.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(IMPORT_LIMITS.MAX_ROWS)
  @ArrayUnique((change: LabelChangeDto) => change.line)
  @ValidateNested({ each: true })
  @Type(() => LabelChangeDto)
  labelChanges?: LabelChangeDto[];

  // The payment methods the Member picked for single rows in the preview,
  // one per line.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(IMPORT_LIMITS.MAX_ROWS)
  @ArrayUnique((change: PaymentMethodChangeDto) => change.line)
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodChangeDto)
  paymentMethodChanges?: PaymentMethodChangeDto[];

  // The categories the Member picked or removed for single rows in the
  // preview, one per line.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(IMPORT_LIMITS.MAX_ROWS)
  @ArrayUnique((change: CategoryChangeDto) => change.line)
  @ValidateNested({ each: true })
  @Type(() => CategoryChangeDto)
  categoryChanges?: CategoryChangeDto[];

  // The other account of a transfer, picked for single rows in the preview,
  // one per line.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(IMPORT_LIMITS.MAX_ROWS)
  @ArrayUnique((change: TransferAccountChangeDto) => change.line)
  @ValidateNested({ each: true })
  @Type(() => TransferAccountChangeDto)
  transferAccountChanges?: TransferAccountChangeDto[];
}

export class ConfirmImportDto extends PreviewImportDto {
  // The revision of the preview being confirmed.
  @IsString()
  @Matches(/^[0-9a-f]{64}$/)
  revision!: string;

  // Whether the operations imported are marked reconciled; they are when
  // absent.
  @IsOptional()
  @IsBoolean()
  reconcile?: boolean;

  // Whether the Member accepts importing a file that seems to come from
  // another account; required then, and what the account remembers of its file
  // is replaced.
  @IsOptional()
  @IsBoolean()
  acceptAccountMismatch?: boolean;

  // Skipped rows whose recorded operation is to be reconciled; lines that
  // are not such a row are ignored.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(IMPORT_LIMITS.MAX_ROWS)
  @IsInt({ each: true })
  @Min(1, { each: true })
  reconcileLines?: number[];

  // Skipped rows the Member chose to import anyway; other lines are ignored.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(IMPORT_LIMITS.MAX_ROWS)
  @IsInt({ each: true })
  @Min(1, { each: true })
  includedLines?: number[];
}

export class ImportUploadDto {
  importId!: string;
  rowCount!: number;
}

export class RecordedMatchDto {
  valueDate!: string;
  thirdParty!: string;
  // Whether that operation is reconciled already.
  reconciled!: boolean;
  // The bank reference, or else the date, amount and label, matched; or the
  // row is the other side of a transfer the account holds already.
  matchedBy!: 'reference' | 'details' | 'transfer';
}

export class ImportPreviewRowDto {
  line!: number;
  status!: 'import' | 'skipped' | 'invalid';
  valueDate!: string | null;
  type!: EntryType | null;
  // Major units, always positive; the sign comes from `type`.
  amount!: number | null;
  thirdParty!: string | null;
  // The file's own label, cut for display, when it differs from the third
  // party or the row is invalid; null otherwise.
  sourceLabel!: string | null;
  labelOrigin!: LabelOrigin | null;
  paymentMethodId!: string | null;
  // History when no type or label of the file named the payment method.
  paymentMethodOrigin!: SuggestionOrigin | null;
  // Suggested from the Member's earlier operations, or picked in the preview.
  categoryId!: string | null;
  categoryOrigin!: SuggestionOrigin | null;
  // The account the transfer goes to (a debit) or comes from (a credit).
  transferAccountId!: string | null;
  transferAccountOrigin!: SuggestionOrigin | null;
  reason!: InvalidReason | null;
  // The operation a skipped row matches.
  recorded!: RecordedMatchDto | null;
}

export class ClosingBalanceDto {
  date!: string;
  // Major units: what the statement closes with, and what the account would
  // hold on that date once the rows to import were recorded; null when the
  // account has no earlier operation to compare with.
  amount!: number;
  expected!: number | null;
}

export class StatementSummaryDto {
  periodStart!: string | null;
  periodEnd!: string | null;
  // Major units, always positive.
  debitTotal!: number;
  creditTotal!: number;
  closing!: ClosingBalanceDto | null;
  // Whether the file seems to come from this account.
  accountCheck!: 'unknown' | 'same' | 'different' | 'elsewhere';
  otherAccountId!: string | null;
}

export class ImportPreviewDto {
  importCount!: number;
  skippedCount!: number;
  invalidCount!: number;
  statement!: StatementSummaryDto;
  rows!: ImportPreviewRowDto[];
  // A mark of what the rows record; a confirmation names the one it saw.
  revision!: string;
}

export class ImportResultDto {
  importedCount!: number;
  skippedCount!: number;
  invalidCount!: number;
  // Label corrections created or replaced by this import.
  rememberedCount!: number;
  // Label corrections left out because the Member already holds the most allowed.
  notRememberedCount!: number;
  // Recorded operations the import reconciled.
  reconciledCount!: number;
  // True when this confirmation repeats one already carried out.
  alreadyImported!: boolean;
}
