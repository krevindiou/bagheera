import { ApiProperty, OmitType } from '@nestjs/swagger';
import { SearchOperationsDto } from './search-operations.dto';

export class OperationDto {
  id!: string;
  accountId!: string;
  schedulerId!: string | null;
  transferOperationId!: string | null;
  transferAccountId!: string | null;
  categoryId!: string | null;
  paymentMethodId!: string;
  thirdParty!: string;
  // Minor units (real value × 10,000); exactly one of debit/credit is set.
  debit!: number | null;
  credit!: number | null;
  valueDate!: string;
  reconciled!: boolean;
  notes!: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export class OperationListDto {
  @ApiProperty({ type: [OperationDto] })
  items!: OperationDto[];
  total!: number;
  page!: number;
  pageSize!: number;
}

export class SearchCriteriaDto extends OmitType(SearchOperationsDto, ['accountId'] as const) {}

export class OperationSearchRecallDto extends OperationListDto {
  criteria!: SearchCriteriaDto;
  active!: boolean;
}

export class OperationSavedResponseDto {
  message!: string;
  operation!: OperationDto;
}

export class ThirdPartySuggestionDto {
  thirdParty!: string;
  categoryId!: string | null;
}

export class BatchDeleteResponseDto {
  message!: string;
  deletedCount!: number;
}

export class BatchReconcileResponseDto {
  message!: string;
  reconciledCount!: number;
}
