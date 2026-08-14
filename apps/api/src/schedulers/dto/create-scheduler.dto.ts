import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSchedulerDto {
  @IsInt()
  @Min(1)
  accountId!: number;

  // Radio Debit / Credit; drives the debit/credit column exclusivity
  // and the server-side type-filtered category/payment-method validation.
  @IsIn(['debit', 'credit'])
  type!: 'debit' | 'credit';

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  thirdParty!: string;

  // Decimal money value, always positive; sign is derived from `type`
  // (÷10,000 boundary conversion happens server-side).
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  categoryId?: number;

  @IsInt()
  @Min(1)
  paymentMethodId!: number;

  // Visible/meaningful only when the payment method is a transfer method;
  // discarded server-side otherwise.
  @IsOptional()
  @IsInt()
  @Min(1)
  transferAccountId?: number;

  // First occurrence date.
  @IsDateString()
  valueDate!: string;

  @IsOptional()
  @IsString()
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
