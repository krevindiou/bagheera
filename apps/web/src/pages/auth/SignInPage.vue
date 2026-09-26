<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { runAuthentication } from '../../api/webauthn';
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
    const result = await runAuthentication('/webauthn/authentication');
    if (!result.ok) {
      // A cancelled platform prompt is not a server error — just abandon
      // the attempt.
      if (result.reason === 'rate-limited') banner.value = 'rate-limited';
      else if (result.reason === 'rejected') banner.value = 'invalid-credentials';
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
