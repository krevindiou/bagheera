import { IsBoolean, IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { AmountField, NotesField, ThirdPartyField } from '../../common/dto-fields';

// accountId is shown read-only on the edit form but still submitted — the
// server rejects any attempt to actually move the operation to another
// account — an operation's account is immutable after creation.
export class UpdateOperationDto {
  @IsUUID('7')
  accountId!: string;

  @IsIn(['debit', 'credit'])
  type!: 'debit' | 'credit';

  @ThirdPartyField()
  thirdParty!: string;

  @AmountField()
  amount!: number;

  @IsOptional()
  @IsUUID('7')
  categoryId?: string;

  @IsUUID('7')
  paymentMethodId!: string;

  @IsOptional()
  @IsUUID('7')
  transferAccountId?: string;

  @IsDateString()
  valueDate!: string;

  @NotesField()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  reconciled?: boolean;
}
