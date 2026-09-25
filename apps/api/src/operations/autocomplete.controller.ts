import { Controller, Get, Query } from '@nestjs/common';
import { OperationAutocompleteService, ThirdPartySuggestion } from './autocomplete.service';
import { AutocompleteThirdPartyDto } from './dto/autocomplete-third-party.dto';
import { CurrentMember } from '../session/current-member.decorator';
import type { MemberId } from '../security/ids';

@Controller('operations/autocomplete')
export class OperationAutocompleteController {
  constructor(private readonly autocomplete: OperationAutocompleteService) {}

  @Get()
  search(
    @CurrentMember() memberId: MemberId,
    @Query() dto: AutocompleteThirdPartyDto,
  ): Promise<ThirdPartySuggestion[]> {
    return this.autocomplete.search(memberId, dto);
  }
}
