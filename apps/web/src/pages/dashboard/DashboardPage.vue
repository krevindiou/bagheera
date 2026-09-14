<script setup lang="ts">
import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';
import { apiClient } from '../../api/client';
import SynthesisChart, { type SynthesisChartSeries } from '../../components/SynthesisChart.vue';
import { formatDate, formatMoney } from '../operations/money';
import { toChartSeries } from '../reports/chartSeries';
import type { DashboardResponse, DashboardSynthesisChart } from './dashboard.types';
import ToastContainer from '../../components/ToastContainer.vue';

const { t } = useI18n();

const { data: dashboard } = useQuery({
  queryKey: ['dashboard'],
  queryFn: async () => {
    const { data } = await apiClient.GET('/dashboard');
    return (data as DashboardResponse | undefined) ?? null;
  },
});

// Cycled by currency index — the synthesis chart is one line per currency
// (not a fixed debit/credit pair), so it needs its own small palette. Led
// by the theme's violet so a single-currency member (the common case) gets
// the "real Chart.js series in the same violet" the design calls for.
const SYNTHESIS_COLORS = ['#9a72e8', '#5fd98d', '#e8697a', '#c4a8f2', '#e0a94c', '#7c4fd1'];

function toSynthesisSeries(chart: DashboardSynthesisChart): SynthesisChartSeries[] {
  return chart.series.map((s, i) => ({
    label: s.currency,
    color: SYNTHESIS_COLORS[i % SYNTHESIS_COLORS.length],
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
    <ToastContainer />

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
              class="stat-value stat-value-primary"
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
          <div v-if="dashboard.lastSalary" class="stat-card" data-testid="last-salary">
            <div class="stat-label">{{ $t('dashboard.lastSalary') }}</div>
            <div class="stat-value text-success">
              {{ formatMoney(dashboard.lastSalary.amount, dashboard.lastSalary.currency, true) }}
            </div>
            <div class="mt-1" style="font-size: 12px; color: var(--paper-faint)">
              {{ formatDate(dashboard.lastSalary.valueDate) }}
            </div>
          </div>
          <div
            v-if="dashboard.lastBiggestExpense"
            class="stat-card"
            data-testid="last-biggest-expense"
          >
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
            <div class="mt-1" style="font-size: 12px; color: var(--paper-faint)">
              {{ formatDate(dashboard.lastBiggestExpense.valueDate) }}
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="!dashboard.synthesisChart.hidden"
        class="panel panel-lg mb-4 p-4"
        data-testid="synthesis-chart"
      >
        <h2 class="h6 mb-3">{{ $t('dashboard.synthesisChart') }}</h2>
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
          <SynthesisChart
            :series="toChartSeries(entry.chart, t)"
            :axis-bounds="entry.chart.axisBounds"
          />
        </div>
      </section>
    </template>
  </div>
</template>
