import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class AutocompleteThirdPartyDto {
  @IsString()
  @MinLength(2)
  q!: string;

  // When given, a matched category is only returned if its type matches;
  // the third party is still returned either way (see 4.15).
  @IsOptional()
  @IsIn(['debit', 'credit'])
  type?: 'debit' | 'credit';
}
