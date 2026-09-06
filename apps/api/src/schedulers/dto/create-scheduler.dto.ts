import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
} from 'class-validator';
import { NotesField, ThirdPartyField } from '../../common/dto-fields';

export class CreateSchedulerDto {
  @IsUUID('7')
  accountId!: string;

  // Radio Debit / Credit; drives the debit/credit column exclusivity
  // and the server-side type-filtered category/payment-method validation.
  @IsIn(['debit', 'credit'])
  type!: 'debit' | 'credit';

  @ThirdPartyField()
  thirdParty!: string;

  // Decimal money value, always positive; sign is derived from `type`
  // (÷10,000 boundary conversion happens server-side).
  @IsNumber()
  @IsPositive()
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

  @IsInt()
  @IsPositive()
  frequencyValue!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
