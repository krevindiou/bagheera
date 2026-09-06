import { IsOptional, IsUUID } from 'class-validator';
import { BankNameField } from '../../common/dto-fields';

// The bank-choice form offers two mutually exclusive options:
// pick an existing active bank (`bankId`) or type a new name (`name`).
export class ChooseBankDto {
  @IsOptional()
  @IsUUID('7')
  bankId?: string;

  @IsOptional()
  @BankNameField()
  name?: string;
}
