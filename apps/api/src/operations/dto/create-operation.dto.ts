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

export class CreateOperationDto {
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
  // discarded server-side otherwise. No pairing/mirroring yet.
  @IsOptional()
  @IsInt()
  @Min(1)
  transferAccountId?: number;

  // Defaults to today (schema default) when omitted.
  @IsOptional()
  @IsDateString()
  valueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  reconciled?: boolean;
}
