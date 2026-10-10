import type { components } from '../../api/schema';

type Schemas = components['schemas'];

export type DashboardResponse = Schemas['DashboardResponseDto'];
export type DashboardSynthesisChart = Schemas['SynthesisChartDto'];
