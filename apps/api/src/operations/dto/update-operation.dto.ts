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

// accountId is shown read-only on the edit form but still submitted — the
// server rejects any attempt to actually move the operation to another
// account — an operation's account is immutable after creation.
export class UpdateOperationDto {
  @IsInt()
  @Min(1)
  accountId!: number;

  @IsIn(['debit', 'credit'])
  type!: 'debit' | 'credit';

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  thirdParty!: string;

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

  @IsOptional()
  @IsInt()
  @Min(1)
  transferAccountId?: number;

  @IsDateString()
  valueDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  reconciled?: boolean;
}
