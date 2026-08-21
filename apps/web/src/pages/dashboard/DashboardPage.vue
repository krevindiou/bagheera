<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { apiClient } from "../../api/client";
import { useSessionStore } from "../../stores/session.store";
import SynthesisChart, { type SynthesisChartSeries } from "../../components/SynthesisChart.vue";
import type { ReportChart } from "../reports/reports.types";
import type { DashboardResponse } from "./dashboard.types";

const router = useRouter();
const session = useSessionStore();
const { t } = useI18n();

const dashboard = ref<DashboardResponse | null>(null);

const CHART_COLORS = { debit: "#dc3545", credit: "#198754" };

async function load() {
  const { data } = await apiClient.GET("/dashboard");
  dashboard.value = (data as DashboardResponse | undefined) ?? null;
}

onMounted(load);

async function signOut() {
  await apiClient.POST("/auth/sign-out");
  session.clear();
  router.push({ name: "sign-in" });
}

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
</script>

<template>
  <div v-if="dashboard" class="container py-5">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="mb-0">{{ $t("dashboard.title") }}</h1>
      <div class="d-flex gap-2">
        <router-link :to="{ name: 'accounts' }" class="btn btn-outline-secondary btn-sm">
          {{ $t("home.accountsLink") }}
        </router-link>
        <router-link :to="{ name: 'reports' }" class="btn btn-outline-secondary btn-sm">
          {{ $t("dashboard.reportsLink") }}
        </router-link>
        <router-link :to="{ name: 'settings-profile' }" class="btn btn-outline-secondary btn-sm">
          {{ $t("home.profileLink") }}
        </router-link>
        <button type="button" class="btn btn-outline-secondary btn-sm" @click="signOut">
          {{ $t("home.signOut") }}
        </button>
      </div>
    </div>

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
          {{ balance.amount.toFixed(2) }} {{ balance.currency }}
        </li>
      </ul>
    </section>

    <section class="mb-4 d-flex gap-4">
      <div v-if="dashboard.lastSalary" data-testid="last-salary">
        <h2 class="h6">{{ $t("dashboard.lastSalary") }}</h2>
        <p class="text-success fs-5 mb-0">
          {{ dashboard.lastSalary.amount.toFixed(2) }} {{ dashboard.lastSalary.currency }}
        </p>
        <p class="text-muted small">{{ dashboard.lastSalary.valueDate }}</p>
      </div>
      <div v-if="dashboard.lastBiggestExpense" data-testid="last-biggest-expense">
        <h2 class="h6">{{ $t("dashboard.lastBiggestExpense") }}</h2>
        <p class="text-danger fs-5 mb-0">
          {{ dashboard.lastBiggestExpense.amount.toFixed(2) }}
          {{ dashboard.lastBiggestExpense.currency }}
        </p>
        <p class="text-muted small">{{ dashboard.lastBiggestExpense.valueDate }}</p>
      </div>
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
            — {{ account.balance.toFixed(2) }} {{ account.currency }}
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
  </div>
</template>
