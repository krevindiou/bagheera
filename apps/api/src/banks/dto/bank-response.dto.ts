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
