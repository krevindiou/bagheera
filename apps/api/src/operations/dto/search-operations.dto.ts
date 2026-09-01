import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AmountComparatorDto {
  @IsIn(['gt', 'gte', 'lt', 'lte', 'eq'])
  operator!: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';

  @IsNumber()
  value!: number;
}

// Search panel. Every field is optional and AND-combined; an omitted
// field imposes no constraint (reconciled is a true tri-state: absent means
// "either").
export class SearchOperationsDto {
  @IsInt()
  @Min(1)
  accountId!: number;

  @IsOptional()
  @IsIn(['debit', 'credit'])
  type?: 'debit' | 'credit';

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  thirdParty?: string;

  // Bounded well above the seeded reference-data set's size.
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @Min(1, { each: true })
  categoryIds?: number[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @Min(1, { each: true })
  paymentMethodIds?: number[];

  // At most two comparators — e.g. a lower and upper bound.
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => AmountComparatorDto)
  amountComparators?: AmountComparatorDto[];

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  reconciled?: boolean;
}
