<script setup lang="ts">
import { ref } from 'vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { useRoute } from 'vue-router';
import { apiClient } from '../../api/client';
import { getCountryOptions, getDefaultCountry } from '../../composables/useCountryOptions';
import { DEFAULT_LOCALE, isSupportedLocale } from '../../i18n/locales';
import { registerSchema, type RegisterBody, type RegisterForm } from './auth.schemas';
import AuthLayout from '../../layouts/AuthLayout.vue';
import FormField from '../../components/FormField.vue';

const route = useRoute();

const countryOptions = getCountryOptions();

const { defineField, handleSubmit, errors, isSubmitting, resetForm } = useForm<
  RegisterForm,
  RegisterBody
>({
  validationSchema: toTypedSchema(registerSchema),
  initialValues: {
    email: '',
    country: getDefaultCountry(countryOptions),
  },
});
const [email, emailAttrs] = defineField('email');
const [country, countryAttrs] = defineField('country');

const genericError = ref(false);
// Set once the submit succeeds: the next step is in the inbox, and a member
// without a passkey yet has nothing to do on the sign-in page.
const submittedEmail = ref<string | null>(null);

const onSubmit = handleSubmit(async (values) => {
  genericError.value = false;

  // Whatever locale this page is currently showing under (`/en/register`,
  // `/fr/register`, …) — the member's own future emails and the switcher's
  // preselected value both start from this.
  const locale = isSupportedLocale(route.params.locale) ? route.params.locale : DEFAULT_LOCALE;
  // The browser's zone, so the member's "today" starts out matching their
  // wall clock; changeable afterwards from settings.
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
  const { response } = await apiClient.POST('/members/register', {
    body: { ...values, locale, timeZone },
  });

  if (!response.ok) {
    genericError.value = true;
    return;
  }

  submittedEmail.value = values.email;
  resetForm();
});

function useDifferentEmail() {
  submittedEmail.value = null;
}
</script>

<template>
  <AuthLayout>
    <template v-if="submittedEmail">
      <h1>{{ $t('auth.register.title') }}</h1>

      <p class="text-muted">{{ $t('auth.register.success', { email: submittedEmail }) }}</p>

      <button type="button" class="btn btn-outline-secondary w-100" @click="useDifferentEmail">
        {{ $t('auth.register.useDifferentEmail') }}
      </button>
    </template>

    <template v-else>
      <h1>{{ $t('auth.register.title') }}</h1>

      <div v-if="genericError" class="alert alert-danger" role="alert">
        {{ $t('auth.register.genericError') }}
      </div>

      <form novalidate @submit="onSubmit">
        <FormField
          :label="$t('auth.register.email')"
          for="register-email"
          :error="errors.email && $t('auth.validation.email')"
        >
          <input
            id="register-email"
            v-model="email"
            v-bind="emailAttrs"
            v-autofocus
            type="email"
            inputmode="email"
            autocomplete="email"
            class="form-control"
            :class="{ 'is-invalid': errors.email }"
          />
        </FormField>

        <FormField
          :label="$t('auth.register.country')"
          for="register-country"
          :error="errors.country && $t('auth.validation.country')"
        >
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
        </FormField>

        <p class="text-muted" style="font-size: 13.5px">{{ $t('auth.register.passkeyHint') }}</p>

        <button type="submit" class="btn btn-primary w-100" :disabled="isSubmitting">
          {{ $t('auth.register.submit') }}
        </button>
      </form>
    </template>

    <p class="text-center mt-4 mb-0" style="font-size: 14px; color: var(--paper-dim)">
      <router-link :to="{ name: 'sign-in' }" style="font-weight: 600">{{
        $t('auth.register.signInLink')
      }}</router-link>
    </p>
  </AuthLayout>
</template>
