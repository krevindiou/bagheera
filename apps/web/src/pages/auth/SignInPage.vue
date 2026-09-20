<script setup lang="ts">
import { ref } from 'vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { apiClient } from '../../api/client';
import { useSessionStore } from '../../stores/session.store';
import { useToast } from '../../composables/useToast';
import {
  readLastAttemptedEmail,
  rememberAttemptedEmail,
} from '../../composables/useLastAttemptedEmail';
import { signInSchema, type SignInForm } from './auth.schemas';
import ToastContainer from '../../components/ToastContainer.vue';
import AuthLayout from '../../layouts/AuthLayout.vue';

const router = useRouter();
const session = useSessionStore();
const { push: toast } = useToast();
const { t } = useI18n();

const { defineField, handleSubmit, errors, isSubmitting } = useForm<SignInForm>({
  validationSchema: toTypedSchema(signInSchema),
  initialValues: { email: readLastAttemptedEmail() },
});
const [email, emailAttrs] = defineField('email');

type Banner = 'invalid-credentials' | 'rate-limited' | null;
const banner = ref<Banner>(null);
const passkeysSupported = browserSupportsWebAuthn();

const onSubmit = handleSubmit(async (values) => {
  banner.value = null;
  rememberAttemptedEmail(values.email);

  const { data, response } = await apiClient.POST('/webauthn/authentication/options', {
    body: { email: values.email },
  });
  if (response.status === 429) {
    banner.value = 'rate-limited';
    return;
  }
  if (!response.ok || !data) {
    banner.value = 'invalid-credentials';
    return;
  }

  let assertion;
  try {
    assertion = await startAuthentication({
      optionsJSON: data as unknown as PublicKeyCredentialRequestOptionsJSON,
    });
  } catch {
    // The platform prompt was cancelled/dismissed — not a server error,
    // just abandon the attempt.
    return;
  }

  // See PasskeysPage.vue's comment: the generated client can't type this
  // body beyond an opaque object, since Swagger has no visibility into
  // @simplewebauthn/server's WebAuthn-spec types.
  const { response: verifyResponse } = await apiClient.POST('/webauthn/authentication/verify', {
    body: { response: assertion as unknown as Record<string, never> },
  });
  if (!verifyResponse.ok) {
    banner.value = 'invalid-credentials';
    return;
  }

  await session.fetchMember();
  toast(t('auth.signIn.success'), 'success');
  router.push({ name: 'home' });
});
</script>

<template>
  <AuthLayout>
    <h1>{{ $t('auth.signIn.title') }}</h1>
    <ToastContainer />

    <div v-if="banner === 'invalid-credentials'" class="alert alert-danger mt-3" role="alert">
      {{ $t('auth.signIn.invalidCredentials') }}
    </div>
    <div v-else-if="banner === 'rate-limited'" class="alert alert-warning mt-3" role="alert">
      {{ $t('auth.signIn.tooManyAttempts') }}
    </div>
    <div v-if="!passkeysSupported" class="alert alert-warning mt-3" role="alert">
      {{ $t('auth.signIn.passkeysUnsupported') }}
    </div>

    <form v-else novalidate class="mt-4" @submit="onSubmit">
      <div class="mb-3">
        <label class="form-label" for="sign-in-email">{{ $t('auth.signIn.email') }}</label>
        <input
          id="sign-in-email"
          v-model="email"
          v-bind="emailAttrs"
          type="email"
          inputmode="email"
          autocomplete="username webauthn"
          autofocus
          class="form-control"
          :class="{ 'is-invalid': errors.email }"
        />
        <div v-if="errors.email" class="invalid-feedback">
          {{ $t('auth.validation.required') }}
        </div>
      </div>

      <button type="submit" class="btn btn-primary w-100" :disabled="isSubmitting">
        {{ $t('auth.signIn.passkeySubmit') }}
      </button>
    </form>

    <p class="text-center mt-4 mb-0" style="font-size: 14px; color: var(--paper-dim)">
      <router-link :to="{ name: 'register' }" style="font-weight: 600">{{
        $t('auth.signIn.registerLink')
      }}</router-link>
    </p>
  </AuthLayout>
</template>
