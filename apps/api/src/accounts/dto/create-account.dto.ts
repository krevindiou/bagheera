import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateAccountDto {
  @IsInt()
  @Min(1)
  bankId!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  // ISO currency code, e.g. "USD".
  @IsString()
  @Length(3, 3)
  currency!: string;

  // Decimal money value (÷10,000 boundary conversion happens server-side);
  // positive → opening credit, negative → opening debit, 0/omitted →
  // no opening operation.
  @IsOptional()
  @IsNumber()
  initialBalance?: number;
}
