import { IsIn, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { AccountNameField } from '../../common/dto-fields';
import { ISO_CURRENCY_CODES } from '../../common/currency';

export class CreateAccountDto {
  @IsInt()
  @Min(1)
  bankId!: number;

  @AccountNameField()
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
