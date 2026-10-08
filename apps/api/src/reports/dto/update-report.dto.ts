import { CreateReportDto } from './create-report.dto';

// Same shape as create; account and category selections are replaced
// wholesale.
export class UpdateReportDto extends CreateReportDto {}
