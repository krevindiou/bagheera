import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { AccountNameField, SignedAmountField } from '../../common/dto-fields';
import { CURRENCY_CODES } from '../../common/currency';

export class CreateAccountDto {
  @IsUUID('7')
  bankId!: string;

  @AccountNameField()
  name!: string;

  @IsIn(CURRENCY_CODES)
  currency!: string;

  // Major units. Positive → opening credit, negative → opening debit,
  // 0/omitted → no opening operation.
  @IsOptional()
  @SignedAmountField()
  initialBalance?: number;
}
