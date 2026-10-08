<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
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

onMounted(() => {
  // Held in memory only: the link's token leaves the address bar at once
  // (history, copied URLs and error reports would otherwise keep it while
  // the page waits for the click).
  key.value = takeUrlKey(route, router);
  if (!key.value) {
    fail();
  }
});

function fail() {
  toast(t('auth.activate.error'), 'error');
  void router.replace({ name: 'sign-in' });
}

async function createAccount() {
  if (!key.value) return;
  submitting.value = true;
  try {
    // Cancelled counts as a failure too; the emailed link stays valid for a
    // retry until its TTL.
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
