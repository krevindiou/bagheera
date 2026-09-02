import { IsIn, IsInt, Min } from 'class-validator';
import { AccountNameField } from '../../common/dto-fields';
import { ISO_CURRENCY_CODES } from '../../common/currency';

// Bank and currency are shown read-only on the edit form but still
// submitted — the server rejects any attempt to actually change them
// — an account's bank is immutable after creation.
export class UpdateAccountDto {
  @AccountNameField()
  name!: string;

  @IsInt()
  @Min(1)
  bankId!: number;

  @IsIn(ISO_CURRENCY_CODES)
  currency!: string;
}
