<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { useI18n } from 'vue-i18n';
import { startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { apiClient } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import { useSessionStore } from '../../stores/session.store';
import { useToast } from '../../composables/useToast';
import { profileSchema, type ProfileForm } from './settings.schemas';
import ToastContainer from '../../components/ToastContainer.vue';
import SettingsTabs from './SettingsTabs.vue';

const session = useSessionStore();
const { push: toast } = useToast();
const { t } = useI18n();

const { defineField, handleSubmit, errors, isSubmitting } = useForm<ProfileForm>({
  validationSchema: toTypedSchema(profileSchema),
  initialValues: { email: session.member?.email ?? '' },
});
const [email, emailAttrs] = defineField('email');

/**
 * Runs the step-up ceremony (the passkey-era analog of "enter your current
 * password" — see WebauthnStepUpService) right before the mutating call,
 * same two-hop shape SignInPage.vue's own passkey sign-in already uses.
 * Returns false (and lets the caller show its own generic error) on any
 * failure — cancelled prompt, unverified assertion, network error.
 */
async function completeStepUp(): Promise<boolean> {
  const { data, response } = await apiClient.POST('/webauthn/step-up/options');
  if (!response.ok || !data) return false;

  let assertion;
  try {
    assertion = await startAuthentication({
      optionsJSON: data as unknown as PublicKeyCredentialRequestOptionsJSON,
    });
  } catch {
    return false;
  }

  // See PasskeysPage.vue's comment: the generated client can't type this
  // body beyond an opaque object, since Swagger has no visibility into
  // @simplewebauthn/server's WebAuthn-spec types.
  const { response: verifyResponse } = await apiClient.POST('/webauthn/step-up/verify', {
    body: { response: assertion as unknown as Record<string, never> },
  });
  return verifyResponse.ok;
}

const onSubmit = handleSubmit(async (values) => {
  const stepUpOk = await completeStepUp();
  if (!stepUpOk) {
    toast(t('settings.profile.stepUpFailed'), 'error');
    return;
  }

  const { error, response } = await apiClient.POST('/members/profile', {
    body: values,
  });

  if (!response.ok) {
    const message = errorMessage(error) ?? t('settings.profile.genericError');
    toast(message, 'error');
    return;
  }

  // The address on file doesn't change yet — only once the confirmation
  // link just emailed to it is clicked — so the session's email stays as
  // it was.
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

      <p class="text-muted" style="font-size: 13.5px">{{ $t('settings.profile.stepUpHint') }}</p>

      <button type="submit" class="btn btn-primary w-100" :disabled="isSubmitting">
        {{ $t('settings.profile.submit') }}
      </button>
    </form>
  </div>
</template>
