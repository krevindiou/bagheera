import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  OperationAutocompleteService,
  ThirdPartySuggestion,
} from './autocomplete.service';
import { AutocompleteThirdPartyDto } from './dto/autocomplete-third-party.dto';

@Controller('operations/autocomplete')
export class OperationAutocompleteController {
  constructor(private readonly autocomplete: OperationAutocompleteService) {}

  @Get()
  search(
    @Req() req: Request,
    @Query() dto: AutocompleteThirdPartyDto,
  ): Promise<ThirdPartySuggestion[]> {
    return this.autocomplete.search(req, dto);
  }
}
