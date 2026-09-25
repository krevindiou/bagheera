import { Controller, Get } from '@nestjs/common';
import type { Request } from 'express';
import { ReferenceDataService } from './reference-data.service';
import { CategoryDto, PaymentMethodDto } from './dto/reference-data-response.dto';

// Read-only lookup lists used to populate operation/scheduler forms: the
// seeded category tree and the fixed payment-method list. No ownership
// scoping beyond requiring a signed-in session — both lists are global,
// not member-owned.
@Controller('reference-data')
export class ReferenceDataController {
  constructor(private readonly referenceData: ReferenceDataService) {}

  @Get('categories')
  categories(): Promise<CategoryDto[]> {
    return this.referenceData.categories();
  }

  @Get('payment-methods')
  paymentMethods(): Promise<PaymentMethodDto[]> {
    return this.referenceData.paymentMethods();
  }
}
