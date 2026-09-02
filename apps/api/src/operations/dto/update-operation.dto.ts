import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';
import { NotesField, ThirdPartyField } from '../../common/dto-fields';

// accountId is shown read-only on the edit form but still submitted — the
// server rejects any attempt to actually move the operation to another
// account — an operation's account is immutable after creation.
export class UpdateOperationDto {
  @IsInt()
  @Min(1)
  accountId!: number;

  @IsIn(['debit', 'credit'])
  type!: 'debit' | 'credit';

  @ThirdPartyField()
  thirdParty!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  categoryId?: number;

  @IsInt()
  @Min(1)
  paymentMethodId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  transferAccountId?: number;

  @IsDateString()
  valueDate!: string;

  @NotesField()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  reconciled?: boolean;
}
