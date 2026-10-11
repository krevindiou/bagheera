import { IsBoolean, IsIn, IsInt, IsOptional, IsPositive, IsUUID, Max } from 'class-validator';
import { AmountField, NotesField, ThirdPartyField, ValueDateField } from '../../common/dto-fields';
import {
  ENTRY_TYPES,
  FIELD_LIMITS,
  FREQUENCY_UNITS,
  type EntryType,
  type FrequencyUnit,
} from '@bagheera/reference-data';

// accountId is immutable but still submitted (read-only on the edit form);
// the service rejects any change.
export class UpdateSchedulerDto {
  @IsUUID('7')
  accountId!: string;

  @IsIn(ENTRY_TYPES)
  type!: EntryType;

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
  @IsIn(FREQUENCY_UNITS)
  frequencyUnit?: FrequencyUnit;

  // Capped: see CreateSchedulerDto.
  @IsInt()
  @IsPositive()
  @Max(FIELD_LIMITS.FREQUENCY_VALUE)
  frequencyValue!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
