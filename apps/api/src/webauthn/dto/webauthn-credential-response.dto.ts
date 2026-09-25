export class WebauthnCredentialSummaryDto {
  id!: string;
  deviceName!: string | null;
  createdAt!: Date;
  lastUsedAt!: Date | null;
}
