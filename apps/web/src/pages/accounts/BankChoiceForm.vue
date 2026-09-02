<script setup lang="ts">
import { watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useI18n } from "vue-i18n";
import { apiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import { bankChoiceSchema, type BankChoiceForm } from "./accounts.schemas";
import type { Bank } from "./accounts.types";

// "New account" starts here — choose one of the member's existing
// active banks, or create a new one — before account creation even
// starts.
const props = defineProps<{ banks: Bank[] }>();
const emit = defineEmits<{ chosen: [bankId: number]; cancel: [] }>();

const { push: toast } = useToast();
const { t } = useI18n();

const { defineField, handleSubmit, errors, isSubmitting } = useForm<BankChoiceForm>({
  validationSchema: toTypedSchema(bankChoiceSchema),
  initialValues: { bankId: "", bankName: "" },
});
const [bankId, bankIdAttrs] = defineField("bankId");
const [bankName, bankNameAttrs] = defineField("bankName");

// The two options are mutually exclusive — selecting one clears the
// other as the member interacts with the form, not only at submit.
watch(bankId, (value) => {
  if (value) bankName.value = "";
});
watch(bankName, (value) => {
  if (value) bankId.value = "";
});

const onSubmit = handleSubmit(async (values) => {
  if (values.bankId) {
    emit("chosen", Number(values.bankId));
    return;
  }

  const { data, error, response } = await apiClient.POST("/banks/choice", {
    body: { name: values.bankName },
  });
  if (!response.ok) {
    toast(errorMessage(error) ?? t("accounts.genericError"), "error");
    return;
  }
  toast(t("accounts.bankSaved"), "success");
  const created = data as unknown as { id: number };
  emit("chosen", created.id);
});

function errorMessage(error: unknown): string | undefined {
  if (error && typeof error === "object" && "message" in error) {
    const { message } = error as { message: string | string[] };
    return Array.isArray(message) ? message[0] : message;
  }
  return undefined;
}
</script>

<template>
  <form novalidate class="border rounded p-3 mb-4" @submit="onSubmit">
    <h2 class="h5">{{ $t("accounts.addAccount") }}</h2>

    <div class="mb-3">
      <label class="form-label" for="account-bank-id">{{ $t("accounts.existingBank") }}</label>
      <select
        id="account-bank-id"
        v-model="bankId"
        v-bind="bankIdAttrs"
        autofocus
        class="form-select"
        :class="{ 'is-invalid': errors.bankId }"
      >
        <option value="">{{ $t("accounts.chooseBank") }}</option>
        <option v-for="bank in props.banks" :key="bank.id" :value="bank.id">
          {{ bank.name }}
        </option>
      </select>
    </div>

    <div class="mb-3">
      <label class="form-label" for="account-bank-name">{{ $t("accounts.newBankName") }}</label>
      <input
        id="account-bank-name"
        v-model="bankName"
        v-bind="bankNameAttrs"
        type="text"
        class="form-control"
        :class="{ 'is-invalid': errors.bankName }"
      />
      <div v-if="errors.bankName" class="invalid-feedback">
        {{ $t("accounts.validation.bankChoiceRequired") }}
      </div>
    </div>

    <div class="d-flex gap-2">
      <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
        {{ $t("accounts.submit") }}
      </button>
      <button type="button" class="btn btn-outline-secondary" @click="emit('cancel')">
        {{ $t("common.cancel") }}
      </button>
    </div>
  </form>
</template>
