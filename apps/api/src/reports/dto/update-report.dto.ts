import { CreateReportDto } from './create-report.dto';

// Saving the edit form replaces the stored account selection wholesale —
// same shape as create.
export class UpdateReportDto extends CreateReportDto {}
