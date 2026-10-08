import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { AmountField, NotesField, ThirdPartyField, ValueDateField } from '../../common/dto-fields';

// accountId is immutable but still submitted (read-only on the edit form);
// the service rejects any change.
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

  @ValueDateField()
  valueDate!: string;

  @NotesField()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  reconciled?: boolean;
}
