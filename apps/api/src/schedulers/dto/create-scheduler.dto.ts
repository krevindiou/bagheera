import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsUUID,
  Max,
} from 'class-validator';
import {
  AmountField,
  NotesField,
  ThirdPartyField,
} from '../../common/dto-fields';

export class CreateSchedulerDto {
  @IsUUID('7')
  accountId!: string;

  // Radio Debit / Credit; drives the debit/credit column exclusivity
  // and the server-side type-filtered category/payment-method validation.
  @IsIn(['debit', 'credit'])
  type!: 'debit' | 'credit';

  @ThirdPartyField()
  thirdParty!: string;

  // Decimal money value; sign is derived from `type` (÷10,000 boundary
  // conversion happens server-side).
  @AmountField()
  amount!: number;

  @IsOptional()
  @IsUUID('7')
  categoryId?: string;

  @IsUUID('7')
  paymentMethodId!: string;

  // Visible/meaningful only when the payment method is a transfer method;
  // discarded server-side otherwise.
  @IsOptional()
  @IsUUID('7')
  transferAccountId?: string;

  // First occurrence date.
  @IsDateString()
  valueDate!: string;

  @NotesField()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  reconciled?: boolean;

  @IsOptional()
  @IsDateString()
  limitDate?: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month', 'year'])
  frequencyUnit?: 'day' | 'week' | 'month' | 'year';

  // Upper-bounded, not just positive: generation/interval.ts's date
  // arithmetic assumes occurrence dates stay well within JS `Date`'s
  // representable range — an unbounded value (paired with 'month'/'year')
  // can push a generated date past that range, corrupting the ISO-string
  // comparison dueOccurrences() relies on to terminate correctly. 100 is
  // already far beyond any real recurrence.
  @IsInt()
  @IsPositive()
  @Max(100)
  frequencyValue!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
