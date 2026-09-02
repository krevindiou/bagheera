import { IsInt, IsOptional, Min } from 'class-validator';
import { BankNameField } from '../../common/dto-fields';

// The bank-choice form offers two mutually exclusive options:
// pick an existing active bank (`bankId`) or type a new name (`name`).
export class ChooseBankDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  bankId?: number;

  @IsOptional()
  @BankNameField()
  name?: string;
}
