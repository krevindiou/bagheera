<script setup lang="ts">
import { ref } from 'vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { useI18n } from 'vue-i18n';
import { apiClient } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import { useSessionStore } from '../../stores/session.store';
import { useToast } from '../../composables/useToast';
import PasswordInput from '../../components/PasswordInput.vue';
import { profileSchema, type ProfileForm } from './settings.schemas';
import ToastContainer from '../../components/ToastContainer.vue';
import SettingsTabs from './SettingsTabs.vue';

const session = useSessionStore();
const { push: toast } = useToast();
const { t } = useI18n();

const { defineField, handleSubmit, errors, isSubmitting, resetField, setFieldError } =
  useForm<ProfileForm>({
    validationSchema: toTypedSchema(profileSchema),
    initialValues: { email: session.member?.email ?? '', currentPassword: '' },
  });
const [email, emailAttrs] = defineField('email');
const [currentPassword, currentPasswordAttrs] = defineField('currentPassword');

// Distinguishes "the server rejected this specific credential" (show its
// own translated message below) from vee-validate's own required-field
// check on the same field (show the generic required message instead) —
// a status code rather than matching the server's English text, which
// used to break the moment that text was anything but exactly this
// server's default English wording (see the 422 status this branches on,
// apps/api/src/members/profile.service.ts).
const currentPasswordServerError = ref(false);

const onSubmit = handleSubmit(async (values) => {
  currentPasswordServerError.value = false;
  const { error, response } = await apiClient.POST('/members/profile', {
    body: values,
  });

  if (!response.ok) {
    if (response.status === 422) {
      currentPasswordServerError.value = true;
      setFieldError('currentPassword', t('auth.validation.currentPasswordInvalid'));
      return;
    }
    const message = errorMessage(error) ?? t('settings.profile.genericError');
    toast(message, 'error');
    return;
  }

  // The address on file doesn't change yet — only once the confirmation
  // link just emailed to it is clicked — so the session's email stays as
  // it was.
  resetField('currentPassword');
  toast(t('settings.profile.success'), 'success');
});
</script>

<template>
  <div>
    <SettingsTabs />
    <ToastContainer />

    <form novalidate style="max-width: 380px" @submit="onSubmit">
      <div class="mb-3">
        <label class="form-label" for="profile-email">{{ $t('settings.profile.email') }}</label>
        <input
          id="profile-email"
          v-model="email"
          v-bind="emailAttrs"
          type="email"
          inputmode="email"
          autocomplete="email"
          autofocus
          class="form-control"
          :class="{ 'is-invalid': errors.email }"
        />
        <div v-if="errors.email" class="invalid-feedback">
          {{ $t('auth.validation.email') }}
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="profile-current-password">
          {{ $t('settings.profile.currentPassword') }}
        </label>
        <PasswordInput
          id="profile-current-password"
          v-model="currentPassword"
          v-bind="currentPasswordAttrs"
          :class="{ 'is-invalid': errors.currentPassword }"
        />
        <div v-if="errors.currentPassword" class="invalid-feedback d-block">
          {{ currentPasswordServerError ? errors.currentPassword : $t('auth.validation.required') }}
        </div>
      </div>

      <button type="submit" class="btn btn-primary w-100" :disabled="isSubmitting">
        {{ $t('settings.profile.submit') }}
      </button>
    </form>
  </div>
</template>
