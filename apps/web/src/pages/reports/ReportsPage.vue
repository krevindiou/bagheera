<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { apiClient } from "../../api/client";
import SynthesisChart, { type SynthesisChartSeries } from "../../components/SynthesisChart.vue";
import type { Account } from "../accounts/accounts.types";
import BatchActions from "./batch.vue";
import ReportForm from "./ReportForm.vue";
import type { Report, ReportChart } from "./reports.types";

const { t } = useI18n();

const reports = ref<Report[]>([]);
const accounts = ref<Account[]>([]);
const showForm = ref(false);
const createType = ref<"sum" | "average">("sum");
const editingReport = ref<Report | null>(null);
const viewingReportId = ref<number | null>(null);
const chartSeries = ref<SynthesisChartSeries[]>([]);
const chartAxisBounds = ref<{ min: number; max: number } | null>(null);
const selectedIds = ref<Set<number>>(new Set());
const selectedIdList = computed(() => Array.from(selectedIds.value));

const CHART_COLORS = { debit: "#dc3545", credit: "#198754" };

async function loadReports() {
  const { data } = await apiClient.GET("/reports");
  reports.value = (data as Report[] | undefined) ?? [];
  selectedIds.value = new Set();
}

function toggleSelected(id: number) {
  const next = new Set(selectedIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedIds.value = next;
}

async function loadAccounts() {
  const { data } = await apiClient.GET("/accounts");
  accounts.value = (data as Account[] | undefined) ?? [];
}

onMounted(async () => {
  await Promise.all([loadReports(), loadAccounts()]);
});

function startCreate(type: "sum" | "average") {
  createType.value = type;
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

async function onBatchDeleted() {
  viewingReportId.value = null;
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

    <template v-else>
      <BatchActions :selected-ids="selectedIdList" @done="onBatchDeleted" />

      <ul class="list-unstyled">
        <li
          v-for="report in reports"
          :key="report.id"
          class="border rounded p-3 mb-3"
          :class="{ 'table-active': selectedIds.has(report.id) }"
          style="cursor: pointer"
          data-testid="report-row"
          @click="toggleView(report)"
        >
          <div class="d-flex align-items-center gap-2">
            <input
              type="checkbox"
              data-testid="report-checkbox"
              :checked="selectedIds.has(report.id)"
              @click.stop
              @change="toggleSelected(report.id)"
            />
            <h2 class="h6 mb-0">{{ report.title }}</h2>
            <span class="badge text-bg-secondary">{{ $t(`reports.${report.type}`) }}</span>
            <span v-if="report.homepage" class="badge text-bg-info">{{
              $t("reports.homepage")
            }}</span>
            <div class="ms-auto d-flex gap-2" @click.stop>
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
            </div>
          </div>
          <SynthesisChart
            v-if="viewingReportId === report.id"
            :series="chartSeries"
            :axis-bounds="chartAxisBounds"
          />
        </li>
      </ul>
    </template>

    <ReportForm
      v-if="showForm"
      :accounts="accounts"
      :report="editingReport"
      :default-type="createType"
      @saved="onSaved"
      @cancel="showForm = false"
    />
    <div v-else class="d-flex gap-2">
      <button type="button" class="btn btn-primary" @click="startCreate('sum')">
        {{ $t("reports.newSumReport") }}
      </button>
      <button type="button" class="btn btn-primary" @click="startCreate('average')">
        {{ $t("reports.newAverageReport") }}
      </button>
    </div>
  </div>
</template>
