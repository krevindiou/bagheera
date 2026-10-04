import type { Assert, SameKeys } from '../../common/dto/same-keys';
import type { bank } from '../../db/schema';
export class BankDto {
  id!: string;
  memberId!: string;
  name!: string;
  closed!: boolean;
  deleted!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

export class ChooseBankResponseDto {
  id!: string;
  name!: string;
  created!: boolean;
}

// See common/dto/same-keys.ts.
export type BankDtoMatchesRow = Assert<SameKeys<BankDto, typeof bank.$inferSelect>>;
