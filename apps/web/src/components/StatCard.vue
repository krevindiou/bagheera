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

<style scoped>
.stat-card {
  position: relative;
  background: var(--panel);
  border: 1px solid var(--hair);
  border-radius: 8px;
  /* Flat 18px (the mock's own value) reads heavier on top/bottom than left/right —
     line-height leading on the label/value/footnote text already fills part of the
     vertical padding, so the same number looks like more space horizontally than
     vertically. 16px/18px optically balances it; deliberate deviation from the mock. */
  padding: 16px 18px;
}
/* padding-right reserves space for the trend badge below, on every
   stat-card's label (not just income/expense) — so income's shorter text
   and expense's longer one wrap the same way instead of one card staying
   single-line while its neighbor wraps. */
.stat-card .stat-label {
  font-size: 12.5px;
  color: var(--paper-faint);
  margin-bottom: 8px;
  padding-right: 32px;
}
/* Trend badge (income/expense stat cards) — a small circular chip pinned
   to the card's top-right corner, clear of both the label text and the
   figure below it. Named "-trend-" (not "-stat-") to avoid colliding
   with the unrelated .stat-chip variant below. */
.stat-trend-badge {
  position: absolute;
  top: 12px;
  right: 12px;
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
  background: rgba(95, 217, 141, 0.14);
  color: var(--green);
}
.stat-trend-badge-danger {
  background: rgba(232, 105, 122, 0.14);
  color: var(--red);
}
.stat-card .stat-value {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 26px;
  font-weight: 600;
}
/* Foreground boost for the one number on the card meant to read as "the"
   headline figure (`primary`) — everything else sharing .stat-value stays
   at the base size. Scoped as ".stat-card .stat-value-primary", matching
   ".stat-card .stat-value"'s own specificity, so this actually wins the
   cascade instead of losing to it despite coming later in the file. */
.stat-card .stat-value-primary {
  font-size: 30px;
  font-weight: 700;
}
.stat-chip {
  /* A block div otherwise stretches to its parent's full width — fine for
     .stat-card in a grid track, wrong for a "chip" meant to hug its
     content (the mock sits it beside a sibling chip in a flex row).
     OperationsPage.vue's lone balance chip has no such sibling to size
     against, so without this it stretched edge-to-edge: 14px of real top/
     bottom padding against several hundred px of dead space on the right. */
  width: fit-content;
  background: var(--panel);
  border: 1px solid var(--hair);
  border-radius: 8px;
  padding: 14px 18px;
  min-width: 140px;
}
.stat-chip .stat-label {
  font-size: 12px;
  color: var(--paper-faint);
}
.stat-chip .stat-value {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 20px;
  font-weight: 600;
}
/* Same specificity as .stat-chip .stat-value above — placed after so it
   wins the font-size tiebreak on source order (see .acct-tile's own
   override of these same classes in DashboardPage.vue for the other half
   of this pattern). */
.stat-chip .stat-value-primary {
  font-size: 24px;
  font-weight: 700;
}
.stat-chip .stat-footnote {
  margin-top: 8px;
}
</style>
