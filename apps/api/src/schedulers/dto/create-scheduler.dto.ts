import { IsBoolean, IsIn, IsInt, IsOptional, IsPositive, IsUUID, Max } from 'class-validator';
import { AmountField, NotesField, ThirdPartyField, ValueDateField } from '../../common/dto-fields';
import { ENTRY_TYPES } from '@bagheera/reference-data';
import { frequencyUnitEnum } from '../../db/schema/enums';

export class CreateSchedulerDto {
  @IsUUID('7')
  accountId!: string;

  // Decides the debit/credit column and the allowed category/payment method.
  @IsIn(ENTRY_TYPES)
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

  // First occurrence date.
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
  @IsIn(frequencyUnitEnum.enumValues)
  frequencyUnit?: 'day' | 'week' | 'month' | 'year';

  // Capped: a huge interval pushes occurrences past year 9999, where the
  // string comparison ending dueOccurrences() breaks.
  @IsInt()
  @IsPositive()
  @Max(100)
  frequencyValue!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
