<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { unwrap } from '../../api/unwrap';
import SynthesisChartPanel from '../../components/SynthesisChartPanel.vue';
import type { SynthesisChartSeries } from '../../components/SynthesisChart.vue';
import AccountSparkline from '../../components/AccountSparkline.vue';
import { colorForCurrency } from '../../components/chartColors';
import {
  DEFAULT_SYNTHESIS_CHART_RANGE,
  type SynthesisChartRange,
} from '../../components/synthesisChartRange';
import { formatDate, toDisplayBounds, toDisplayPoints } from '../../domain/money';
import StatCard from '../../components/StatCard.vue';
import LoadError from '../../components/LoadError.vue';
import ReportChart from '../reports/ReportChart.vue';
import type { DashboardSynthesisChart } from './dashboard.types';

const chartRange = ref<SynthesisChartRange>(DEFAULT_SYNTHESIS_CHART_RANGE);

const { data: dashboard, isError } = useQuery({
  queryKey: computed(() => queryKeys.dashboard.range(chartRange.value)),
  queryFn: async () =>
    unwrap(
      await apiClient.GET('/dashboard', {
        params: { query: { range: chartRange.value } },
      }),
    ),
});

// One line per currency, colored like every other per-currency chart.
function toSynthesisSeries(chart: DashboardSynthesisChart): SynthesisChartSeries[] {
  return chart.series.map((s) => ({
    label: s.currency,
    color: colorForCurrency(s.currency),
    points: toDisplayPoints(s.points, s.currency),
  }));
}

// One grid of "Bank — Account" tiles, not one per bank.
const accountTiles = computed(() =>
  (dashboard.value?.accountsOverview ?? []).flatMap((bank) =>
    bank.accounts.map((account) => ({ ...account, bankName: bank.name })),
  ),
);
</script>

<template>
  <LoadError v-if="isError" data-testid="dashboard-error" />
  <div v-else-if="dashboard">
    <h1 class="mb-1" style="font-size: 28px">{{ $t('dashboard.title') }}</h1>
    <p class="mb-4" style="color: var(--paper-dim); font-size: 15px">
      {{ $t('dashboard.subtitle') }}
    </p>

    <div
      v-if="dashboard.onboarding === 'no-bank'"
      class="alert alert-info"
      data-testid="onboarding-tip"
    >
      {{ $t('dashboard.onboardingNoBank') }}
      <router-link :to="{ name: 'accounts', query: { start: 'bank-choice' } }">{{
        $t('dashboard.onboardingCta')
      }}</router-link>
    </div>
    <div
      v-else-if="dashboard.onboarding === 'no-account'"
      class="alert alert-info"
      data-testid="onboarding-tip"
    >
      {{ $t('dashboard.onboardingNoAccount') }}
      <router-link :to="{ name: 'accounts', query: { start: 'new-account' } }">{{
        $t('dashboard.onboardingCta')
      }}</router-link>
    </div>

    <template v-if="dashboard.onboarding !== 'no-bank'">
      <section class="mb-4">
        <p v-if="dashboard.totalBalances.length === 0" class="text-muted">
          {{ $t('dashboard.noBalances') }}
        </p>
        <div class="stat-grid">
          <StatCard
            v-for="balance in dashboard.totalBalances"
            :key="balance.currency"
            :label="`${$t('dashboard.totalBalances')} (${balance.currency})`"
            :amount="balance.amount"
            :currency="balance.currency"
            :reconciled="balance.reconciledAmount"
            value-testid="total-balance"
            reconciled-testid="total-reconciled"
          />
          <StatCard
            v-if="dashboard.lastBiggestIncome"
            :label="$t('dashboard.lastBiggestIncome')"
            :amount="dashboard.lastBiggestIncome.amount"
            :currency="dashboard.lastBiggestIncome.currency"
            trend="up"
            data-testid="last-biggest-income"
          >
            <template #footnote>
              <span class="stat-footnote-label"
                >{{ dashboard.lastBiggestIncome.thirdParty }} ·
                {{ formatDate(dashboard.lastBiggestIncome.valueDate) }}</span
              >
            </template>
          </StatCard>
          <StatCard
            v-if="dashboard.lastBiggestExpense"
            :label="$t('dashboard.lastBiggestExpense')"
            :amount="dashboard.lastBiggestExpense.amount"
            :currency="dashboard.lastBiggestExpense.currency"
            trend="down"
            data-testid="last-biggest-expense"
          >
            <template #footnote>
              <span class="stat-footnote-label"
                >{{ dashboard.lastBiggestExpense.thirdParty }} ·
                {{ formatDate(dashboard.lastBiggestExpense.valueDate) }}</span
              >
            </template>
          </StatCard>
        </div>
      </section>

      <SynthesisChartPanel
        v-if="!dashboard.synthesisChart.hidden"
        v-model:range="chartRange"
        :title="$t('dashboard.synthesisChart')"
        :series="toSynthesisSeries(dashboard.synthesisChart)"
        :axis-bounds="toDisplayBounds(dashboard.synthesisChart.axisBounds)"
        range-testid="synthesis-chart-range"
        data-testid="synthesis-chart"
      />

      <section class="mb-4">
        <h2 class="h6 mb-3">{{ $t('dashboard.accountsOverview') }}</h2>
        <p v-if="accountTiles.length === 0" class="text-muted">
          {{ $t('dashboard.noAccounts') }}
        </p>
        <div v-else class="tile-grid">
          <StatCard
            v-for="account in accountTiles"
            :key="account.id"
            :to="{ name: 'operations', params: { accountId: account.id } }"
            :label="`${account.bankName} — ${account.name}`"
            :amount="account.balance"
            :currency="account.currency"
            :reconciled="account.reconciledBalance"
            primary
            class="acct-tile"
            data-testid="overview-account"
          >
            <AccountSparkline
              :values="account.history"
              :color="colorForCurrency(account.currency)"
              class="mt-2"
            />
          </StatCard>
        </div>
      </section>

      <section v-if="dashboard.homepageReports.length > 0">
        <h2 class="h6 mb-3">{{ $t('dashboard.reportCharts') }}</h2>
        <div
          v-for="entry in dashboard.homepageReports"
          :key="entry.id"
          class="panel panel-lg mb-4 p-4"
          data-testid="homepage-report"
        >
          <h3 class="h6 mb-3">{{ entry.title }}</h3>
          <ReportChart :report="entry" />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
}
/* Own sizing, unlike .stat-grid (160px/14px). */
.tile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.acct-tile {
  display: block;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  padding: 16px;
}
.acct-tile:hover {
  border-color: var(--violet-dim);
  color: inherit;
}
/* Two lines reserved for the label, so tiles in a row stay aligned whether
   their names wrap or not. Tiles only: a standalone card would show a gap. */
.acct-tile :deep(.stat-label) {
  line-height: 1.3;
  min-height: 2.6em;
}
/* !important: equal specificity with StatCard's rules, so otherwise the
   winner depends on style injection order. */
.acct-tile :deep(.stat-value) {
  font-size: 19px !important;
  margin-top: 4px;
}
.acct-tile :deep(.stat-value-primary) {
  font-size: 22px !important;
}
.acct-tile :deep(.stat-footnote) {
  margin-top: 6px;
}
</style>
