import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  registerDecorator,
  ValidateIf,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { MAX_SIGNIFICANT_RESULTS_NUMBER } from '@bagheera/reference-data';
import { ReportTitleField, ValueDateField } from '../../common/dto-fields';

// An inverted range would silently match nothing. Both are ValueDateField
// ('YYYY-MM-DD'), so string order is chronological.
function IsOnOrAfter(property: string, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isOnOrAfter',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints as [string];
          const relatedValue = (args.object as Record<string, unknown>)[relatedPropertyName];
          if (typeof value !== 'string' || typeof relatedValue !== 'string') return true;
          return value >= relatedValue;
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints as [string];
          return `${args.property} must be on or after ${relatedPropertyName}`;
        },
      },
    });
  };
}

export class CreateReportDto {
  @IsIn(['sum', 'average', 'distribution'])
  type!: 'sum' | 'average' | 'distribution';

  @ReportTitleField()
  title!: string;

  @IsOptional()
  @IsBoolean()
  homepage?: boolean;

  @IsOptional()
  @ValueDateField()
  valueDateStart?: string;

  @IsOptional()
  @ValueDateField()
  @IsOnOrAfter('valueDateStart')
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
  @IsUUID('7', { each: true })
  accountIds?: string[];

  @IsOptional()
  @IsBoolean()
  reconciledOnly?: boolean;

  // Empty/omitted = every category (no filter); submitted ids not matching a
  // known category are dropped silently, same as accountIds.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID('7', { each: true })
  categoryIds?: string[];

  // Required for every type: a 'distribution' report ranks within each
  // period too.
  @IsIn(['month', 'quarter', 'year', 'all'])
  periodGrouping!: 'month' | 'quarter' | 'year' | 'all';

  // Required for 'distribution' only; `?:` so the Swagger plugin marks them
  // optional.
  @ValidateIf((dto: CreateReportDto) => dto.type === 'distribution')
  @IsIn(['category', 'third_party', 'payment_method'])
  dataGrouping?: 'category' | 'third_party' | 'payment_method';

  @ValidateIf((dto: CreateReportDto) => dto.type === 'distribution')
  @IsInt()
  @Min(1)
  @Max(MAX_SIGNIFICANT_RESULTS_NUMBER)
  significantResultsNumber?: number;
}
