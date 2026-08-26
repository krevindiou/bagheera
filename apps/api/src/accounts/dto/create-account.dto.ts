import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ISO_CURRENCY_CODES } from '../../common/currency';

export class CreateAccountDto {
  @IsInt()
  @Min(1)
  bankId!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  // ISO currency code, e.g. "USD".
  @IsIn(ISO_CURRENCY_CODES)
  currency!: string;

  // Decimal money value (÷10,000 boundary conversion happens server-side);
  // positive → opening credit, negative → opening debit, 0/omitted →
  // no opening operation.
  @IsOptional()
  @IsNumber()
  initialBalance?: number;
}
