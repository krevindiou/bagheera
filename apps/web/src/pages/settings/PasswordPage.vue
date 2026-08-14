<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useI18n } from "vue-i18n";
import { apiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import { changePasswordSchema, type ChangePasswordForm } from "./settings.schemas";

const { push: toast } = useToast();
const { t } = useI18n();

const { defineField, handleSubmit, errors, isSubmitting, resetForm } = useForm<ChangePasswordForm>({
  validationSchema: toTypedSchema(changePasswordSchema),
  initialValues: { currentPassword: "", newPassword: "", newPasswordConfirmation: "" },
});
const [currentPassword, currentPasswordAttrs] = defineField("currentPassword");
const [newPassword, newPasswordAttrs] = defineField("newPassword");
const [newPasswordConfirmation, newPasswordConfirmationAttrs] =
  defineField("newPasswordConfirmation");

const onSubmit = handleSubmit(async (values) => {
  const { error, response } = await apiClient.POST("/auth/change-password", { body: values });

  if (!response.ok) {
    const message = errorMessage(error) ?? t("settings.password.genericError");
    toast(message, "error");
    return;
  }

  resetForm();
  toast(t("settings.password.success"), "success");
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
  <div class="container py-5" style="max-width: 480px">
    <h1>{{ $t("settings.password.title") }}</h1>

    <form novalidate @submit="onSubmit">
      <div class="mb-3">
        <label class="form-label" for="password-current">{{
          $t("settings.password.currentPassword")
        }}</label>
        <input
          id="password-current"
          v-model="currentPassword"
          v-bind="currentPasswordAttrs"
          type="password"
          class="form-control"
          :class="{ 'is-invalid': errors.currentPassword }"
        />
        <div v-if="errors.currentPassword" class="invalid-feedback">
          {{ $t("auth.validation.required") }}
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="password-new">{{
          $t("settings.password.newPassword")
        }}</label>
        <input
          id="password-new"
          v-model="newPassword"
          v-bind="newPasswordAttrs"
          type="password"
          class="form-control"
          :class="{ 'is-invalid': errors.newPassword }"
        />
        <div v-if="errors.newPassword" class="invalid-feedback">
          {{ $t("auth.validation.passwordLength") }}
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="password-new-confirmation">
          {{ $t("settings.password.newPasswordConfirmation") }}
        </label>
        <input
          id="password-new-confirmation"
          v-model="newPasswordConfirmation"
          v-bind="newPasswordConfirmationAttrs"
          type="password"
          class="form-control"
          :class="{ 'is-invalid': errors.newPasswordConfirmation }"
        />
        <div v-if="errors.newPasswordConfirmation" class="invalid-feedback">
          {{ $t("auth.validation.passwordMismatch") }}
        </div>
      </div>

      <button type="submit" class="btn btn-primary w-100" :disabled="isSubmitting">
        {{ $t("settings.password.submit") }}
      </button>
    </form>
  </div>
</template>
