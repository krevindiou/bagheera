<script setup lang="ts">
import { toMinorUnits } from '@bagheera/money';
import { computed } from 'vue';
import AppIcon from '../../components/AppIcon.vue';
import CategorySelect from '../../components/CategorySelect.vue';
import { formatDate, formatMoney } from '../../domain/money';
import type { PreviewRow } from './import.types';
import { canEditLabel, canReconcileRecorded } from './importRows';
import ImportLabelEditor from './ImportLabelEditor.vue';
import SuggestionMark from './SuggestionMark.vue';
import type { RowChoices } from './useImportChoices';

// One row of the import preview: what the file says, what will become of it,
// and the choices the Member can change on it.
const props = defineProps<{
  row: PreviewRow;
  currency: string;
  choices: RowChoices;
  // Whether a skipped row is imported anyway.
  included: boolean;
  // Whether the confirmation reconciles the operation a skipped row matches.
  reconciles: boolean;
  // Whether the label of the row is being edited.
  editing: boolean;
}>();

const emit = defineEmits<{
  'toggle-included': [line: number];
  'toggle-reconcile': [line: number];
  'start-edit': [line: number];
  keep: [change: { thirdParty: string; remember: boolean }];
  cancel: [];
}>();

const willBeImported = computed(
  () => props.row.status === 'import' || (props.row.status === 'skipped' && props.included),
);

const amountLabel = computed(() => {
  const { amount, type } = props.row;
  if (amount === null) return '';
  return `${type === 'debit' ? '-' : '+'}${formatMoney(toMinorUnits(amount), props.currency)}`;
});
</script>

