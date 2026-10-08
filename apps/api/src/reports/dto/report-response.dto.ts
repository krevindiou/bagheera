import { ApiProperty } from '@nestjs/swagger';
import { AxisBoundsDto, ChartPointDto } from '../../common/dto/chart-response.dto';
import type { Assert, SameKeys } from '../../common/dto/same-keys';
import type { report } from '../../db/schema';

const REPORT_TYPES = ['sum', 'average', 'distribution'] as const;
const PERIOD_GROUPINGS = ['month', 'quarter', 'year', 'all'] as const;
const DATA_GROUPINGS = ['category', 'third_party', 'payment_method'] as const;

export class ReportDto {
  id!: string;
  memberId!: string;
  @ApiProperty({ enum: REPORT_TYPES })
  type!: (typeof REPORT_TYPES)[number];
  title!: string;
  homepage!: boolean;
  valueDateStart!: string | null;
  valueDateEnd!: string | null;
  thirdParties!: string | null;
  reconciledOnly!: boolean | null;
  @ApiProperty({ enum: PERIOD_GROUPINGS })
  periodGrouping!: (typeof PERIOD_GROUPINGS)[number];
  // Set only for a 'distribution' report.
  @ApiProperty({ enum: DATA_GROUPINGS, nullable: true })
  dataGrouping!: (typeof DATA_GROUPINGS)[number] | null;
  significantResultsNumber!: number | null;
  createdAt!: Date;
  updatedAt!: Date;
  accountIds!: string[];
  categoryIds!: string[];
}

export class ReportSavedResponseDto {
  message!: string;
  report!: ReportDto;
}

export class ReportBatchDeleteResponseDto {
  message!: string;
  deletedCount!: number;
}

export class ReportSeriesEntryDto {
  currency!: string;
  credit!: ChartPointDto[];
  debit!: ChartPointDto[];
}

export class ReportSeriesDto {
  hidden!: boolean;
  axisBounds!: AxisBoundsDto | null;
  series!: ReportSeriesEntryDto[];
}

export class ReportDistributionLabelSeriesDto {
  // null = "Other": the tail past the top N, plus uncategorized operations.
  // The top N is ranked over the whole range and fixed across periods, so
  // stacked segments don't reshuffle from one period to the next.
  label!: string | null;
  points!: ChartPointDto[];
}

export class ReportDistributionSeriesDto {
  currency!: string;
  debit!: ReportDistributionLabelSeriesDto[];
  credit!: ReportDistributionLabelSeriesDto[];
}

export class ReportDistributionDto {
  hidden!: boolean;
  // What the labels are (categories, third parties or payment methods), so
  // clients know whether a label is reference data they can translate.
  @ApiProperty({ enum: DATA_GROUPINGS })
  dataGrouping!: (typeof DATA_GROUPINGS)[number];
  series!: ReportDistributionSeriesDto[];
}

// See common/dto/same-keys.ts.
export type ReportDtoMatchesRow = Assert<
  SameKeys<ReportDto, typeof report.$inferSelect & { accountIds: string[]; categoryIds: string[] }>
>;
