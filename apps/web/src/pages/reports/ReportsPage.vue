<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { apiClient } from "../../api/client";
import { useConfirm } from "../../composables/useConfirm";
import { useToast } from "../../composables/useToast";
import SynthesisChart, { type SynthesisChartSeries } from "../../components/SynthesisChart.vue";
import type { Account } from "../accounts/accounts.types";
import ReportForm from "./ReportForm.vue";
import type { Report, ReportChart } from "./reports.types";

const { confirm } = useConfirm();
const { push: toast } = useToast();
const { t } = useI18n();

const reports = ref<Report[]>([]);
const accounts = ref<Account[]>([]);
const showForm = ref(false);
const editingReport = ref<Report | null>(null);
const viewingReportId = ref<number | null>(null);
const chartSeries = ref<SynthesisChartSeries[]>([]);
const chartAxisBounds = ref<{ min: number; max: number } | null>(null);

const CHART_COLORS = { debit: "#dc3545", credit: "#198754" };

async function loadReports() {
  const { data } = await apiClient.GET("/reports");
  reports.value = (data as Report[] | undefined) ?? [];
}

async function loadAccounts() {
  const { data } = await apiClient.GET("/accounts");
  accounts.value = (data as Account[] | undefined) ?? [];
}

onMounted(async () => {
  await Promise.all([loadReports(), loadAccounts()]);
});

function startCreate() {
  editingReport.value = null;
  showForm.value = true;
}

function startEdit(report: Report) {
  editingReport.value = report;
  showForm.value = true;
}

async function onSaved() {
  showForm.value = false;
  editingReport.value = null;
  await loadReports();
}

async function deleteReport(report: Report) {
  if (!(await confirm(t("reports.deleteConfirm", { title: report.title })))) return;
  const { response } = await apiClient.DELETE("/reports/{id}", {
    params: { path: { id: report.id } },
  });
  if (!response.ok) {
    toast(t("reports.genericError"), "error");
    return;
  }
  if (viewingReportId.value === report.id) viewingReportId.value = null;
  await loadReports();
}

// A report's chart is per-currency, each with a separate debit and credit
// series (apps/api/src/reports/chart.service.ts) — flattened into the
// shared chart component's series list, one entry per currency×type.
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

async function toggleView(report: Report) {
  if (viewingReportId.value === report.id) {
    viewingReportId.value = null;
    return;
  }
  const { data } = await apiClient.GET("/reports/{id}/chart", {
    params: { path: { id: report.id } },
  });
  const chart = data as ReportChart | undefined;
  if (!chart || chart.hidden) {
    chartSeries.value = [];
    chartAxisBounds.value = null;
  } else {
    chartSeries.value = toChartSeries(chart);
    chartAxisBounds.value = chart.axisBounds;
  }
  viewingReportId.value = report.id;
}
</script>

<template>
  <div class="container py-5">
    <h1>{{ $t("reports.title") }}</h1>

    <p v-if="reports.length === 0" class="text-muted">{{ $t("reports.empty") }}</p>

    <ul v-else class="list-unstyled">
      <li
        v-for="report in reports"
        :key="report.id"
        class="border rounded p-3 mb-3"
        data-testid="report-row"
      >
        <div class="d-flex align-items-center gap-2">
          <h2 class="h6 mb-0">{{ report.title }}</h2>
          <span class="badge text-bg-secondary">{{ $t(`reports.${report.type}`) }}</span>
          <span v-if="report.homepage" class="badge text-bg-info">{{
            $t("reports.homepage")
          }}</span>
          <div class="ms-auto d-flex gap-2">
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              @click="toggleView(report)"
            >
              {{
                viewingReportId === report.id ? $t("reports.hideChart") : $t("reports.viewChart")
              }}
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              @click="startEdit(report)"
            >
              {{ $t("operations.edit") }}
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-danger"
              @click="deleteReport(report)"
            >
              {{ $t("accounts.delete") }}
            </button>
          </div>
        </div>
        <SynthesisChart
          v-if="viewingReportId === report.id"
          :series="chartSeries"
          :axis-bounds="chartAxisBounds"
        />
      </li>
    </ul>

    <ReportForm
      v-if="showForm"
      :accounts="accounts"
      :report="editingReport"
      @saved="onSaved"
      @cancel="showForm = false"
    />
    <button v-else type="button" class="btn btn-primary" @click="startCreate">
      {{ $t("reports.addReport") }}
    </button>
  </div>
</template>