<template>
  <tr
    :data-testid="`import-row-${row.status}`"
    :class="{ 'text-muted': row.status === 'skipped' && !included }"
  >
    <td
      class="import-status-cell"
      :class="{ 'import-status-cell--wide': row.status !== 'import' }"
      :data-label="$t('operations.import.preview.status')"
    >
      <template v-if="row.status === 'skipped'">
        <label class="d-flex align-items-center gap-2 mb-0 text-nowrap">
          <input
            type="checkbox"
            :checked="included"
            data-testid="import-include"
            @change="emit('toggle-included', row.line)"
          />
          {{ $t('operations.import.preview.includeAnyway') }}
        </label>
        <label
          v-if="canReconcileRecorded(row)"
          class="d-flex align-items-center gap-2 mb-0 small text-nowrap"
          :title="$t('operations.import.preview.reconcileRecordedTitle')"
        >
          <input
            type="checkbox"
            :checked="reconciles"
            :disabled="included"
            data-testid="import-reconcile-recorded"
            @change="emit('toggle-reconcile', row.line)"
          />
          {{ $t('operations.import.preview.reconcileRecorded') }}
        </label>
      </template>
      <template v-else-if="row.status === 'invalid'">
        <span class="text-danger">
          {{ $t(`operations.import.reasons.${row.reason}`) }}
        </span>
      </template>
      <template v-else>{{ $t('operations.import.preview.willImport') }}</template>
      <div class="small text-muted" data-testid="import-line">
        {{ $t('operations.import.preview.line', { line: row.line }) }}
      </div>
    </td>
    <template v-if="row.status === 'invalid'">
      <td class="import-detail-cell" colspan="5">
        <ImportLabelEditor
          v-if="editing"
          :line="row.line"
          :initial-text="choices.editorText(row)"
          :initial-remember="choices.labelRemember(row.line)"
          @keep="emit('keep', $event)"
          @cancel="emit('cancel')"
        />
        <template v-else>
          <span
            v-if="row.sourceLabel"
            class="text-muted small text-break"
            data-testid="import-source-label"
          >
            {{ $t('operations.import.preview.fileLabel', { label: row.sourceLabel }) }}
          </span>
          <button
            v-if="canEditLabel(row)"
            type="button"
            class="btn btn-link btn-sm p-0 ms-1 align-baseline text-muted"
            :title="$t('operations.edit')"
            :aria-label="$t('operations.import.preview.changeLabel', { line: row.line })"
            data-testid="import-change-label"
            @click="emit('start-edit', row.line)"
          >
            <AppIcon name="edit" :size="14" />
          </button>
        </template>
      </td>
    </template>
    <template v-else>
      <td class="import-date-cell text-nowrap" :data-label="$t('operations.valueDate')">
        {{ row.valueDate ? formatDate(row.valueDate) : '' }}
      </td>
      <td class="import-third-party-cell" :data-label="$t('operations.thirdParty')">
        <ImportLabelEditor
          v-if="editing"
          :line="row.line"
          :initial-text="choices.editorText(row)"
          :initial-remember="choices.labelRemember(row.line)"
          @keep="emit('keep', $event)"
          @cancel="emit('cancel')"
        />
        <template v-else>
          <span data-testid="import-third-party">{{ row.thirdParty }}</span>
          <span
            v-if="row.labelOrigin && row.labelOrigin !== 'file'"
            class="badge text-bg-light ms-2"
            data-testid="import-label-origin"
          >
            {{ $t(`operations.import.preview.origin.${row.labelOrigin}`) }}
          </span>
          <button
            type="button"
            class="btn btn-link btn-sm p-0 ms-1 align-baseline text-muted"
            :title="$t('operations.edit')"
            :aria-label="$t('operations.import.preview.changeLabel', { line: row.line })"
            data-testid="import-change-label"
            @click="emit('start-edit', row.line)"
          >
            <AppIcon name="edit" :size="14" />
          </button>
          <div
            v-if="row.sourceLabel"
            class="import-source-label text-muted small text-truncate"
            :title="row.sourceLabel"
            data-testid="import-source-label"
          >
            {{ $t('operations.import.preview.fileLabel', { label: row.sourceLabel }) }}
          </div>
          <div v-if="row.recorded" class="small text-break mt-1" data-testid="import-recorded">
            {{
              $t(`operations.import.preview.recordedBy.${row.recorded.matchedBy}`, {
                date: formatDate(row.recorded.valueDate),
                thirdParty: row.recorded.thirdParty,
              })
            }}
            <span v-if="row.recorded.reconciled" data-testid="import-recorded-reconciled">
              {{ $t('operations.import.preview.recordedReconciled') }}
            </span>
          </div>
        </template>
      </td>
      <td
        class="import-amount-cell text-end text-nowrap"
        :class="row.type === 'debit' ? 'text-danger' : 'text-success'"
        :data-label="$t('operations.amount')"
      >
        {{ amountLabel }}
      </td>
      <td class="import-method-cell" :data-label="$t('operations.paymentMethod')">
        <div v-if="row.paymentMethodId" class="d-flex align-items-center gap-1">
          <select
            class="form-select form-select-sm"
            :value="choices.shownChoice(row)"
            :title="choices.choiceTitle(row)"
            :aria-label="
              $t('operations.import.preview.changePaymentMethod', {
                line: row.line,
              })
            "
            data-testid="import-row-payment-method"
            @change="choices.pickChoice(row, ($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="method in choices.plainMethodsFor(row)"
              :key="method.id"
              :value="method.id"
            >
              {{ choices.methodName(method.id) }}
            </option>
            <optgroup :label="$t('operations.import.preview.transfers')">
              <option
                v-for="option in choices.transferOptions(row)"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </optgroup>
          </select>
          <SuggestionMark
            v-if="row.transferAccountOrigin === 'history' && !choices.transferPicked(row.line)"
            :label="$t('operations.import.preview.transferSuggested')"
            data-testid="import-transfer-suggested"
          />
          <SuggestionMark
            v-else-if="row.paymentMethodOrigin === 'history' && !choices.methodPicked(row.line)"
            :label="$t('operations.import.preview.paymentMethodSuggested')"
            data-testid="import-method-suggested"
          />
        </div>
        <div
          v-if="
            row.paymentMethodId &&
            choices.isTransfer(row) &&
            willBeImported &&
            choices.mirrorAccountName(row)
          "
          class="text-muted small"
          data-testid="import-transfer-mirror"
        >
          {{
            $t('operations.import.preview.transferMirror', {
              account: choices.mirrorAccountName(row),
            })
          }}
        </div>
      </td>
      <td class="import-category-cell" :data-label="$t('operations.category')">
        <div v-if="row.paymentMethodId" class="d-flex align-items-center gap-1">
          <CategorySelect
            class="form-select-sm"
            :model-value="choices.shownCategory(row)"
            :title="choices.categoryTitle(row)"
            :groups="choices.categoriesFor(row)"
            :all-categories="choices.allCategories()"
            :empty-label="$t('operations.noCategory')"
            :aria-label="$t('operations.import.preview.changeCategory', { line: row.line })"
            data-testid="import-row-category"
            @update:model-value="choices.pickCategory(row, $event)"
          />
          <SuggestionMark
            v-if="row.categoryOrigin === 'history' && !choices.categoryPicked(row.line)"
            :label="$t('operations.import.preview.categorySuggested')"
            data-testid="import-category-suggested"
          />
        </div>
      </td>
    </template>
  </tr>
