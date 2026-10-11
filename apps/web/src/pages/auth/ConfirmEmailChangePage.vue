<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { apiClient } from '../../api/client';
import { takeUrlKey } from '../../composables/takeUrlKey';
import { useToast } from '../../composables/useToast';
import { useSessionStore } from '../../stores/session.store';
import AuthLayout from '../../layouts/AuthLayout.vue';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const { push: toast } = useToast();
const { t } = useI18n();
const pending = ref(true);

// The API keeps the confirming browser's own session, so a member opening
// the link where they are signed in stays in the app.
async function leave() {
  if (!session.restored) await session.restore();
  await router.replace({ name: session.isAuthenticated ? 'home' : 'sign-in' });
}

onMounted(async () => {
  const key = takeUrlKey(route, router);
  if (!key) {
    toast(t('auth.confirmEmailChange.error'), 'error');
    await leave();
    return;
  }

  let confirmed = false;
  try {
    const { response } = await apiClient.POST('/members/profile/confirm-email-change', {
      body: { key },
    });
    confirmed = response.ok;
  } catch {
    // A network failure confirms nothing either, same as a rejected key.
  }
  toast(
    t(confirmed ? 'auth.confirmEmailChange.success' : 'auth.confirmEmailChange.error'),
    confirmed ? 'success' : 'error',
  );
  await leave();
  // Picks up the new address. Only once off this page: a refresh failing
  // here would sign the member out and remount the page, keyless.
  if (confirmed && session.isAuthenticated) await session.fetchMember();
});
</script>

<template>
  <AuthLayout>
    <h1>{{ $t('auth.confirmEmailChange.title') }}</h1>

    <p v-if="pending" class="text-muted mb-0">{{ $t('auth.confirmEmailChange.pending') }}</p>
  </AuthLayout>
</template>
