import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ReferenceDataService } from './reference-data.service';

// Read-only lookup lists used to populate operation/scheduler forms: the
// seeded category tree and the fixed payment-method list. No ownership
// scoping beyond requiring a signed-in session — both lists are global,
// not member-owned.
@Controller('reference-data')
export class ReferenceDataController {
  constructor(private readonly referenceData: ReferenceDataService) {}

  @Get('categories')
  categories(@Req() req: Request) {
    return this.referenceData.categories(req);
  }

  @Get('payment-methods')
  paymentMethods(@Req() req: Request) {
    return this.referenceData.paymentMethods(req);
  }
}
