import { ApiProperty } from '@nestjs/swagger';

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
