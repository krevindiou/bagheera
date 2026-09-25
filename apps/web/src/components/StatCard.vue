<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import { formatMoney } from '../pages/operations/money';
import AppIcon from './AppIcon.vue';

// A figure with its label and a footnote: the dashboard's balance, biggest
// income/expense and account tiles, and the operations page's balance chip.
// `trend` adds the corner badge and tints the figure (up = income, down =
// expense); without it a negative amount is tinted red. `reconciled` renders
// the standard "Reconciled" footnote; the `footnote` slot replaces it, and
// the default slot goes below it (the account tile's sparkline). Attributes
// (a `data-testid`, spacing classes) land on the root, which is a link when
// `to` is set.
const props = withDefaults(
  defineProps<{
    label: string;
    amount: number;
    currency: string;
    variant?: 'card' | 'chip';
    primary?: boolean;
    trend?: 'up' | 'down';
    reconciled?: number;
    to?: RouteLocationRaw;
    valueTestid?: string;
    reconciledTestid?: string;
  }>(),
  {
    variant: 'card',
    trend: undefined,
    reconciled: undefined,
    to: undefined,
    valueTestid: undefined,
    reconciledTestid: undefined,
  },
);

const valueTone = computed(() => {
  if (props.trend === 'up') return 'text-success';
  if (props.trend === 'down' || props.amount < 0) return 'text-danger';
  return undefined;
});
</script>

<template>
  <component
    :is="to ? RouterLink : 'div'"
    v-bind="to ? { to } : {}"
    :class="variant === 'chip' ? 'stat-chip' : 'stat-card'"
  >
    <div
      v-if="trend"
      class="stat-trend-badge"
      :class="trend === 'up' ? 'stat-trend-badge-success' : 'stat-trend-badge-danger'"
    >
      <AppIcon :name="trend === 'up' ? 'trendUp' : 'trendDown'" />
    </div>
    <div class="stat-label">{{ label }}</div>
    <div
      class="stat-value"
      :class="[valueTone, { 'stat-value-primary': primary }]"
      :data-testid="valueTestid"
    >
      {{ formatMoney(amount, currency) }}
    </div>
    <div v-if="reconciled !== undefined || $slots.footnote" class="stat-footnote">
      <slot name="footnote">
        <span class="stat-footnote-label">{{ $t('dashboard.totalReconciled') }}</span>
        <span class="stat-footnote-value" :data-testid="reconciledTestid">
          {{ formatMoney(reconciled!, currency) }}
        </span>
      </slot>
    </div>
    <slot />
  </component>
</template>
