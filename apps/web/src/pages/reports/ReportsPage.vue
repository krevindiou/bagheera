<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiClient } from '../../api/client';
import { useConfirm } from '../../composables/useConfirm';
import { useAccountsQuery, useCategoriesQuery } from '../../composables/useReferenceQueries';
import { useSelection } from '../../composables/useSelection';
import { useToast } from '../../composables/useToast';
import BatchActions from './batch.vue';
import ReportChart from './ReportChart.vue';
import ReportForm from './ReportForm.vue';
import type { Report, ReportChartData } from './reports.types';
import IconButton from '../../components/IconButton.vue';
import AppIcon from '../../components/AppIcon.vue';

const { t } = useI18n();
const { confirm } = useConfirm();
const { push: toast } = useToast();

const queryClient = useQueryClient();

const reportsQuery = useQuery({
  queryKey: ['reports'],
  queryFn: async () => {
    const { data } = await apiClient.GET('/reports');
    return data ?? [];
  },
});
const reports = computed(() => reportsQuery.data.value ?? []);

const { accounts } = useAccountsQuery();
const { categories } = useCategoriesQuery();

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
    return data ?? null;
  },
  enabled: computed(
    () => viewingReportId.value !== null && viewingReport.value?.type !== 'distribution',
  ),
});
const distributionQuery = useQuery({
  queryKey: computed(() => ['report-distribution', viewingReportId.value]),
  queryFn: async () => {
    const { data } = await apiClient.GET('/reports/{id}/distribution', {
      params: { path: { id: viewingReportId.value! } },
    });
    return data ?? null;
  },
  enabled: computed(
    () => viewingReportId.value !== null && viewingReport.value?.type === 'distribution',
  ),
});
const viewedChart = computed<ReportChartData | null>(() => {
  if (viewingReport.value?.type === 'distribution') {
    const distribution = distributionQuery.data.value;
    return distribution ? { kind: 'distribution', distribution } : null;
  }
  const series = seriesQuery.data.value;
  return series ? { kind: 'series', series } : null;
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
        <button
          type="button"
          class="btn btn-primary d-inline-flex align-items-center gap-1"
          @click="startCreate('sum')"
        >
          <AppIcon name="plus" :size="16" />
          {{ $t('reports.newSumReport') }}
        </button>
        <button
          type="button"
          class="btn btn-outline-secondary d-inline-flex align-items-center gap-1"
          @click="startCreate('average')"
        >
          <AppIcon name="plus" :size="16" />
          {{ $t('reports.newAverageReport') }}
        </button>
        <button
          type="button"
          class="btn btn-outline-secondary d-inline-flex align-items-center gap-1"
          @click="startCreate('distribution')"
        >
          <AppIcon name="plus" :size="16" />
          {{ $t('reports.newDistributionReport') }}
        </button>
      </div>
    </div>

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
                  <ReportChart :report="viewedChart" />
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
