import { IsIn, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { AccountNameField } from '../../common/dto-fields';
import { ISO_CURRENCY_CODES } from '../../common/currency';

export class CreateAccountDto {
  @IsUUID('7')
  bankId!: string;

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