</template>

<style scoped>
/* The name takes what the other columns leave, and the larger share of it:
   their selects would otherwise take it all. The label of the file below it
   keeps to one line. */
.import-third-party-cell {
  min-width: 9rem;
  width: 32%;
}

/* The label of the file is cut to the width the column has; its length must
   not widen the column. */
.import-source-label {
  contain: inline-size;
}

.import-status-cell {
  min-width: 9.5rem;
  max-width: 12rem;
}

.import-status-cell:not(.import-status-cell--wide) {
  white-space: nowrap;
}

/* A select shows only what fits: keep the payment method and the category
   readable, "Parent > Child" included. */
.import-method-cell select {
  min-width: 11.5rem;
}

.import-category-cell select {
  min-width: 9.5rem;
}

/* The table needs about 57rem. Where the page gives it less each row is a
   compact card on a grid of six parts: status, date and amount on top, the
   third party across, the payment method and the category side by side. On a
   phone the parts stack. */
@container import-rows-box (max-width: 60rem) {
  .import-rows tr {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 0.25rem 0.75rem;
    margin-bottom: 0.75rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--bs-border-color);
    border-radius: var(--bs-border-radius);
  }

  .import-rows td,
  .import-rows td.import-status-cell {
    width: auto;
    min-width: 0;
    max-width: none;
    padding: 0.125rem 0;
    text-align: left !important;
    border: 0;
  }

  .import-rows td.import-status-cell,
  .import-rows td.import-date-cell,
  .import-rows td.import-amount-cell {
    grid-column: span 2;
  }

  /* Status, date and amount on top, then the third party, then the two
     choices: the order of the columns would put the third party second. */
  .import-rows td.import-status-cell {
    order: 1;
  }

  .import-rows td.import-date-cell {
    order: 2;
  }

  .import-rows td.import-amount-cell {
    order: 3;
  }

  .import-rows td.import-third-party-cell,
  .import-rows td.import-detail-cell {
    order: 4;
  }

  .import-rows td.import-method-cell {
    order: 5;
  }

  .import-rows td.import-category-cell {
    order: 6;
  }

  .import-rows td.import-status-cell--wide,
  .import-rows td.import-third-party-cell,
  .import-rows td.import-detail-cell {
    grid-column: 1 / -1;
  }

  .import-rows td.import-method-cell,
  .import-rows td.import-category-cell {
    grid-column: span 3;
  }

  .import-method-cell select,
  .import-category-cell select {
    min-width: 0;
  }

  .import-rows td[data-label]::before {
    display: block;
    font-size: 0.75rem;
    color: var(--bs-secondary-color);
    content: attr(data-label);
  }
}

@container import-rows-box (max-width: 36rem) {
  .import-rows td.import-status-cell,
  .import-rows td.import-date-cell,
  .import-rows td.import-amount-cell,
  .import-rows td.import-method-cell,
  .import-rows td.import-category-cell {
    grid-column: 1 / -1;
  }
}
</style>
