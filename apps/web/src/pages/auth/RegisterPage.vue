<script setup lang="ts">
import { ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { apiClient } from "../../api/client";
import { rememberAttemptedEmail } from "../../composables/useLastAttemptedEmail";
import { getCountryOptions, getDefaultCountry } from "../../composables/useCountryOptions";
import PasswordStrengthMeter from "../../components/PasswordStrengthMeter.vue";
import PasswordInput from "../../components/PasswordInput.vue";
import { registerSchema, type RegisterForm } from "./auth.schemas";

const countryOptions = getCountryOptions();

const { defineField, handleSubmit, errors, isSubmitting, resetForm } = useForm<RegisterForm>({
  validationSchema: toTypedSchema(registerSchema),
  initialValues: {
    email: "",
    country: getDefaultCountry(countryOptions),
    password: "",
    passwordConfirmation: "",
  },
});
const [email, emailAttrs] = defineField("email");
const [country, countryAttrs] = defineField("country");
const [password, passwordAttrs] = defineField("password");
const [passwordConfirmation, passwordConfirmationAttrs] = defineField("passwordConfirmation");

const submitted = ref(false);
const emailTaken = ref(false);

const onSubmit = handleSubmit(async (values) => {
  emailTaken.value = false;
  rememberAttemptedEmail(values.email);

  const { response } = await apiClient.POST("/members/register", {
    body: { ...values, country: values.country.toUpperCase() },
  });

  if (!response.ok) {
    emailTaken.value = true;
    return;
  }

  submitted.value = true;
  resetForm();
});
</script>

<template>
  <div class="container py-5" style="max-width: 480px">
    <h1>{{ $t("auth.register.title") }}</h1>

    <div v-if="submitted" class="alert alert-success" role="alert">
      {{ $t("auth.register.success") }}
    </div>

    <div v-if="emailTaken" class="alert alert-danger" role="alert">
      {{ $t("auth.register.emailTaken") }}
    </div>

    <form v-if="!submitted" novalidate @submit="onSubmit">
      <div class="mb-3">
        <label class="form-label" for="register-email">{{ $t("auth.register.email") }}</label>
        <input
          id="register-email"
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

      <div class="mb-3">
        <label class="form-label" for="register-country">{{ $t("auth.register.country") }}</label>
        <select
          id="register-country"
          v-model="country"
          v-bind="countryAttrs"
          class="form-select"
          :class="{ 'is-invalid': errors.country }"
        >
          <option v-for="option in countryOptions" :key="option.code" :value="option.code">
            {{ option.name }}
          </option>
        </select>
        <div v-if="errors.country" class="invalid-feedback">
          {{ $t("auth.validation.country") }}
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="register-password">{{ $t("auth.register.password") }}</label>
        <PasswordInput
          id="register-password"
          v-model="password"
          v-bind="passwordAttrs"
          :class="{ 'is-invalid': errors.password }"
        />
        <PasswordStrengthMeter :password="password ?? ''" />
        <div v-if="errors.password" class="invalid-feedback">
          {{ $t("auth.validation.passwordLength") }}
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="register-password-confirmation">
          {{ $t("auth.register.passwordConfirmation") }}
        </label>
        <PasswordInput
          id="register-password-confirmation"
          v-model="passwordConfirmation"
          v-bind="passwordConfirmationAttrs"
          :class="{ 'is-invalid': errors.passwordConfirmation }"
        />
        <div v-if="errors.passwordConfirmation" class="invalid-feedback">
          {{ $t("auth.validation.passwordMismatch") }}
        </div>
      </div>

      <button type="submit" class="btn btn-primary w-100" :disabled="isSubmitting">
        {{ $t("auth.register.submit") }}
      </button>
    </form>

    <div class="mt-3">
      <router-link :to="{ name: 'sign-in' }">{{ $t("auth.register.signInLink") }}</router-link>
    </div>
  </div>
</template>
