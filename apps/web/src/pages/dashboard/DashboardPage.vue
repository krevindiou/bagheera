<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { apiClient } from "../../api/client";
import SynthesisChart, { type SynthesisChartSeries } from "../../components/SynthesisChart.vue";
import { formatMoney } from "../operations/money";
import type { ReportChart } from "../reports/reports.types";
import type { DashboardResponse, DashboardSynthesisChart } from "./dashboard.types";

const { t } = useI18n();

const dashboard = ref<DashboardResponse | null>(null);

const CHART_COLORS = { debit: "#dc3545", credit: "#198754" };
// Cycled by currency index — the synthesis chart is one line per currency
// (not a fixed debit/credit pair), so it needs its own small palette.
const SYNTHESIS_COLORS = ["#0d6efd", "#6f42c1", "#fd7e14", "#20c997", "#e83e8c", "#6610f2"];

async function load() {
  const { data } = await apiClient.GET("/dashboard");
  dashboard.value = (data as DashboardResponse | undefined) ?? null;
}

onMounted(load);

// Same per-currency debit/credit flattening as the reports page
// (apps/web/src/pages/reports/ReportsPage.vue).
function toChartSeries(chart: ReportChart): SynthesisChartSeries[] {
  const series: SynthesisChartSeries[] = [];
  for (const s of chart.series) {
    if (s.debit.length > 0) {
      series.push({
        label: `${s.currency} ${t("operations.debit")}`,
        color: CHART_COLORS.debit,
        points: s.debit,
      });
    }
    if (s.credit.length > 0) {
      series.push({
        label: `${s.currency} ${t("operations.credit")}`,
        color: CHART_COLORS.credit,
        points: s.credit,
      });
    }
  }
  return series;
}

function toSynthesisSeries(chart: DashboardSynthesisChart): SynthesisChartSeries[] {
  return chart.series.map((s, i) => ({
    label: s.currency,
    color: SYNTHESIS_COLORS[i % SYNTHESIS_COLORS.length],
    points: s.points,
  }));
}
</script>

<template>
  <div v-if="dashboard" class="container py-5">
    <h1 class="mb-4">{{ $t("dashboard.title") }}</h1>

    <div
      v-if="dashboard.onboarding === 'no-bank'"
      class="alert alert-info"
      data-testid="onboarding-tip"
    >
      {{ $t("dashboard.onboardingNoBank") }}
      <router-link :to="{ name: 'accounts' }">{{ $t("dashboard.onboardingCta") }}</router-link>
    </div>
    <div
      v-else-if="dashboard.onboarding === 'no-account'"
      class="alert alert-info"
      data-testid="onboarding-tip"
    >
      {{ $t("dashboard.onboardingNoAccount") }}
      <router-link :to="{ name: 'accounts' }">{{ $t("dashboard.onboardingCta") }}</router-link>
    </div>

    <template v-if="dashboard.onboarding !== 'no-bank'">
      <section class="mb-4">
        <h2 class="h5">{{ $t("dashboard.totalBalances") }}</h2>
        <p v-if="dashboard.totalBalances.length === 0" class="text-muted">
          {{ $t("dashboard.noBalances") }}
        </p>
        <ul v-else class="list-unstyled d-flex flex-wrap gap-3">
          <li
            v-for="balance in dashboard.totalBalances"
            :key="balance.currency"
            data-testid="total-balance"
            class="fs-4"
            :class="balance.amount >= 0 ? 'text-success' : 'text-danger'"
          >
            {{ formatMoney(balance.amount, balance.currency, true) }}
          </li>
        </ul>
      </section>

      <section class="mb-4 d-flex gap-4">
        <div v-if="dashboard.lastSalary" data-testid="last-salary">
          <h2 class="h6">{{ $t("dashboard.lastSalary") }}</h2>
          <p class="text-success fs-5 mb-0">
            {{ formatMoney(dashboard.lastSalary.amount, dashboard.lastSalary.currency, true) }}
          </p>
          <p class="text-muted small">{{ dashboard.lastSalary.valueDate }}</p>
        </div>
        <div v-if="dashboard.lastBiggestExpense" data-testid="last-biggest-expense">
          <h2 class="h6">{{ $t("dashboard.lastBiggestExpense") }}</h2>
          <p class="text-danger fs-5 mb-0">
            {{
              formatMoney(
                dashboard.lastBiggestExpense.amount,
                dashboard.lastBiggestExpense.currency,
                true,
              )
            }}
          </p>
          <p class="text-muted small">{{ dashboard.lastBiggestExpense.valueDate }}</p>
        </div>
      </section>

      <section v-if="!dashboard.synthesisChart.hidden" class="mb-4" data-testid="synthesis-chart">
        <h2 class="h5">{{ $t("dashboard.synthesisChart") }}</h2>
        <SynthesisChart
          :series="toSynthesisSeries(dashboard.synthesisChart)"
          :axis-bounds="dashboard.synthesisChart.axisBounds"
        />
      </section>

      <section class="mb-4">
        <h2 class="h5">{{ $t("dashboard.accountsOverview") }}</h2>
        <p v-if="dashboard.accountsOverview.length === 0" class="text-muted">
          {{ $t("dashboard.noAccounts") }}
        </p>
        <div
          v-for="bank in dashboard.accountsOverview"
          :key="bank.id"
          class="mb-3"
          data-testid="overview-bank"
        >
          <h3 class="h6">{{ bank.name }}</h3>
          <ul class="list-unstyled ms-3">
            <li v-for="account in bank.accounts" :key="account.id" data-testid="overview-account">
              <router-link :to="{ name: 'operations', params: { accountId: account.id } }">
                {{ account.name }}
              </router-link>
              — {{ formatMoney(account.balance, account.currency, true) }}
            </li>
          </ul>
        </div>
      </section>

      <section v-if="dashboard.homepageReports.length > 0">
        <h2 class="h5">{{ $t("dashboard.reportCharts") }}</h2>
        <div
          v-for="entry in dashboard.homepageReports"
          :key="entry.id"
          class="mb-4"
          data-testid="homepage-report"
        >
          <h3 class="h6">{{ entry.title }}</h3>
          <SynthesisChart
            :series="toChartSeries(entry.chart)"
            :axis-bounds="entry.chart.axisBounds"
          />
        </div>
      </section>
    </template>
  </div>
</template>
