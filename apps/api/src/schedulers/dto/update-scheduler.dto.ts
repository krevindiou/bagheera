import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsUUID,
} from 'class-validator';
import {
  AmountField,
  NotesField,
  ThirdPartyField,
} from '../../common/dto-fields';

// accountId is shown read-only on the edit form but still submitted — the
// server rejects any attempt to actually move the scheduler to another
// account — a scheduler's account is immutable after creation.
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
