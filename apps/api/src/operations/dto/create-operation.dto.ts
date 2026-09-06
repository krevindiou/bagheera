import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
} from 'class-validator';
import { NotesField, ThirdPartyField } from '../../common/dto-fields';

export class CreateOperationDto {
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
  // discarded server-side otherwise. No pairing/mirroring yet.
  @IsOptional()
  @IsUUID('7')
  transferAccountId?: string;

  // Defaults to today (schema default) when omitted.
  @IsOptional()
  @IsDateString()
  valueDate?: string;

  @NotesField()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  reconciled?: boolean;
}
