export class LabelCorrectionDto {
  id!: string;
  // The label of the bank file to replace, and what replaces it.
  sourceLabel!: string;
  thirdParty!: string;
}

export class LabelCorrectionListDto {
  items!: LabelCorrectionDto[];
  // How many the Member may hold in all.
  limit!: number;
}

export class LabelCorrectionsDeletedDto {
  message!: string;
  deletedCount!: number;
}
