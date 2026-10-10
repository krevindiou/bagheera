import { IsIn, IsUUID } from 'class-validator';
import { AccountNameField } from '../../common/dto-fields';
import { CURRENCY_CODES } from '../../common/currency';

// Bank and currency are immutable but still submitted (read-only on the
// edit form); the service rejects any change to them.
export class UpdateAccountDto {
  @AccountNameField()
  name!: string;

  @IsUUID('7')
  bankId!: string;

  @IsIn(CURRENCY_CODES)
  currency!: string;
}
