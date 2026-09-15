<script setup lang="ts">
import { ref } from 'vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { useI18n } from 'vue-i18n';
import { apiClient } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import { passwordValidationKey } from '../../composables/usePasswordStrength';
import { useToast } from '../../composables/useToast';
import PasswordStrengthMeter from '../../components/PasswordStrengthMeter.vue';
import PasswordInput from '../../components/PasswordInput.vue';
import { changePasswordSchema, type ChangePasswordForm } from './settings.schemas';
import ToastContainer from '../../components/ToastContainer.vue';
import SettingsTabs from './SettingsTabs.vue';

const { push: toast } = useToast();
const { t } = useI18n();

const { defineField, handleSubmit, errors, isSubmitting, resetForm, setFieldError } =
  useForm<ChangePasswordForm>({
    validationSchema: toTypedSchema(changePasswordSchema),
    initialValues: {
      currentPassword: '',
      newPassword: '',
      newPasswordConfirmation: '',
    },
  });
const [currentPassword, currentPasswordAttrs] = defineField('currentPassword');
const [newPassword, newPasswordAttrs] = defineField('newPassword');
const [newPasswordConfirmation, newPasswordConfirmationAttrs] =
  defineField('newPasswordConfirmation');

// Distinguishes "the server rejected this specific credential" (show its
// own translated message below) from vee-validate's own required-field
// check on the same field (show the generic required message instead) —
// a status code rather than matching the server's English text, which
// used to break the moment that text was anything but exactly this
// server's default English wording (see the 422 status this branches on,
// apps/api/src/auth/change-password.service.ts).
const currentPasswordServerError = ref(false);

const onSubmit = handleSubmit(async (values) => {
  currentPasswordServerError.value = false;
  const { error, response } = await apiClient.POST('/auth/change-password', {
    body: values,
  });

  if (!response.ok) {
    if (response.status === 422) {
      currentPasswordServerError.value = true;
      setFieldError('currentPassword', t('auth.validation.currentPasswordInvalid'));
      return;
    }
    const message = errorMessage(error) ?? t('settings.password.genericError');
    toast(message, 'error');
    return;
  }

  resetForm();
  toast(t('settings.password.success'), 'success');
});
</script>

<template>
  <div>
    <SettingsTabs />
    <ToastContainer />

    <form novalidate style="max-width: 380px" @submit="onSubmit">
      <div class="mb-3">
        <label class="form-label" for="password-current">{{
          $t('settings.password.currentPassword')
        }}</label>
        <PasswordInput
          id="password-current"
          v-model="currentPassword"
          autofocus
          v-bind="currentPasswordAttrs"
          :class="{ 'is-invalid': errors.currentPassword }"
        />
        <div v-if="errors.currentPassword" class="invalid-feedback d-block">
          {{ currentPasswordServerError ? errors.currentPassword : $t('auth.validation.required') }}
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="password-new">{{
          $t('settings.password.newPassword')
        }}</label>
        <PasswordInput
          id="password-new"
          v-model="newPassword"
          v-bind="newPasswordAttrs"
          :class="{ 'is-invalid': errors.newPassword }"
        />
        <PasswordStrengthMeter :password="newPassword ?? ''" />
        <div v-if="errors.newPassword" class="invalid-feedback d-block">
          {{ $t(passwordValidationKey(newPassword ?? '')) }}
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="password-new-confirmation">
          {{ $t('settings.password.newPasswordConfirmation') }}
        </label>
        <PasswordInput
          id="password-new-confirmation"
          v-model="newPasswordConfirmation"
          v-bind="newPasswordConfirmationAttrs"
          :class="{ 'is-invalid': errors.newPasswordConfirmation }"
        />
        <div v-if="errors.newPasswordConfirmation" class="invalid-feedback d-block">
          {{ $t('auth.validation.passwordMismatch') }}
        </div>
      </div>

      <button type="submit" class="btn btn-primary w-100" :disabled="isSubmitting">
        {{ $t('settings.password.submit') }}
      </button>
    </form>
  </div>
</template>
