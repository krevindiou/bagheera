<script setup lang="ts">
import { ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { apiClient } from "../../api/client";
import { rememberAttemptedEmail } from "../../composables/useLastAttemptedEmail";
import { forgotPasswordSchema, type ForgotPasswordForm } from "./auth.schemas";

const { defineField, handleSubmit, errors, isSubmitting } = useForm<ForgotPasswordForm>({
  validationSchema: toTypedSchema(forgotPasswordSchema),
  initialValues: { email: "" },
});
const [email, emailAttrs] = defineField("email");

const submitted = ref(false);

const onSubmit = handleSubmit(async (values) => {
  rememberAttemptedEmail(values.email);
  // The API always returns the identical message whether or not the
  // address matched — nothing to branch on here.
  await apiClient.POST("/auth/password-recovery", { body: values });
  submitted.value = true;
});
</script>

<template>
  <div class="container py-5" style="max-width: 480px">
    <h1>{{ $t("auth.forgotPassword.title") }}</h1>

    <div v-if="submitted" class="alert alert-info" role="alert">
      {{ $t("auth.forgotPassword.requestSent") }}
    </div>

    <form v-else novalidate @submit="onSubmit">
      <div class="mb-3">
        <label class="form-label" for="forgot-password-email">{{
          $t("auth.forgotPassword.email")
        }}</label>
        <input
          id="forgot-password-email"
          v-model="email"
          v-bind="emailAttrs"
          type="email"
          inputmode="email"
          autocomplete="email"
          class="form-control"
          :class="{ 'is-invalid': errors.email }"
        />
        <div v-if="errors.email" class="invalid-feedback">
          {{ $t("auth.validation.email") }}
        </div>
      </div>

      <button type="submit" class="btn btn-primary w-100" :disabled="isSubmitting">
        {{ $t("auth.forgotPassword.submit") }}
      </button>
    </form>

    <div class="mt-3">
      <router-link :to="{ name: 'sign-in' }">{{
        $t("auth.forgotPassword.signInLink")
      }}</router-link>
    </div>
  </div>
</template>
