import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { AmountField, NotesField, ThirdPartyField, ValueDateField } from '../../common/dto-fields';

export class CreateOperationDto {
  @IsUUID('7')
  accountId!: string;

  // Decides the debit/credit column and the allowed category/payment method.
  @IsIn(['debit', 'credit'])
  type!: 'debit' | 'credit';

  @ThirdPartyField()
  thirdParty!: string;

  // Major units; the sign comes from `type`.
  @AmountField()
  amount!: number;

  @IsOptional()
  @IsUUID('7')
  categoryId?: string;

  @IsUUID('7')
  paymentMethodId!: string;

  // Only kept for a transfer payment method; discarded otherwise.
  @IsOptional()
  @IsUUID('7')
  transferAccountId?: string;

  // Defaults to today (schema default) when omitted.
  @IsOptional()
  @ValueDateField()
  valueDate?: string;

  @NotesField()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  reconciled?: boolean;
}
