<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { runRegistration } from '../../api/webauthn';
import { useSessionStore } from '../../stores/session.store';
import { takeUrlKey } from '../../composables/takeUrlKey';
import { useToast } from '../../composables/useToast';
import AuthLayout from '../../layouts/AuthLayout.vue';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const { push: toast } = useToast();
const { t } = useI18n();

// Not run on mount: navigator.credentials.create() needs a user gesture,
// and browsers silently block it otherwise (unit tests don't enforce this).
const key = ref<string | null>(null);
const submitting = ref(false);
type Banner = 'cancelled' | 'already-registered' | 'prompt-failed' | 'rate-limited' | null;
const banner = ref<Banner>(null);
// Without it every attempt reports 'cancelled', so a retry would never help.
const passkeysSupported = browserSupportsWebAuthn();

onMounted(() => {
  // Signing in remounts this page inside the app shell (BaseLayout) while
  // the route is still /activate and the key already gone; the instance
  // that signed in handles the redirect.
  if (session.isAuthenticated) return;
  // Held in memory only: the link's token leaves the address bar at once
  // (history, copied URLs and error reports would otherwise keep it while
  // the page waits for the click).
  key.value = takeUrlKey(route, router);
  if (!key.value) {
    fail();
  }
});

function fail() {
  // No passkey exists yet to sign in with, so sign-in would be a dead end;
  // register sends a fresh link instead.
  toast(t('auth.activate.error'), 'error');
  void router.replace({ name: 'register' });
}

async function createAccount() {
  if (!key.value) return;
  banner.value = null;
  submitting.value = true;
  try {
    const result = await runRegistration('/webauthn/signup', {
      optionsBody: { key: key.value },
    });
    if (!result.ok) {
      // Only a rejected key is final; the emailed link stays valid until its
      // TTL, so the member retries from here rather than from the email.
      if (result.reason === 'rejected') fail();
      else banner.value = result.reason;
      return;
    }

    await session.fetchMember();
    toast(t('auth.activate.success'), 'success');
    void router.replace({ name: 'home' });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <h1>{{ $t('auth.activate.title') }}</h1>

    <div v-if="key && !passkeysSupported" class="alert alert-warning mt-3" role="alert">
      {{ $t('auth.signIn.passkeysUnsupported') }}
    </div>
    <template v-else-if="key">
      <p class="text-muted">{{ $t('auth.activate.intro') }}</p>
      <div v-if="banner === 'cancelled'" class="alert alert-warning" role="alert">
        {{ $t('auth.activate.cancelled') }}
      </div>
      <div v-else-if="banner === 'already-registered'" class="alert alert-warning" role="alert">
        {{ $t('auth.activate.alreadyRegistered') }}
      </div>
      <div v-else-if="banner === 'prompt-failed'" class="alert alert-warning" role="alert">
        {{ $t('auth.activate.promptFailed') }}
      </div>
      <div v-else-if="banner === 'rate-limited'" class="alert alert-warning" role="alert">
        {{ $t('auth.signIn.tooManyAttempts') }}
      </div>
      <button
        type="button"
        class="btn btn-primary w-100"
        :disabled="submitting"
        @click="createAccount"
      >
        {{ $t('auth.activate.submit') }}
      </button>
    </template>
  </AuthLayout>
</template>
