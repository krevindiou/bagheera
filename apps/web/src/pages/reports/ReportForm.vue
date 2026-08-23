<script setup lang="ts">
import { ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useI18n } from "vue-i18n";
import { apiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import type { Account } from "../accounts/accounts.types";
import { reportSchema, type ReportForm } from "./reports.schemas";
import type { Report } from "./reports.types";

const props = defineProps<{
  accounts: Account[];
  report?: Report | null;
}>();
const emit = defineEmits<{ saved: []; cancel: [] }>();

const { push: toast } = useToast();
const { t } = useI18n();

function initialValues(): ReportForm {
  const r = props.report;
  if (!r) {
    return {
      type: "sum",
      title: "",
      homepage: false,
      valueDateStart: undefined,
      valueDateEnd: undefined,
      thirdParties: undefined,
      accountIds: [],
      reconciledOnly: undefined,
      periodGrouping: "month",
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
    reconciledOnly: r.reconciledOnly ?? undefined,
    periodGrouping: r.periodGrouping,
  };
}

const { defineField, handleSubmit, errors, isSubmitting } = useForm<ReportForm>({
  validationSchema: toTypedSchema(reportSchema),
  initialValues: initialValues(),
});
const [type, typeAttrs] = defineField("type");
const [title, titleAttrs] = defineField("title");
const [homepage, homepageAttrs] = defineField("homepage");
const [valueDateStart, valueDateStartAttrs] = defineField("valueDateStart");
const [valueDateEnd, valueDateEndAttrs] = defineField("valueDateEnd");
const [thirdParties, thirdPartiesAttrs] = defineField("thirdParties");
const [accountIds, accountIdsAttrs] = defineField("accountIds");
const [periodGrouping, periodGroupingAttrs] = defineField("periodGrouping");

// reconciledOnly is a true tri-state (yes/no/either) — bridged through a
// string select since the form's boolean|undefined can't drive a
// checkbox's two states.
const reconciledOnly = ref<"" | "true" | "false">(
  props.report?.reconciledOnly === true
    ? "true"
    : props.report?.reconciledOnly === false
      ? "false"
      : "",
);

const onSubmit = handleSubmit(async (submitted) => {
  const body = {
    type: submitted.type,
    title: submitted.title,
    homepage: submitted.homepage,
    valueDateStart: submitted.valueDateStart,
    valueDateEnd: submitted.valueDateEnd,
    thirdParties: submitted.thirdParties,
    accountIds: submitted.accountIds,
    reconciledOnly: reconciledOnly.value === "" ? undefined : reconciledOnly.value === "true",
    periodGrouping: submitted.periodGrouping,
  };

  const { error, response } = props.report
    ? await apiClient.PATCH("/reports/{id}", {
        params: { path: { id: props.report.id } },
        body,
      })
    : await apiClient.POST("/reports", { body });

  if (!response.ok) {
    toast(errorMessage(error) ?? t("reports.genericError"), "error");
    return;
  }

  toast(t("reports.saved"), "success");
  emit("saved");
});

function errorMessage(error: unknown): string | undefined {
  if (error && typeof error === "object" && "message" in error) {
    const { message } = error as { message: string | string[] };
    return Array.isArray(message) ? message[0] : message;
  }
  return undefined;
}

watch(
  () => props.report,
  () => {
    reconciledOnly.value =
      props.report?.reconciledOnly === true
        ? "true"
        : props.report?.reconciledOnly === false
          ? "false"
          : "";
  },
);
</script>

<template>
  <form novalidate class="border rounded p-3 mb-4" @submit="onSubmit">
    <h2 class="h5">{{ $t(props.report ? "reports.editTitle" : "reports.createTitle") }}</h2>

    <div class="mb-3">
      <div class="form-check form-check-inline">
        <input
          id="report-type-sum"
          v-model="type"
          v-bind="typeAttrs"
          class="form-check-input"
          type="radio"
          value="sum"
        />
        <label class="form-check-label" for="report-type-sum">{{ $t("reports.sum") }}</label>
      </div>
      <div class="form-check form-check-inline">
        <input
          id="report-type-average"
          v-model="type"
          v-bind="typeAttrs"
          class="form-check-input"
          type="radio"
          value="average"
        />
        <label class="form-check-label" for="report-type-average">{{
          $t("reports.average")
        }}</label>
      </div>
    </div>

    <div class="mb-3">
      <label class="form-label" for="report-title">{{ $t("reports.reportTitle") }}</label>
      <input
        id="report-title"
        v-model="title"
        v-bind="titleAttrs"
        type="text"
        class="form-control"
        :class="{ 'is-invalid': errors.title }"
      />
      <div v-if="errors.title" class="invalid-feedback">{{ $t("auth.validation.required") }}</div>
    </div>

    <div class="mb-3 form-check">
      <input
        id="report-homepage"
        v-model="homepage"
        v-bind="homepageAttrs"
        type="checkbox"
        class="form-check-input"
      />
      <label class="form-check-label" for="report-homepage">{{ $t("reports.homepage") }}</label>
    </div>

    <div class="row mb-3">
      <div class="col">
        <label class="form-label" for="report-value-date-start">{{ $t("reports.dateFrom") }}</label>
        <input
          id="report-value-date-start"
          v-model="valueDateStart"
          v-bind="valueDateStartAttrs"
          type="date"
          class="form-control"
        />
      </div>
      <div class="col">
        <label class="form-label" for="report-value-date-end">{{ $t("reports.dateTo") }}</label>
        <input
          id="report-value-date-end"
          v-model="valueDateEnd"
          v-bind="valueDateEndAttrs"
          type="date"
          class="form-control"
        />
      </div>
    </div>

    <div class="mb-3">
      <label class="form-label" for="report-third-parties">{{ $t("operations.thirdParty") }}</label>
      <input
        id="report-third-parties"
        v-model="thirdParties"
        v-bind="thirdPartiesAttrs"
        type="text"
        class="form-control"
      />
    </div>

    <div class="mb-3">
      <label class="form-label" for="report-accounts">{{ $t("reports.accounts") }}</label>
      <select
        id="report-accounts"
        v-model="accountIds"
        v-bind="accountIdsAttrs"
        multiple
        class="form-select"
      >
        <option v-for="a in props.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
      <div class="form-text">{{ $t("reports.accountsHint") }}</div>
    </div>

    <div class="mb-3">
      <label class="form-label" for="report-reconciled">{{ $t("operations.reconciled") }}</label>
      <select id="report-reconciled" v-model="reconciledOnly" class="form-select">
        <option value="">{{ $t("operations.search.any") }}</option>
        <option value="true">{{ $t("operations.search.yes") }}</option>
        <option value="false">{{ $t("operations.search.no") }}</option>
      </select>
    </div>

    <div class="mb-3">
      <label class="form-label" for="report-period-grouping">{{
        $t("reports.periodGrouping")
      }}</label>
      <select
        id="report-period-grouping"
        v-model="periodGrouping"
        v-bind="periodGroupingAttrs"
        class="form-select"
      >
        <option value="month">{{ $t("reports.periods.month") }}</option>
        <option value="quarter">{{ $t("reports.periods.quarter") }}</option>
        <option value="year">{{ $t("reports.periods.year") }}</option>
        <option value="all">{{ $t("reports.periods.all") }}</option>
      </select>
    </div>

    <div class="d-flex gap-2">
      <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
        {{ $t("operations.submit") }}
      </button>
      <button type="button" class="btn btn-outline-secondary" @click="emit('cancel')">
        {{ $t("common.cancel") }}
      </button>
    </div>
  </form>
</template>
