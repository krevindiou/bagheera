<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiClient } from '../../api/client';
import SynthesisChart, { type SynthesisChartSeries } from '../../components/SynthesisChart.vue';
import { useConfirm } from '../../composables/useConfirm';
import { useSelection } from '../../composables/useSelection';
import { useToast } from '../../composables/useToast';
import type { Account } from '../accounts/accounts.types';
import BatchActions from './batch.vue';
import { toChartSeries } from './chartSeries';
import ReportForm from './ReportForm.vue';
import type { Report, ReportChart } from './reports.types';
import ToastContainer from '../../components/ToastContainer.vue';

const { t } = useI18n();
const { confirm } = useConfirm();
const { push: toast } = useToast();

const queryClient = useQueryClient();

const reportsQuery = useQuery({
  queryKey: ['reports'],
  queryFn: async () => {
    const { data } = await apiClient.GET('/reports');
    return (data as Report[] | undefined) ?? [];
  },
});
const reports = computed(() => reportsQuery.data.value ?? []);

const accountsQuery = useQuery({
  queryKey: ['accounts'],
  queryFn: async () => {
    const { data } = await apiClient.GET('/accounts');
    return (data as Account[] | undefined) ?? [];
  },
});
const accounts = computed(() => accountsQuery.data.value ?? []);

async function reloadReports() {
  await queryClient.invalidateQueries({ queryKey: ['reports'] });
}

const showForm = ref(false);
const createType = ref<'sum' | 'average'>('sum');
const editingReport = ref<Report | null>(null);
const viewingReportId = ref<string | null>(null);
const { selectedIds, selectedIdList, toggleSelected } = useSelection();

watch(
  () => reportsQuery.data.value,
  () => {
    selectedIds.value = new Set();
  },
);

function startCreate(type: 'sum' | 'average') {
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

async function deleteReport(report: Report) {
  if (!(await confirm())) return;
  const { response } = await apiClient.DELETE('/reports/{id}', {
    params: { path: { id: report.id } },
  });
  if (!response.ok) {
    toast(t('reports.genericError'), 'error');
    return;
  }
  if (viewingReportId.value === report.id) viewingReportId.value = null;
  toast(t('reports.deleted'), 'success');
  await reloadReports();
}

const chartQuery = useQuery({
  queryKey: computed(() => ['report-chart', viewingReportId.value]),
  queryFn: async () => {
    const { data } = await apiClient.GET('/reports/{id}/chart', {
      params: { path: { id: viewingReportId.value! } },
    });
    return (data as ReportChart | undefined) ?? null;
  },
  enabled: computed(() => viewingReportId.value !== null),
});
const chartSeries = computed<SynthesisChartSeries[]>(() => {
  const chart = chartQuery.data.value;
  return !chart || chart.hidden ? [] : toChartSeries(chart, t);
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
  <div>
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
      <h1 class="mb-0">{{ $t('reports.title') }}</h1>
      <div v-if="!showForm" class="d-flex gap-2">
        <button type="button" class="btn btn-primary" @click="startCreate('sum')">
          {{ $t('reports.newSumReport') }}
        </button>
        <button type="button" class="btn btn-outline-secondary" @click="startCreate('average')">
          {{ $t('reports.newAverageReport') }}
        </button>
      </div>
    </div>
    <ToastContainer />

    <p v-if="reports.length === 0" class="text-muted">{{ $t('reports.empty') }}</p>

    <template v-else>
      <BatchActions :selected-ids="selectedIdList" @done="onBatchDeleted" />

      <div class="table-responsive">
        <table class="table" data-testid="reports-table">
          <thead>
            <tr>
              <th></th>
              <th>{{ $t('reports.type') }}</th>
              <th>{{ $t('reports.reportTitle') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="report in reports" :key="report.id">
              <tr
                :class="{ 'table-active': selectedIds.has(report.id) }"
                style="cursor: pointer"
                data-testid="report-row"
                @click="toggleView(report)"
              >
                <td @click.stop>
                  <input
                    type="checkbox"
                    data-testid="report-checkbox"
                    :checked="selectedIds.has(report.id)"
                    @change="toggleSelected(report.id)"
                  />
                </td>
                <td>
                  {{ $t(`reports.${report.type}`) }}
                </td>
                <td>
                  {{ report.title }}
                  <span v-if="report.homepage" class="pill pill-violet ms-2">{{
                    $t('reports.homepage')
                  }}</span>
                </td>
                <td @click.stop>
                  <div class="d-flex justify-content-end gap-2">
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-secondary btn-text"
                      @click="toggleView(report)"
                    >
                      {{
                        viewingReportId === report.id
                          ? $t('reports.hideChart')
                          : $t('reports.viewChart')
                      }}
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-secondary btn-text"
                      @click="startEdit(report)"
                    >
                      {{ $t('operations.edit') }}
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-danger btn-text btn-text-danger"
                      @click="deleteReport(report)"
                    >
                      {{ $t('accounts.delete') }}
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="viewingReportId === report.id">
                <td colspan="4">
                  <SynthesisChart :series="chartSeries" :axis-bounds="chartAxisBounds" />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>

    <ReportForm
      v-if="showForm"
      :accounts="accounts"
      :report="editingReport"
      :default-type="createType"
      @saved="onSaved"
      @cancel="showForm = false"
    />
  </div>
</template>
