import { ApiProperty } from '@nestjs/swagger';

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
  @ApiProperty({ enum: ['day', 'week', 'month', 'year'] })
  frequencyUnit!: 'day' | 'week' | 'month' | 'year';
  frequencyValue!: number;
  active!: boolean;
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
