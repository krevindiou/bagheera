import { AxisBoundsDto, ChartPointDto } from '../../common/dto/chart-response.dto';
import type { Assert, SameKeys } from '../../common/dto/same-keys';
import type { account } from '../../db/schema';

export class AccountDto {
  id!: string;
  bankId!: string;
  name!: string;
  currency!: string;
  closed!: boolean;
  deleted!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

// Balances are attached to the list response only, in minor units.
export class AccountWithBalanceDto extends AccountDto {
  balance!: number;
  reconciledBalance!: number;
}

export class AccountSavedResponseDto {
  message!: string;
  account!: AccountDto;
}

export class AccountBalanceDto {
  balance!: number;
  reconciledBalance!: number;
}

export class AccountChartDto {
  currency!: string;
  axisBounds!: AxisBoundsDto | null;
  points!: ChartPointDto[];
}

// See common/dto/same-keys.ts.
export type AccountDtoMatchesRow = Assert<SameKeys<AccountDto, typeof account.$inferSelect>>;
