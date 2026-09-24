<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { apiClient } from '../../api/client';
import SynthesisChart, { type SynthesisChartSeries } from '../../components/SynthesisChart.vue';
import AccountSparkline from '../../components/AccountSparkline.vue';
import { colorForCurrency } from '../../components/chartColors';
import {
  DEFAULT_SYNTHESIS_CHART_RANGE,
  SYNTHESIS_CHART_RANGE_LABEL_KEYS,
  SYNTHESIS_CHART_RANGES,
  type SynthesisChartRange,
} from '../../components/synthesisChartRange';
import { formatDate } from '../operations/money';
import StatCard from '../../components/StatCard.vue';
import ReportChart from '../reports/ReportChart.vue';
import type { DashboardResponse, DashboardSynthesisChart } from './dashboard.types';

const chartRange = ref<SynthesisChartRange>(DEFAULT_SYNTHESIS_CHART_RANGE);

const { data: dashboard } = useQuery({
  queryKey: computed(() => ['dashboard', chartRange.value]),
  queryFn: async () => {
    const { data } = await apiClient.GET('/dashboard', {
      params: { query: { range: chartRange.value } },
    });
    return (data as DashboardResponse | undefined) ?? null;
  },
});

// The synthesis chart is one line per currency (not a fixed debit/credit
// pair), colored by `colorForCurrency` — see chartColors.ts for why that's
// a hash of the currency itself rather than "index among the currencies
// on this page": every chart that colors by currency (this one, an
// account tile's sparkline, a single account's own chart on
// OperationsPage) needs to agree without knowing what the others show.
function toSynthesisSeries(chart: DashboardSynthesisChart): SynthesisChartSeries[] {
  return chart.series.map((s) => ({
    label: s.currency,
    color: colorForCurrency(s.currency),
    points: s.points,
  }));
}

// Flattened across every bank — the mock shows one grid of account tiles
// (each labeled "Bank — Account"), not a grid per bank.
const accountTiles = computed(() =>
  (dashboard.value?.accountsOverview ?? []).flatMap((bank) =>
    bank.accounts.map((account) => ({ ...account, bankName: bank.name })),
  ),
);
</script>

<template>
  <div v-if="dashboard">
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

      <section
        v-if="!dashboard.synthesisChart.hidden"
        class="panel panel-lg mb-4 p-4"
        data-testid="synthesis-chart"
      >
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h2 class="h6 mb-0">{{ $t('dashboard.synthesisChart') }}</h2>
          <select
            v-model="chartRange"
            class="form-select form-select-sm w-auto"
            :aria-label="$t('chartRange.label')"
            data-testid="synthesis-chart-range"
          >
            <option v-for="range in SYNTHESIS_CHART_RANGES" :key="range" :value="range">
              {{ $t(SYNTHESIS_CHART_RANGE_LABEL_KEYS[range]) }}
            </option>
          </select>
        </div>
        <SynthesisChart
          :series="toSynthesisSeries(dashboard.synthesisChart)"
          :axis-bounds="dashboard.synthesisChart.axisBounds"
        />
      </section>

      <section class="mb-4">
        <h2 class="h6 mb-3">{{ $t('dashboard.accountsOverview') }}</h2>
        <p v-if="accountTiles.length === 0" class="text-muted">
          {{ $t('dashboard.noAccounts') }}
        </p>
        <!-- One flat grid across every bank's accounts (see the mock: 3
             tiles side by side, each labeled "Bank — Account") — not
             grouped per bank, which left a lone single-account bank
             stretching its one tile across the full row width. -->
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
