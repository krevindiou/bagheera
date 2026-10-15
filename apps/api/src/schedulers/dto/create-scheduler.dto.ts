import { IsBoolean, IsIn, IsInt, IsOptional, IsPositive, IsUUID, Max } from 'class-validator';
import {
  AmountField,
  IsOnOrAfter,
  NotesField,
  ThirdPartyField,
  ValueDateField,
} from '../../common/dto-fields';
import {
  ENTRY_TYPES,
  FIELD_LIMITS,
  FREQUENCY_UNITS,
  type EntryType,
  type FrequencyUnit,
} from '@bagheera/reference-data';

export class CreateSchedulerDto {
  @IsUUID('7')
  accountId!: string;

  // Decides the debit/credit column and the allowed category/payment method.
  @IsIn(ENTRY_TYPES)
  type!: EntryType;

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

  // An inverted pair would stop the scheduler before it ever runs.
  @IsOptional()
  @ValueDateField()
  @IsOnOrAfter('valueDate')
  limitDate?: string;

  @IsOptional()
  @IsIn(FREQUENCY_UNITS)
  frequencyUnit?: FrequencyUnit;

  // Capped: a huge interval pushes occurrences past year 9999, where the
  // string comparison ending dueOccurrences() breaks.
  @IsInt()
  @IsPositive()
  @Max(FIELD_LIMITS.FREQUENCY_VALUE)
  frequencyValue!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
