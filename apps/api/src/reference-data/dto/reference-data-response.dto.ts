import { ApiProperty } from '@nestjs/swagger';
import type { Assert, SameKeys } from '../../common/dto/same-keys';
import type { category, paymentMethod } from '../../db/schema';

export class CategoryDto {
  id!: string;
  parentId!: string | null;
  @ApiProperty({ enum: ['debit', 'credit'] })
  type!: 'debit' | 'credit';
  name!: string;
}

export class PaymentMethodDto {
  id!: string;
  name!: string;
  // Null only for the system-generated "Initial balance" method.
  @ApiProperty({ enum: ['debit', 'credit'], nullable: true })
  type!: 'debit' | 'credit' | null;
}

// See common/dto/same-keys.ts.
export type CategoryDtoMatchesRow = Assert<SameKeys<CategoryDto, typeof category.$inferSelect>>;
export type PaymentMethodDtoMatchesRow = Assert<
  SameKeys<PaymentMethodDto, typeof paymentMethod.$inferSelect>
>;
