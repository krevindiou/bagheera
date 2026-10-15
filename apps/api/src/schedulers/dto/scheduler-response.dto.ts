import { FREQUENCY_UNITS, type FrequencyUnit } from '@bagheera/reference-data';
import { ApiProperty } from '@nestjs/swagger';
import type { Assert, SameKeys } from '../../common/dto/same-keys';
import type { scheduler } from '../../db/schema';

export class SchedulerDto {
  id!: string;
  accountId!: string;
  transferAccountId!: string | null;
  categoryId!: string | null;
  paymentMethodId!: string;
  thirdParty!: string;
  // Minor units (real value × 10,000); exactly one of debit/credit is set.
  debit!: number | null;
  credit!: number | null;
  valueDate!: string;
  reconciled!: boolean;
  notes!: string;
  limitDate!: string | null;
  @ApiProperty({ enum: FREQUENCY_UNITS })
  frequencyUnit!: FrequencyUnit;
  frequencyValue!: number;
  active!: boolean;
  // The next date generation will create an operation on (from the first
  // occurrence and what has been generated so far); null while paused or
  // once past the limit date.
  nextOccurrence!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class SchedulerListDto {
  @ApiProperty({ type: [SchedulerDto] })
  items!: SchedulerDto[];
  total!: number;
  page!: number;
  pageSize!: number;
}

export class SchedulerSavedResponseDto {
  message!: string;
  scheduler!: SchedulerDto;
}

export class SchedulerBatchDeleteResponseDto {
  message!: string;
  deletedCount!: number;
}

// See common/dto/same-keys.ts. lastGeneratedDate is kept out of every
// response; nextOccurrence is derived from it.
export type SchedulerDtoMatchesRow = Assert<
  SameKeys<
    Omit<SchedulerDto, 'nextOccurrence'>,
    Omit<typeof scheduler.$inferSelect, 'lastGeneratedDate'>
  >
>;
