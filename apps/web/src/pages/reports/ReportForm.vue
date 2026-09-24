<script setup lang="ts">
import { computed } from 'vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { useI18n } from 'vue-i18n';
import { apiClient } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import FormField from '../../components/FormField.vue';
import CategorySelect from '../../components/CategorySelect.vue';
import FormDrawer from '../../components/FormDrawer.vue';
import { useToast } from '../../composables/useToast';
import type { Account } from '../accounts/accounts.types';
import { groupCategories, type Category } from '../operations/operations.types';
import { MAX_SIGNIFICANT_RESULTS_NUMBER, reportSchema, type ReportForm } from './reports.schemas';
import type { Report } from './reports.types';

const props = defineProps<{
  accounts: Account[];
  categories: Category[];
  report?: Report | null;
  defaultType?: 'sum' | 'average' | 'distribution';
}>();

// Not type-scoped like an operation/scheduler form (a report spans both
// debit and credit operations), so every category is offered — grouped by
// parent, same as the search panel's multi-select.
const groupedCategories = computed(() => groupCategories(props.categories));
const emit = defineEmits<{ saved: []; cancel: [] }>();

const { push: toast } = useToast();
const { t, locale } = useI18n();

function initialValues(): ReportForm {
  const r = props.report;
  if (!r) {
    return {
      type: props.defaultType ?? 'sum',
      title: '',
      homepage: false,
      valueDateStart: undefined,
      valueDateEnd: undefined,
      thirdParties: undefined,
      accountIds: [],
      categoryIds: [],
      reconciledOnly: undefined,
      periodGrouping: 'year',
      dataGrouping: props.defaultType === 'distribution' ? 'category' : undefined,
      significantResultsNumber: props.defaultType === 'distribution' ? 5 : undefined,
    };
  }
  return {
    type: r.type,
    title: r.title,
    homepage: r.homepage,
    valueDateStart: r.valueDateStart ?? undefined,
    valueDateEnd: r.valueDateEnd ?? undefined,
    thirdParties: r.thirdParties ?? undefined,
    accountIds: r.accountIds,
    categoryIds: r.categoryIds,
    reconciledOnly: r.reconciledOnly ?? undefined,
    periodGrouping: r.periodGrouping ?? undefined,
    dataGrouping: r.dataGrouping ?? undefined,
    significantResultsNumber: r.significantResultsNumber ?? undefined,
  };
}

const { defineField, handleSubmit, errors, isSubmitting } = useForm<ReportForm>({
  validationSchema: toTypedSchema(reportSchema),
  initialValues: initialValues(),
});
const [title, titleAttrs] = defineField('title');
const [homepage, homepageAttrs] = defineField('homepage');
const [valueDateStart, valueDateStartAttrs] = defineField('valueDateStart');
const [valueDateEnd, valueDateEndAttrs] = defineField('valueDateEnd');
const [thirdParties, thirdPartiesAttrs] = defineField('thirdParties');
const [accountIds, accountIdsAttrs] = defineField('accountIds');
const [categoryIds, categoryIdsAttrs] = defineField('categoryIds');
const [reconciledOnly, reconciledOnlyAttrs] = defineField('reconciledOnly');
const [periodGrouping, periodGroupingAttrs] = defineField('periodGrouping');
const [dataGrouping, dataGroupingAttrs] = defineField('dataGrouping');
const [significantResultsNumber, significantResultsNumberAttrs] = defineField(
  'significantResultsNumber',
);

const reportType = props.report?.type ?? props.defaultType ?? 'sum';

const onSubmit = handleSubmit(async (submitted) => {
  const body = {
    type: submitted.type,
    title: submitted.title,
    homepage: submitted.homepage,
    valueDateStart: submitted.valueDateStart,
    valueDateEnd: submitted.valueDateEnd,
    thirdParties: submitted.thirdParties,
    accountIds: submitted.accountIds,
    categoryIds: submitted.categoryIds,
    reconciledOnly: submitted.reconciledOnly || undefined,
    periodGrouping: submitted.periodGrouping,
    dataGrouping: submitted.dataGrouping,
    significantResultsNumber: submitted.significantResultsNumber,
  };

  const { error, response } = props.report
    ? await apiClient.PATCH('/reports/{id}', {
        params: { path: { id: props.report.id } },
        body,
      })
    : await apiClient.POST('/reports', { body });

  if (!response.ok) {
    toast(errorMessage(error) ?? t('reports.genericError'), 'error');
    return;
  }

  toast(t('reports.saved'), 'success');
  emit('saved');
});
</script>

