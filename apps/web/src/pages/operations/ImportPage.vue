<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import AppIcon from '../../components/AppIcon.vue';
import PagerNav from '../../components/PagerNav.vue';
import { useAccountContext } from '../../composables/useAccountContext';
import { usePageTitle } from '../../composables/useDocumentTitle';
import { useAccountsQuery, useBanksQuery } from '../../composables/useReferenceQueries';
import { accountLabel } from '../../domain/accounts';
import ImportDropZone from './ImportDropZone.vue';
import ImportPreviewRow from './ImportPreviewRow.vue';
import ImportStatementSummary from './ImportStatementSummary.vue';
import type { PreviewRow } from './import.types';
import { useImportChoices } from './useImportChoices';
import { PREVIEW_PAGE_SIZE, ROW_FILTERS, useImportRows } from './useImportRows';
import { useImportSession } from './useImportSession';

const route = useRoute();
const { t } = useI18n();

const accountId = computed(() => route.params.accountId as string);
const { account, bank, isFullyActive, currency } = useAccountContext(accountId);
const { accounts } = useAccountsQuery();
const { banks } = useBanksQuery();
const choices = useImportChoices(accountId);
usePageTitle(
  computed(() =>
    account.value ? `${account.value.name} · ${t('operations.import.title')}` : null,
  ),
);

const {
  upload,
  preview,
  included,
  uploading,
  previewing,
  confirming,
  fileName,
  reconcileImported,
  acceptMismatch,
  announcement,
  viewReset,
  accountMismatch,
  toImportCount,
  reconcileCount,
  reconcilesRecorded,
  uploadFile,
  runPreview,
  confirmImport,
  cancel,
  toggleIncluded,
  toggleReconcileRecorded,
  chooseReconcile,
} = useImportSession(accountId, choices);
const { filter, page, editingLine, filterCounts, filteredRows, pageRows } = useImportRows(
  preview,
  included,
  choices,
  viewReset,
);

function keepEdit(row: PreviewRow, change: { thirdParty: string; remember: boolean }) {
  choices.keepLabel(row, change);
  editingLine.value = null;
  // The change takes effect at once; no further step.
  if (choices.labelChangesPending.value) void runPreview(true);
}

const otherAccountName = computed(() => {
  const id = preview.value?.statement.otherAccountId;
  const other = id ? accounts.value.find((a) => a.id === id) : undefined;
  return other ? accountLabel(other, banks.value) : null;
});
</script>

