<script setup lang="ts">
import { ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useRoute, useRouter } from "vue-router";
import { apiClient } from "../../api/client";
import PasswordStrengthMeter from "../../components/PasswordStrengthMeter.vue";
import PasswordInput from "../../components/PasswordInput.vue";
import { resetPasswordSchema, type ResetPasswordForm } from "./auth.schemas";

const route = useRoute();
const router = useRouter();

const { defineField, handleSubmit, errors, isSubmitting } = useForm<ResetPasswordForm>({
  validationSchema: toTypedSchema(resetPasswordSchema),
  initialValues: { password: "", passwordConfirmation: "" },
});
const [password, passwordAttrs] = defineField("password");
const [passwordConfirmation, passwordConfirmationAttrs] = defineField("passwordConfirmation");

const submitted = ref(false);

// Spec 4.4: a rejected key (missing, invalid, expired, already used) is a
// silent return to sign-in — no visible error, so the visitor never learns
// which case applies.
const key = route.query.key;
if (typeof key !== "string" || key.length === 0) {
  router.replace({ name: "sign-in" });
}

const onSubmit = handleSubmit(async (values) => {
  if (typeof key !== "string" || key.length === 0) return;

  const { response } = await apiClient.POST("/auth/password-recovery/reset", {
    body: { key, ...values },
  });

  if (!response.ok) {
    router.replace({ name: "sign-in" });
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

    <form v-if="!submitted" novalidate @submit="onSubmit">
      <div class="mb-3">
        <label class="form-label" for="reset-password-password">{{
          $t("auth.resetPassword.password")
        }}</label>
        <PasswordInput
          id="reset-password-password"
          v-model="password"
          autofocus
          v-bind="passwordAttrs"
          :class="{ 'is-invalid': errors.password }"
        />
        <PasswordStrengthMeter :password="password ?? ''" />
        <div v-if="errors.password" class="invalid-feedback">
          {{ $t("auth.validation.passwordLength") }}
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="reset-password-password-confirmation">
          {{ $t("auth.resetPassword.passwordConfirmation") }}
        </label>
        <PasswordInput
          id="reset-password-password-confirmation"
          v-model="passwordConfirmation"
          v-bind="passwordConfirmationAttrs"
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
