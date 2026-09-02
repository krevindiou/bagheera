import { BankNameField } from '../../common/dto-fields';

export class UpdateBankDto {
  @BankNameField()
  name!: string;
}
