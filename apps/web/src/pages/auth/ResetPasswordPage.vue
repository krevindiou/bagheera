<script setup lang="ts">
import { ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useRoute } from "vue-router";
import { apiClient } from "../../api/client";
import { resetPasswordSchema, type ResetPasswordForm } from "./auth.schemas";

const route = useRoute();

const { defineField, handleSubmit, errors, isSubmitting } = useForm<ResetPasswordForm>({
  validationSchema: toTypedSchema(resetPasswordSchema),
  initialValues: { password: "", passwordConfirmation: "" },
});
const [password, passwordAttrs] = defineField("password");
const [passwordConfirmation, passwordConfirmationAttrs] = defineField("passwordConfirmation");

const submitted = ref(false);
const invalidKey = ref(false);

const onSubmit = handleSubmit(async (values) => {
  invalidKey.value = false;
  const key = route.query.key;
  if (typeof key !== "string" || key.length === 0) {
    invalidKey.value = true;
    return;
  }

  const { response } = await apiClient.POST("/auth/password-recovery/reset", {
    body: { key, ...values },
  });

  if (!response.ok) {
    invalidKey.value = true;
    return;
  }

  submitted.value = true;
});
</script>

<template>
  <div class="container py-5" style="max-width: 480px">
    <h1>{{ $t("auth.resetPassword.title") }}</h1>

    <div v-if="submitted" class="alert alert-success" role="alert">
      {{ $t("auth.resetPassword.success") }}
    </div>

    <div v-if="invalidKey" class="alert alert-danger" role="alert">
      {{ $t("auth.resetPassword.invalidKey") }}
    </div>

    <form v-if="!submitted" novalidate @submit="onSubmit">
      <div class="mb-3">
        <label class="form-label" for="reset-password-password">{{ $t("auth.resetPassword.password") }}</label>
        <input
          id="reset-password-password"
          v-model="password"
          v-bind="passwordAttrs"
          type="password"
          class="form-control"
          :class="{ 'is-invalid': errors.password }"
        />
        <div v-if="errors.password" class="invalid-feedback">{{ $t("auth.validation.passwordLength") }}</div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="reset-password-password-confirmation">
          {{ $t("auth.resetPassword.passwordConfirmation") }}
        </label>
        <input
          id="reset-password-password-confirmation"
          v-model="passwordConfirmation"
          v-bind="passwordConfirmationAttrs"
          type="password"
          class="form-control"
          :class="{ 'is-invalid': errors.passwordConfirmation }"
        />
        <div v-if="errors.passwordConfirmation" class="invalid-feedback">
          {{ $t("auth.validation.passwordMismatch") }}
        </div>
      </div>

      <button type="submit" class="btn btn-primary w-100" :disabled="isSubmitting">
        {{ $t("auth.resetPassword.submit") }}
      </button>
    </form>

    <div class="mt-3">
      <router-link :to="{ name: 'sign-in' }">{{ $t("auth.resetPassword.signInLink") }}</router-link>
    </div>
  </div>
</template>
