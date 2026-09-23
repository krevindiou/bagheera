import { AMOUNT_CEILING } from '@bagheera/money';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ThirdPartyField, ValueDateField } from '../../common/dto-fields';

export class AmountComparatorDto {
  @IsIn(['gt', 'gte', 'lt', 'lte', 'eq'])
  operator!: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';

  // Not routed through AmountField(): a filter threshold, not a stored
  // amount — 0 (and, harmlessly, negative) stays a legal comparator value
  // here, unlike an actual operation/scheduler amount. Only the same
  // overflow-safety ceiling applies, shared via AMOUNT_CEILING rather than
  // a second hand-typed copy of the literal.
  @IsNumber()
  @Max(AMOUNT_CEILING)
  value!: number;
}

// Search panel. Every field is optional and AND-combined; an omitted
// field imposes no constraint (reconciled is a true tri-state: absent means
// "either").
export class SearchOperationsDto {
  @IsUUID('7')
  accountId!: string;

  @IsOptional()
  @IsIn(['debit', 'credit'])
  type?: 'debit' | 'credit';

  @IsOptional()
  @ThirdPartyField()
  thirdParty?: string;

  // Bounded well above the seeded reference-data set's size.
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsUUID('7', { each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsUUID('7', { each: true })
  paymentMethodIds?: string[];

  // At most two comparators — e.g. a lower and upper bound.
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => AmountComparatorDto)
  amountComparators?: AmountComparatorDto[];

  @IsOptional()
  @ValueDateField()
  dateFrom?: string;

  @IsOptional()
  @ValueDateField()
  dateTo?: string;

  // A search filter, not stored text — deliberately narrower than
  // ThirdPartyField/NotesField's caps, which bound what's actually saved.
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  reconciled?: boolean;
}
