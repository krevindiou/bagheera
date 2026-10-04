// Every amount here (axis bounds, point values) is in minor units (real
// value × 10,000), like all amounts the API returns.
export class AxisBoundsDto {
  min!: number;
  max!: number;
}

export class ChartPointDto {
  period!: string;
  value!: number;
}

export class SynthesisChartSeriesDto {
  currency!: string;
  points!: ChartPointDto[];
}

export class SynthesisChartDto {
  hidden!: boolean;
  axisBounds!: AxisBoundsDto | null;
  series!: SynthesisChartSeriesDto[];
}
