<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiClient } from '../../api/client';
import RankedChart from '../../components/RankedChart.vue';
import SynthesisChart, { type SynthesisChartSeries } from '../../components/SynthesisChart.vue';
import { useConfirm } from '../../composables/useConfirm';
import { useSelection } from '../../composables/useSelection';
import { useToast } from '../../composables/useToast';
import type { Account } from '../accounts/accounts.types';
import type { Category } from '../operations/operations.types';
import BatchActions from './batch.vue';
import { toChartSeries } from './chartSeries';
import { toDistributionFacets } from './distributionSeries';
import ReportForm from './ReportForm.vue';
import type { Report, ReportDistribution, ReportSeries } from './reports.types';
import ToastContainer from '../../components/ToastContainer.vue';
import IconButton from '../../components/IconButton.vue';

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

const categoriesQuery = useQuery({
  queryKey: ['categories'],
  queryFn: async () => {
    const { data } = await apiClient.GET('/reference-data/categories');
    return (data as Category[] | undefined) ?? [];
  },
});
const categories = computed(() => categoriesQuery.data.value ?? []);

async function reloadReports() {
  await queryClient.invalidateQueries({ queryKey: ['reports'] });
}

const showForm = ref(false);
const createType = ref<'sum' | 'average' | 'distribution'>('sum');
const editingReport = ref<Report | null>(null);
const viewingReportId = ref<string | null>(null);
const { selectedIds, selectedIdList, toggleSelected } = useSelection();

const viewingReport = computed(
  () => reports.value.find((r) => r.id === viewingReportId.value) ?? null,
);

watch(
  () => reportsQuery.data.value,
  () => {
    selectedIds.value = new Set();
  },
);

function startCreate(type: 'sum' | 'average' | 'distribution') {
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

const seriesQuery = useQuery({
  queryKey: computed(() => ['report-series', viewingReportId.value]),
  queryFn: async () => {
    const { data } = await apiClient.GET('/reports/{id}/series', {
      params: { path: { id: viewingReportId.value! } },
    });
    return (data as ReportSeries | undefined) ?? null;
  },
  enabled: computed(
    () => viewingReportId.value !== null && viewingReport.value?.type !== 'distribution',
  ),
});
const chartSeries = computed<SynthesisChartSeries[]>(() => {
  const series = seriesQuery.data.value;
  return !series || series.hidden ? [] : toChartSeries(series, t);
});
const chartAxisBounds = computed(() => {
  const series = seriesQuery.data.value;
  return !series || series.hidden ? null : series.axisBounds;
});

const distributionQuery = useQuery({
  queryKey: computed(() => ['report-distribution', viewingReportId.value]),
  queryFn: async () => {
    const { data } = await apiClient.GET('/reports/{id}/distribution', {
      params: { path: { id: viewingReportId.value! } },
    });
    return (data as ReportDistribution | undefined) ?? null;
  },
  enabled: computed(
    () => viewingReportId.value !== null && viewingReport.value?.type === 'distribution',
  ),
});
const distributionFacets = computed(() => {
  const distribution = distributionQuery.data.value;
  return !distribution || distribution.hidden ? [] : toDistributionFacets(distribution, t);
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
        <button
          type="button"
          class="btn btn-outline-secondary"
          @click="startCreate('distribution')"
        >
          {{ $t('reports.newDistributionReport') }}
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
                    <IconButton
                      :icon="viewingReportId === report.id ? 'hide' : 'view'"
                      :label="
                        viewingReportId === report.id
                          ? $t('reports.hideChart')
                          : $t('reports.viewChart')
                      "
                      @click="toggleView(report)"
                    />
                    <IconButton
                      icon="edit"
                      :label="$t('operations.edit')"
                      @click="startEdit(report)"
                    />
                    <IconButton
                      icon="trash"
                      danger
                      :label="$t('accounts.delete')"
                      @click="deleteReport(report)"
                    />
                  </div>
                </td>
              </tr>
              <tr v-if="viewingReportId === report.id">
                <td colspan="4">
                  <RankedChart v-if="report.type === 'distribution'" :facets="distributionFacets" />
                  <SynthesisChart v-else :series="chartSeries" :axis-bounds="chartAxisBounds" />
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
      :categories="categories"
      :report="editingReport"
      :default-type="createType"
      @saved="onSaved"
      @cancel="showForm = false"
    />
  </div>
</template>
