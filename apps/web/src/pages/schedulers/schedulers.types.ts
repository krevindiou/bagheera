import type { components } from '../../api/schema';

type Schemas = components['schemas'];

export type Scheduler = Omit<Schemas['SchedulerDto'], 'createdAt' | 'updatedAt'>;
