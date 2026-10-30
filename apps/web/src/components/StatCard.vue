<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import { formatMoney } from '../domain/money';
import AppIcon from './AppIcon.vue';

// A figure with its label and a footnote: the dashboard's balance, biggest
// income/expense and account tiles, and the import statement's totals.
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
    primary?: boolean;
    trend?: 'up' | 'down';
    reconciled?: number;
    to?: RouteLocationRaw;
    valueTestid?: string;
    reconciledTestid?: string;
  }>(),
  {
    trend: undefined,
    reconciled: undefined,
    to: undefined,
    valueTestid: undefined,
    reconciledTestid: undefined,
  },
);

// A falling figure isn't alarming in itself (an expense is expected), so
// only income and a figure below zero are tinted.
const valueTone = computed(() => {
  if (props.trend === 'up') return 'text-success';
  if (props.amount < 0) return 'text-danger';
  return undefined;
});
</script>

<template>
  <component :is="to ? RouterLink : 'div'" v-bind="to ? { to } : {}" class="stat-card">
    <div
      v-if="trend"
      class="stat-trend-badge"
      :class="trend === 'up' ? 'stat-trend-badge-success' : 'stat-trend-badge-neutral'"
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

<style scoped>
.stat-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  /* Less on top/bottom than the sides: the text's own leading already fills
     part of the vertical space. */
  padding: 20px 24px;
}
/* padding-right reserves space for the trend badge below, on every
   stat-card's label (not just income/expense) — so income's shorter text
   and expense's longer one wrap the same way instead of one card staying
   single-line while its neighbor wraps. */
.stat-card .stat-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 8px;
  padding-right: 32px;
}
/* Trend badge (income/expense stat cards) — a small circular chip pinned
   to the card's top-right corner, clear of both the label text and the
   figure below it. */
.stat-trend-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stat-trend-badge svg {
  width: 18px;
  height: 18px;
}
.stat-trend-badge-success {
  background: var(--success-soft);
  color: var(--success);
}
.stat-trend-badge-neutral {
  background: var(--surface-sunk);
  color: var(--text-muted);
}
.stat-card .stat-value {
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
/* Foreground boost for the one number on the card meant to read as "the"
   headline figure (`primary`) — everything else sharing .stat-value stays
   at the base size. Scoped as ".stat-card .stat-value-primary", matching
   ".stat-card .stat-value"'s own specificity, so this actually wins the
   cascade instead of losing to it despite coming later in the file. */
.stat-card .stat-value-primary {
  font-size: 30px;
}
</style>