<template>
  <div>
    <div class="visually-hidden" role="status" aria-live="polite" data-testid="import-announce">
      {{ announcement }}
    </div>

    <router-link :to="{ name: 'operations', params: { accountId } }" class="back-link">
      <AppIcon name="arrowLeft" :size="12" />
      {{ $t('operations.title') }}
    </router-link>

    <div class="d-flex flex-wrap align-items-baseline justify-content-between gap-2">
      <h1 class="mb-1" style="font-size: 24px">{{ $t('operations.import.title') }}</h1>
      <router-link
        :to="{ name: 'settings-label-corrections' }"
        class="small"
        data-testid="import-corrections-link"
      >
        {{ $t('operations.import.preview.manageCorrections') }}
      </router-link>
    </div>
    <p v-if="account" class="text-muted mb-3">{{ bank?.name }} — {{ account.name }}</p>
    <p v-if="!upload" class="mb-3" data-testid="import-intro">
      {{ $t('operations.import.intro') }} {{ $t('operations.import.notSaved') }}
    </p>

    <div v-if="account && !isFullyActive" class="alert alert-warning" data-testid="import-inactive">
      {{ $t('errors.account_not_active') }}
    </div>

    <template v-else>
      <section class="mb-4">
        <ImportDropZone :disabled="uploading" :file-name="fileName" @file="uploadFile" />
        <p v-if="uploading" role="status" class="text-muted mt-2">
          {{ $t('operations.import.uploading') }}
        </p>
      </section>

      <template v-if="upload">
        <section v-if="preview" data-testid="import-preview-section">
          <ImportStatementSummary
            v-model:accepted="acceptMismatch"
            :statement="preview.statement"
            :currency="currency"
            :other-account-name="otherAccountName"
          />

          <div class="mb-3" data-testid="import-options">
            <label class="d-flex align-items-center gap-2 mb-1">
              <input
                v-model="reconcileImported"
                type="checkbox"
                data-testid="import-reconcile"
                @change="chooseReconcile"
              />
              {{ $t('operations.import.reconcileImported') }}
            </label>
            <p
              v-if="reconcileCount > 0"
              class="text-muted small mb-0"
              data-testid="import-reconcile-recorded-count"
            >
              {{
                $t(
                  'operations.import.reconcileRecordedNote',
                  { count: reconcileCount },
                  reconcileCount,
                )
              }}
            </p>
          </div>

          <div
            class="d-flex flex-wrap gap-2 mb-3"
            role="group"
            :aria-label="$t('operations.import.preview.filters')"
            data-testid="import-filters"
          >
            <button
              v-for="option in ROW_FILTERS"
              :key="option"
              type="button"
              class="btn btn-sm"
              :class="filter === option ? 'btn-primary' : 'btn-outline-secondary'"
              :aria-pressed="filter === option"
              :data-testid="`import-filter-${option}`"
              @click="filter = option"
            >
              {{ $t(`operations.import.preview.filter.${option}`) }}
              <span class="badge text-bg-light ms-1">{{ filterCounts[option] }}</span>
            </button>
          </div>

          <div
            v-if="choices.labelChangesPending.value && !previewing"
            class="alert alert-warning d-flex flex-wrap align-items-center gap-3"
            role="alert"
            data-testid="import-pending-labels"
          >
            <span>
              {{
                $t(
                  'operations.import.preview.applyFailed',
                  { count: choices.labelEditCount.value },
                  choices.labelEditCount.value,
                )
              }}
            </span>
            <button
              type="button"
              class="btn btn-sm btn-primary"
              data-testid="import-apply-labels"
              @click="runPreview(true)"
            >
              {{ $t('operations.import.preview.retry') }}
            </button>
          </div>

          <p v-if="filteredRows.length === 0" class="text-muted">
            {{ $t('operations.import.preview.noRows') }}
          </p>
          <div v-else class="import-rows-box position-relative">
            <div v-if="previewing" class="import-busy" aria-hidden="true" data-testid="import-busy">
              <span class="spinner-border spinner-border-sm" />
              {{ $t('operations.import.preview.busy') }}
            </div>
            <div
              class="table-responsive"
              :class="{ 'import-rows--busy': previewing }"
              :aria-busy="previewing"
            >
              <table class="table import-rows" data-testid="import-rows">
                <thead>
                  <tr>
                    <th>{{ $t('operations.import.preview.status') }}</th>
                    <th>{{ $t('operations.valueDate') }}</th>
                    <th>{{ $t('operations.thirdParty') }}</th>
                    <th class="text-end">{{ $t('operations.amount') }}</th>
                    <th>{{ $t('operations.paymentMethod') }}</th>
                    <th>{{ $t('operations.category') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <ImportPreviewRow
                    v-for="row in pageRows"
                    :key="row.line"
                    :row="row"
                    :currency="currency"
                    :choices="choices"
                    :included="included.has(row.line)"
                    :reconciles="reconcilesRecorded(row.line)"
                    :editing="editingLine === row.line"
                    @toggle-included="toggleIncluded"
                    @toggle-reconcile="toggleReconcileRecorded"
                    @start-edit="editingLine = $event"
                    @keep="keepEdit(row, $event)"
                    @cancel="editingLine = null"
                  />
                </tbody>
              </table>
            </div>
          </div>
          <PagerNav
            :page="page"
            :total="filteredRows.length"
            :page-size="PREVIEW_PAGE_SIZE"
            @update:page="page = $event"
          />
        </section>
      </template>
    </template>

    <div class="import-actions mt-4" data-testid="import-actions">
      <p
        v-if="preview && toImportCount === 0 && reconcileCount === 0"
        class="text-muted mb-0"
        data-testid="import-nothing"
      >
        {{ $t('operations.import.nothingToImport') }}
      </p>
      <p v-else-if="preview" class="text-muted small mb-0" data-testid="import-not-saved">
        {{ $t('operations.import.notSaved') }}
      </p>
      <button
        v-if="preview"
        type="button"
        class="btn btn-primary"
        :disabled="
          (toImportCount === 0 && reconcileCount === 0) ||
          confirming ||
          choices.labelChangesPending.value ||
          previewing ||
          (accountMismatch && !acceptMismatch)
        "
        data-testid="import-confirm"
        @click="confirmImport"
      >
        {{
          toImportCount === 0 && reconcileCount > 0
            ? $t('operations.import.confirmReconcile', { count: reconcileCount }, reconcileCount)
            : $t('operations.import.confirm', { count: toImportCount }, toImportCount)
        }}
      </button>
      <button
        type="button"
        class="btn btn-outline-secondary"
        data-testid="import-cancel"
        @click="cancel"
      >
        {{ $t('common.cancel') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.import-actions {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0;
  background: var(--bs-body-bg);
  border-top: 1px solid var(--bs-border-color);
}

.import-busy {
  position: absolute;
  top: 0.5rem;
  left: 50%;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  transform: translateX(-50%);
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 1rem;
  box-shadow: var(--bs-box-shadow-sm);
}

.import-rows--busy {
  opacity: 0.5;
  pointer-events: none;
}

.import-rows-box {
  container: import-rows-box / inline-size;
}

/* Where the page gives the table less room than it needs (a narrow window
   beside the menu) each row is a compact card: see ImportPreviewRow. */
@container import-rows-box (max-width: 60rem) {
  .import-rows,
  .import-rows tbody {
    display: block;
    width: 100%;
  }

  .import-rows thead {
    display: none;
  }
}
</style>
