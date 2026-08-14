import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';

// The bank-choice form offers two mutually exclusive options:
// pick an existing active bank (`bankId`) or type a new name (`name`).
export class ChooseBankDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  bankId?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  name?: string;
}
