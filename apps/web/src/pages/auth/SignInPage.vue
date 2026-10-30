<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { runAuthentication } from '../../api/webauthn';
import type { CeremonyFailure } from '../../api/webauthn';
import { useSessionStore } from '../../stores/session.store';
import { useToast } from '../../composables/useToast';
import { safeRedirect } from '../../router/safeRedirect';
import AuthLayout from '../../layouts/AuthLayout.vue';
import AppIcon from '../../components/AppIcon.vue';

const router = useRouter();
const route = useRoute();
const session = useSessionStore();
const { push: toast } = useToast();
const { t } = useI18n();

type Banner = 'invalid-credentials' | 'rate-limited' | null;
const banner = ref<Banner>(null);
// A cancelled prompt isn't an error. A Record, so a new failure reason
// can't be left unhandled.
const failureBanner: Record<CeremonyFailure, Banner> = {
  cancelled: null,
  'prompt-failed': 'invalid-credentials',
  'rate-limited': 'rate-limited',
  rejected: 'invalid-credentials',
};
const submitting = ref(false);
const passkeysSupported = browserSupportsWebAuthn();

// Usernameless: the browser offers the member's passkeys for this site, and
// the API recognizes the account from the one picked.
async function onSubmit() {
  banner.value = null;
  submitting.value = true;
  try {
    const result = await runAuthentication('/webauthn/authentication');
    if (!result.ok) {
      banner.value = failureBanner[result.reason];
      return;
    }

    await session.fetchMember();
    toast(t('auth.signIn.success'), 'success');
    void router.push(safeRedirect(router, route.query.redirect) ?? { name: 'home' });
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
      <button
        type="submit"
        class="btn btn-primary w-100 d-inline-flex align-items-center justify-content-center gap-2"
        :disabled="submitting"
      >
        <AppIcon name="key" :size="18" />
        {{ $t('auth.signIn.passkeySubmit') }}
      </button>
    </form>

    <p class="auth-footer" data-testid="register-prompt">
      {{ $t('auth.signIn.newHere') }}
      <router-link :to="{ name: 'register' }">{{ $t('auth.signIn.registerLink') }}</router-link>
    </p>
  </AuthLayout>
</template>