<template>
  <FormDrawer
    :title="$t(props.report ? 'reports.editTitle' : 'reports.createTitle')"
    :subtitle="$t(`reports.typeHint.${reportType}`)"
    novalidate
    @submit="onSubmit"
    @close="emit('cancel')"
  >
    <FormField
      :label="$t('reports.reportTitle')"
      for="report-title"
      :error="errors.title && $t('auth.validation.required')"
    >
      <input
        id="report-title"
        v-model="title"
        v-bind="titleAttrs"
        v-autofocus
        type="text"
        class="form-control"
        :class="{ 'is-invalid': errors.title }"
      />
    </FormField>

    <div class="row">
      <FormField class="col" :label="$t('reports.dateFrom')" for="report-value-date-start">
        <input
          id="report-value-date-start"
          v-model="valueDateStart"
          v-bind="valueDateStartAttrs"
          type="date"
          :lang="locale"
          class="form-control"
        />
      </FormField>
      <FormField
        class="col"
        :label="$t('reports.dateTo')"
        for="report-value-date-end"
        :error="errors.valueDateEnd && $t('reports.dateRangeInvalid')"
      >
        <input
          id="report-value-date-end"
          v-model="valueDateEnd"
          v-bind="valueDateEndAttrs"
          type="date"
          :lang="locale"
          class="form-control"
          :class="{ 'is-invalid': errors.valueDateEnd }"
        />
      </FormField>
    </div>

    <FormField
      :label="$t('operations.thirdParty')"
      for="report-third-parties"
      :hint="$t('reports.thirdPartiesHint')"
    >
      <input
        id="report-third-parties"
        v-model="thirdParties"
        v-bind="thirdPartiesAttrs"
        type="text"
        class="form-control"
      />
    </FormField>

    <FormField
      :label="$t('operations.category')"
      for="report-categories"
      :hint="$t('reports.categoriesHint')"
    >
      <CategorySelect
        id="report-categories"
        v-model="categoryIds"
        v-bind="categoryIdsAttrs"
        multiple
        :groups="groupedCategories"
        :all-categories="props.categories"
      />
    </FormField>

    <FormField
      :label="$t('reports.accounts')"
      for="report-accounts"
      :hint="$t('reports.accountsHint')"
    >
      <select
        id="report-accounts"
        v-model="accountIds"
        v-bind="accountIdsAttrs"
        multiple
        class="form-select"
      >
        <option v-for="a in props.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
    </FormField>

    <div class="mb-3 form-check">
      <input
        id="report-reconciled"
        v-model="reconciledOnly"
        v-bind="reconciledOnlyAttrs"
        type="checkbox"
        class="form-check-input"
      />
      <label class="form-check-label" for="report-reconciled">{{
        $t('reports.reconciledOnly')
      }}</label>
      <div class="form-text">{{ $t('reports.reconciledOnlyHint') }}</div>
    </div>

    <FormField
      v-if="reportType === 'distribution'"
      :label="$t('reports.dataGrouping')"
      for="report-data-grouping"
      :hint="$t('reports.dataGroupingHint')"
    >
      <select
        id="report-data-grouping"
        v-model="dataGrouping"
        v-bind="dataGroupingAttrs"
        class="form-select"
      >
        <option value="category">{{ $t('reports.dataGroupingOptions.category') }}</option>
        <option value="third_party">{{ $t('reports.dataGroupingOptions.thirdParty') }}</option>
        <option value="payment_method">
          {{ $t('reports.dataGroupingOptions.paymentMethod') }}
        </option>
      </select>
    </FormField>

    <FormField
      v-if="reportType === 'distribution'"
      :label="$t('reports.significantResultsNumber')"
      for="report-significant-results-number"
      :error="
        errors.significantResultsNumber &&
        $t('reports.significantResultsNumberInvalid', { max: MAX_SIGNIFICANT_RESULTS_NUMBER })
      "
      :hint="$t('reports.significantResultsNumberHint')"
    >
      <input
        id="report-significant-results-number"
        v-model.number="significantResultsNumber"
        v-bind="significantResultsNumberAttrs"
        type="number"
        min="1"
        max="50"
        class="form-control"
        :class="{ 'is-invalid': errors.significantResultsNumber }"
      />
    </FormField>

    <FormField
      :label="$t('reports.periodGrouping')"
      for="report-period-grouping"
      :hint="
        reportType === 'distribution'
          ? $t('reports.periodGroupingHintDistribution')
          : $t('reports.periodGroupingHint')
      "
    >
      <select
        id="report-period-grouping"
        v-model="periodGrouping"
        v-bind="periodGroupingAttrs"
        class="form-select"
      >
        <option value="month">{{ $t('reports.periods.month') }}</option>
        <option value="quarter">{{ $t('reports.periods.quarter') }}</option>
        <option value="year">{{ $t('reports.periods.year') }}</option>
        <option value="all">{{ $t('reports.periods.all') }}</option>
      </select>
    </FormField>

    <div class="mb-3 form-check">
      <input
        id="report-homepage"
        v-model="homepage"
        v-bind="homepageAttrs"
        type="checkbox"
        class="form-check-input"
      />
      <label class="form-check-label" for="report-homepage">{{ $t('reports.homepage') }}</label>
    </div>

    <template #actions>
      <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
        {{ $t('operations.submit') }}
      </button>
    </template>
  </FormDrawer>
</template>
