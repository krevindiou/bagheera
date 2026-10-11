import { CreateSchedulerDto } from './create-scheduler.dto';

// accountId is immutable but still submitted (read-only on the edit form);
// the service rejects any change.
export class UpdateSchedulerDto extends CreateSchedulerDto {}
