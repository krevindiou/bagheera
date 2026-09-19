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
  IsUUID,
  Max,
  MaxLength,
  Min,
  registerDecorator,
  ValidateIf,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { ReportTitleField } from '../../common/dto-fields';

// Both are optional independently, but when both are set the range has to
// make sense — otherwise the operation query (valueDate >= start AND <= end)
// silently matches nothing and the report just renders empty with no
// indication why. String comparison is safe here: both are IsDateString
// ('YYYY-MM-DD'), whose lexicographic order matches chronological order.
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

// A ranked distribution report shows at most this many individual buckets
// before collapsing the remainder into "Other" — a real ceiling since it
// drives how many rows the UI renders.
export const MAX_SIGNIFICANT_RESULTS_NUMBER = 50;

export class CreateReportDto {
  @IsIn(['sum', 'average', 'distribution'])
  type!: 'sum' | 'average' | 'distribution';

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
  @IsOnOrAfter('valueDateStart', { message: 'valueDateEnd must be on or after valueDateStart' })
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

  // Required for every type — a 'distribution' report ranks *within* each
  // period too (defaulting to 'all', a single whole-range bucket).
  @IsIn(['month', 'quarter', 'year', 'all'])
  periodGrouping!: 'month' | 'quarter' | 'year' | 'all';

  // The next two are required for 'distribution' only — genuinely optional
  // TS properties (not `!:`) so the Swagger CLI plugin (nest-cli.json) marks
  // them optional in the generated schema too, matching @ValidateIf's
  // conditional requirement rather than always-required.
  @ValidateIf((dto: CreateReportDto) => dto.type === 'distribution')
  @IsIn(['category', 'third_party', 'payment_method'])
  dataGrouping?: 'category' | 'third_party' | 'payment_method';

  @ValidateIf((dto: CreateReportDto) => dto.type === 'distribution')
  @IsInt()
  @Min(1)
  @Max(MAX_SIGNIFICANT_RESULTS_NUMBER)
  significantResultsNumber?: number;
}
