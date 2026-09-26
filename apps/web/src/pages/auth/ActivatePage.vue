<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { runRegistration } from '../../api/webauthn';
import { useSessionStore } from '../../stores/session.store';
import { useToast } from '../../composables/useToast';
import AuthLayout from '../../layouts/AuthLayout.vue';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const { push: toast } = useToast();
const { t } = useI18n();

// The ceremony can't run on mount: navigator.credentials.create() requires
// a real user gesture (spec'd "transient activation") — a plain lifecycle
// hook doesn't count, so an auto-triggered attempt is silently blocked by
// the browser (confirmed against a real Chromium instance, not just unit
// tests, which don't enforce this). Keyed, so the "no key" case can fail
// immediately without ever showing the button.
const key = ref<string | null>(null);
const submitting = ref(false);

onMounted(() => {
  const raw = route.query.key;
  if (typeof raw !== 'string' || raw.length === 0) {
    fail();
    return;
  }
  key.value = raw;
});

function fail() {
  toast(t('auth.activate.error'), 'error');
  void router.replace({ name: 'sign-in' });
}

async function createAccount() {
  if (!key.value) return;
  submitting.value = true;
  try {
    // Cancelled/unsupported counts as a failure too: this link is
    // single-use (see WebauthnSignupService), so there's nothing to retry
    // from here.
    const result = await runRegistration('/webauthn/signup', {
      optionsBody: { key: key.value },
    });
    if (!result.ok) {
      fail();
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

    <template v-if="key">
      <p class="text-muted">{{ $t('auth.activate.intro') }}</p>
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
