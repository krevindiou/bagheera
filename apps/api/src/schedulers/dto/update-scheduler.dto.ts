import { IsBoolean, IsIn, IsInt, IsOptional, IsPositive, IsUUID, Max } from 'class-validator';
import { AmountField, NotesField, ThirdPartyField, ValueDateField } from '../../common/dto-fields';

// accountId is immutable but still submitted (read-only on the edit form);
// the service rejects any change.
export class UpdateSchedulerDto {
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

  @IsOptional()
  @ValueDateField()
  limitDate?: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month', 'year'])
  frequencyUnit?: 'day' | 'week' | 'month' | 'year';

  // Capped: see CreateSchedulerDto.
  @IsInt()
  @IsPositive()
  @Max(100)
  frequencyValue!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
