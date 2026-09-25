<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { apiClient } from '../../api/client';
import { useSessionStore } from '../../stores/session.store';
import { useToast } from '../../composables/useToast';
import AuthLayout from '../../layouts/AuthLayout.vue';

const router = useRouter();
const session = useSessionStore();
const { push: toast } = useToast();
const { t } = useI18n();

type Banner = 'invalid-credentials' | 'rate-limited' | null;
const banner = ref<Banner>(null);
const submitting = ref(false);
const passkeysSupported = browserSupportsWebAuthn();

// Usernameless: no email is asked for — the browser offers the member's own
// passkeys for this site, and the API recognizes the account from whichever
// one they pick (see the API's WebauthnAuthenticationService for why an
// email-first flow was dropped).
async function onSubmit() {
  banner.value = null;
  submitting.value = true;
  try {
    const { data, response } = await apiClient.POST('/webauthn/authentication/options');
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
    void router.push({ name: 'home' });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <h1>{{ $t('auth.signIn.title') }}</h1>

    <div v-if="banner === 'invalid-credentials'" class="alert alert-danger mt-3" role="alert">
      {{ $t('auth.signIn.invalidCredentials') }}
    </div>
    <div v-else-if="banner === 'rate-limited'" class="alert alert-warning mt-3" role="alert">
      {{ $t('auth.signIn.tooManyAttempts') }}
    </div>
    <div v-if="!passkeysSupported" class="alert alert-warning mt-3" role="alert">
      {{ $t('auth.signIn.passkeysUnsupported') }}
    </div>

    <form v-else novalidate class="mt-4" @submit.prevent="onSubmit">
      <p class="text-muted" style="font-size: 13.5px">{{ $t('auth.signIn.passkeyHint') }}</p>
      <button type="submit" class="btn btn-primary w-100" :disabled="submitting">
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
