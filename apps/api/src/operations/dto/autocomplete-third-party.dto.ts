import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { NoNul } from '../../common/dto-fields';
import { ENTRY_TYPES, FIELD_LIMITS, type EntryType } from '@bagheera/reference-data';

export class AutocompleteThirdPartyDto {
  // ThirdPartyField's cap, with a 2-char minimum before querying.
  @IsString()
  @NoNul()
  @MinLength(2)
  @MaxLength(FIELD_LIMITS.THIRD_PARTY)
  q!: string;

  // When given, a category of the other type is dropped; the third party
  // is still returned.
  @IsOptional()
  @IsIn(ENTRY_TYPES)
  type?: EntryType;
}
