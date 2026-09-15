<script setup lang="ts">
import { onMounted } from 'vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { apiClient } from '../../api/client';
import { passwordValidationKey } from '../../composables/usePasswordStrength';
import { useToast } from '../../composables/useToast';
import PasswordStrengthMeter from '../../components/PasswordStrengthMeter.vue';
import PasswordInput from '../../components/PasswordInput.vue';
import { resetPasswordSchema, type ResetPasswordForm } from './auth.schemas';
import ToastContainer from '../../components/ToastContainer.vue';
import AuthLayout from '../../layouts/AuthLayout.vue';

const route = useRoute();
const router = useRouter();
const { push: toast } = useToast();
const { t } = useI18n();

const { defineField, handleSubmit, errors, isSubmitting } = useForm<ResetPasswordForm>({
  validationSchema: toTypedSchema(resetPasswordSchema),
  initialValues: { password: '', passwordConfirmation: '' },
});
const [password, passwordAttrs] = defineField('password');
const [passwordConfirmation, passwordConfirmationAttrs] = defineField('passwordConfirmation');

// A rejected key (missing, invalid, expired, already used) is a silent
// return to sign-in — no visible error, so the visitor never learns
// which case applies. Read in onMounted, not at top-level setup — this
// page is always reached via a hard navigation (an emailed link), and
// reading route.query synchronously at setup can race Vue Router's
// initial-navigation resolution, misreading a perfectly valid key as
// absent (mirrors ActivatePage.vue, which has the same hard-navigation
// entry point and already reads its key inside onMounted).
let key: string | null = null;

onMounted(() => {
  const raw = route.query.key;
  if (typeof raw !== 'string' || raw.length === 0) {
    router.replace({ name: 'sign-in' });
    return;
  }
  key = raw;
});

const onSubmit = handleSubmit(async (values) => {
  if (!key) return;

  const { response } = await apiClient.POST('/auth/password-recovery/reset', {
    body: { key, ...values },
  });

  if (!response.ok) {
    router.replace({ name: 'sign-in' });
    return;
  }

  toast(t('auth.resetPassword.success'), 'success');
  router.push({ name: 'sign-in' });
});
</script>

<template>
  <AuthLayout>
    <h1>{{ $t('auth.resetPassword.title') }}</h1>
    <ToastContainer />

    <form novalidate @submit="onSubmit">
      <div class="mb-3">
        <label class="form-label" for="reset-password-password">{{
          $t('auth.resetPassword.password')
        }}</label>
        <PasswordInput
          id="reset-password-password"
          v-model="password"
          autofocus
          v-bind="passwordAttrs"
          :class="{ 'is-invalid': errors.password }"
        />
        <PasswordStrengthMeter :password="password ?? ''" />
        <div v-if="errors.password" class="invalid-feedback d-block">
          {{ $t(passwordValidationKey(password ?? '')) }}
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="reset-password-password-confirmation">
          {{ $t('auth.resetPassword.passwordConfirmation') }}
        </label>
        <PasswordInput
          id="reset-password-password-confirmation"
          v-model="passwordConfirmation"
          v-bind="passwordConfirmationAttrs"
          :class="{ 'is-invalid': errors.passwordConfirmation }"
        />
        <div v-if="errors.passwordConfirmation" class="invalid-feedback d-block">
          {{ $t('auth.validation.passwordMismatch') }}
        </div>
      </div>

      <button type="submit" class="btn btn-primary w-100" :disabled="isSubmitting">
        {{ $t('auth.resetPassword.submit') }}
      </button>
    </form>

    <p class="text-center mt-4 mb-0" style="font-size: 14px; color: var(--paper-dim)">
      <router-link :to="{ name: 'sign-in' }" style="font-weight: 600">{{
        $t('auth.resetPassword.signInLink')
      }}</router-link>
    </p>
  </AuthLayout>
</template>
