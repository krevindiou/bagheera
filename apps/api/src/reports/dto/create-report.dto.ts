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
} from 'class-validator';
import { ReportTitleField } from '../../common/dto-fields';

export class CreateReportDto {
  @IsIn(['sum', 'average'])
  type!: 'sum' | 'average';

  @ReportTitleField()
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

  // A filter, not stored text — its own cap, unrelated to ReportTitleField's.
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
