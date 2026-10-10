import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ENTRY_TYPES } from '@bagheera/reference-data';

export class AutocompleteThirdPartyDto {
  // ThirdPartyField's cap, with a 2-char minimum before querying.
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  q!: string;

  // When given, a category of the other type is dropped; the third party
  // is still returned.
  @IsOptional()
  @IsIn(ENTRY_TYPES)
  type?: 'debit' | 'credit';
}
