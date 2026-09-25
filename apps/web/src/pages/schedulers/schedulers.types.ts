import type { components } from '../../api/schema';

type Schemas = components['schemas'];

export type Scheduler = Omit<Schemas['SchedulerDto'], 'createdAt' | 'updatedAt'>;

export type SchedulerList = Omit<Schemas['SchedulerListDto'], 'items'> & { items: Scheduler[] };
