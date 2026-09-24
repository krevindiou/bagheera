<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';
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
import RankedChart from '../../components/RankedChart.vue';
import { formatDate, formatMoney } from '../operations/money';
import { toChartSeries } from '../reports/chartSeries';
import { toDistributionFacets } from '../reports/distributionSeries';
import type { DashboardResponse, DashboardSynthesisChart } from './dashboard.types';

const { t } = useI18n();

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
          <div v-for="balance in dashboard.totalBalances" :key="balance.currency" class="stat-card">
            <div class="stat-label">
              {{ $t('dashboard.totalBalances') }} ({{ balance.currency }})
            </div>
            <div
              class="stat-value"
              data-testid="total-balance"
              :class="{ 'text-danger': balance.amount < 0 }"
            >
              {{ formatMoney(balance.amount, balance.currency, true) }}
            </div>
            <div class="stat-footnote">
              <span class="stat-footnote-label">{{ $t('dashboard.totalReconciled') }}</span>
              <span class="stat-footnote-value" data-testid="total-reconciled">
                {{ formatMoney(balance.reconciledAmount, balance.currency, true) }}
              </span>
            </div>
          </div>
          <div
            v-if="dashboard.lastBiggestIncome"
            class="stat-card"
            data-testid="last-biggest-income"
          >
            <div class="stat-trend-badge stat-trend-badge-success">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M4 16l6-6 4 4 6-8" />
                <path d="M14 6h6v6" />
              </svg>
            </div>
            <div class="stat-label">{{ $t('dashboard.lastBiggestIncome') }}</div>
            <div class="stat-value text-success">
              {{
                formatMoney(
                  dashboard.lastBiggestIncome.amount,
                  dashboard.lastBiggestIncome.currency,
                  true,
                )
              }}
            </div>
            <div class="stat-footnote">
              <span class="stat-footnote-label"
                >{{ dashboard.lastBiggestIncome.thirdParty }} ·
                {{ formatDate(dashboard.lastBiggestIncome.valueDate) }}</span
              >
            </div>
          </div>
          <div
            v-if="dashboard.lastBiggestExpense"
            class="stat-card"
            data-testid="last-biggest-expense"
          >
            <div class="stat-trend-badge stat-trend-badge-danger">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M4 8l6 6 4-4 6 8" />
                <path d="M14 18h6v-6" />
              </svg>
            </div>
            <div class="stat-label">{{ $t('dashboard.lastBiggestExpense') }}</div>
            <div class="stat-value text-danger">
              {{
                formatMoney(
                  dashboard.lastBiggestExpense.amount,
                  dashboard.lastBiggestExpense.currency,
                  true,
                )
              }}
            </div>
            <div class="stat-footnote">
              <span class="stat-footnote-label"
                >{{ dashboard.lastBiggestExpense.thirdParty }} ·
                {{ formatDate(dashboard.lastBiggestExpense.valueDate) }}</span
              >
            </div>
          </div>
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
          <router-link
            v-for="account in accountTiles"
            :key="account.id"
            :to="{ name: 'operations', params: { accountId: account.id } }"
            class="stat-card acct-tile"
            data-testid="overview-account"
          >
            <div class="stat-label">{{ account.bankName }} — {{ account.name }}</div>
            <div
              class="stat-value stat-value-primary"
              :class="{ 'text-danger': account.balance < 0 }"
            >
              {{ formatMoney(account.balance, account.currency, true) }}
            </div>
            <div class="stat-footnote">
              <span class="stat-footnote-label">{{ $t('dashboard.totalReconciled') }}</span>
              <span class="stat-footnote-value">
                {{ formatMoney(account.reconciledBalance, account.currency, true) }}
              </span>
            </div>
            <AccountSparkline
              :values="account.history"
              :color="colorForCurrency(account.currency)"
              class="mt-2"
            />
          </router-link>
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
          <RankedChart
            v-if="entry.kind === 'distribution'"
            :facets="toDistributionFacets(entry.distribution, t)"
          />
          <SynthesisChart
            v-else
            :series="toChartSeries(entry.series, t)"
            :axis-bounds="entry.series.axisBounds"
          />
        </div>
      </section>
    </template>
  </div>
</template>
