import { Controller, Get } from '@nestjs/common';
import type { Request } from 'express';
import { ReferenceDataService } from './reference-data.service';
import { CategoryDto, PaymentMethodDto } from './dto/reference-data-response.dto';

// Global, read-only lists for the operation/scheduler forms; only a
// signed-in session is required.
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
