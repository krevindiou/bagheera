import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AutocompleteThirdPartyDto {
  // Same 64 cap as ThirdPartyField (the third_party column width) — but not
  // that builder itself: a 2-char minimum before bothering to query is a
  // UX choice, not the "must be non-empty" ThirdPartyField enforces.
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  q!: string;

  // When given, a matched category is only returned if its type matches;
  // the third party is still returned either way (see 4.15).
  @IsOptional()
  @IsIn(['debit', 'credit'])
  type?: 'debit' | 'credit';
}
