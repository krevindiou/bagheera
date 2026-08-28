<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { apiClient } from "../../api/client";
import SynthesisChart, { type SynthesisChartSeries } from "../../components/SynthesisChart.vue";
import type { Account } from "../accounts/accounts.types";
import BatchActions from "./batch.vue";
import ReportForm from "./ReportForm.vue";
import type { Report, ReportChart } from "./reports.types";
import ToastContainer from "../../components/ToastContainer.vue";

const { t } = useI18n();

const queryClient = useQueryClient();

const reportsQuery = useQuery({
  queryKey: ["reports"],
  queryFn: async () => {
    const { data } = await apiClient.GET("/reports");
    return (data as Report[] | undefined) ?? [];
  },
});
const reports = computed(() => reportsQuery.data.value ?? []);

const accountsQuery = useQuery({
  queryKey: ["accounts"],
  queryFn: async () => {
    const { data } = await apiClient.GET("/accounts");
    return (data as Account[] | undefined) ?? [];
  },
});
const accounts = computed(() => accountsQuery.data.value ?? []);

async function reloadReports() {
  await queryClient.invalidateQueries({ queryKey: ["reports"] });
}

const showForm = ref(false);
const createType = ref<"sum" | "average">("sum");
const editingReport = ref<Report | null>(null);
const viewingReportId = ref<number | null>(null);
const selectedIds = ref<Set<number>>(new Set());
const selectedIdList = computed(() => Array.from(selectedIds.value));

watch(
  () => reportsQuery.data.value,
  () => {
    selectedIds.value = new Set();
  },
);

const CHART_COLORS = { debit: "#dc3545", credit: "#198754" };

function toggleSelected(id: number) {
  const next = new Set(selectedIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedIds.value = next;
}

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
  await reloadReports();
}

async function onBatchDeleted() {
  viewingReportId.value = null;
  await reloadReports();
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

const chartQuery = useQuery({
  queryKey: computed(() => ["report-chart", viewingReportId.value]),
  queryFn: async () => {
    const { data } = await apiClient.GET("/reports/{id}/chart", {
      params: { path: { id: viewingReportId.value! } },
    });
    return (data as ReportChart | undefined) ?? null;
  },
  enabled: computed(() => viewingReportId.value !== null),
});
const chartSeries = computed<SynthesisChartSeries[]>(() => {
  const chart = chartQuery.data.value;
  return !chart || chart.hidden ? [] : toChartSeries(chart);
});
const chartAxisBounds = computed(() => {
  const chart = chartQuery.data.value;
  return !chart || chart.hidden ? null : chart.axisBounds;
});

function toggleView(report: Report) {
  viewingReportId.value = viewingReportId.value === report.id ? null : report.id;
}
</script>

<template>
  <div class="container py-5">
    <h1>{{ $t("reports.title") }}</h1>
    <ToastContainer />

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
