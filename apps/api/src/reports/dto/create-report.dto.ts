import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateReportDto {
  @IsIn(['sum', 'average'])
  type!: 'sum' | 'average';

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  title!: string;

  @IsOptional()
  @IsBoolean()
  homepage?: boolean;

  @IsOptional()
  @IsDateString()
  valueDateStart?: string;

  @IsOptional()
  @IsDateString()
  valueDateEnd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  thirdParties?: string;

  // Empty/omitted = all of the member's non-deleted accounts in non-deleted
  // banks; submitted ids not meeting that description are dropped silently.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  accountIds?: number[];

  @IsOptional()
  @IsBoolean()
  reconciledOnly?: boolean;

  @IsIn(['month', 'quarter', 'year', 'all'])
  periodGrouping!: 'month' | 'quarter' | 'year' | 'all';
}
