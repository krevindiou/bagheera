import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { SynthesisChartDto } from '../../common/dto/chart-response.dto';
import { ReportDistributionDto, ReportSeriesDto } from '../../reports/dto/report-response.dto';

// Amounts and balances are minor units (real value × 10,000).
export class TotalBalanceDto {
  currency!: string;
  amount!: number;
  reconciledAmount!: number;
  // A closed account (or one under a closed bank) holds part of the total,
  // so the accounts overview tiles don't add up to it.
  includesClosedAccounts!: boolean;
}

export class DashboardIndicatorDto {
  amount!: number;
  currency!: string;
  valueDate!: string;
  thirdParty!: string;
}

export class AccountsOverviewAccountDto {
  id!: string;
  name!: string;
  currency!: string;
  balance!: number;
  reconciledBalance!: number;
  // Cumulative end-of-month balance in minor units, oldest first.
  history!: number[];
}

export class AccountsOverviewBankDto {
  id!: string;
  name!: string;
  accounts!: AccountsOverviewAccountDto[];
}

export class SeriesHomepageReportDto {
  @ApiProperty({ enum: ['series'] })
  kind!: 'series';
  id!: string;
  title!: string;
  series!: ReportSeriesDto;
}

export class DistributionHomepageReportDto {
  @ApiProperty({ enum: ['distribution'] })
  kind!: 'distribution';
  id!: string;
  title!: string;
  distribution!: ReportDistributionDto;
}

@ApiExtraModels(SeriesHomepageReportDto, DistributionHomepageReportDto)
export class DashboardResponseDto {
  @ApiProperty({ enum: ['no-bank', 'no-account'], nullable: true })
  onboarding!: 'no-bank' | 'no-account' | null;
  totalBalances!: TotalBalanceDto[];
  lastBiggestIncome!: DashboardIndicatorDto | null;
  lastBiggestExpense!: DashboardIndicatorDto | null;
  synthesisChart!: SynthesisChartDto;
  accountsOverview!: AccountsOverviewBankDto[];
  @ApiProperty({
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(SeriesHomepageReportDto) },
        { $ref: getSchemaPath(DistributionHomepageReportDto) },
      ],
    },
  })
  homepageReports!: (SeriesHomepageReportDto | DistributionHomepageReportDto)[];
}
