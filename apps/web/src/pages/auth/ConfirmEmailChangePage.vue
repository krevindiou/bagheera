<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { apiClient } from '../../api/client';
import { useToast } from '../../composables/useToast';
import AuthLayout from '../../layouts/AuthLayout.vue';

const route = useRoute();
const router = useRouter();
const { push: toast } = useToast();
const { t } = useI18n();
const pending = ref(true);

onMounted(async () => {
  const key = route.query.key;
  if (typeof key !== 'string' || key.length === 0) {
    toast(t('auth.confirmEmailChange.error'), 'error');
    router.replace({ name: 'sign-in' });
    return;
  }

  const { response } = await apiClient.POST('/members/profile/confirm-email-change', {
    body: { key },
  });
  if (response.ok) {
    toast(t('auth.confirmEmailChange.success'), 'success');
  } else {
    toast(t('auth.confirmEmailChange.error'), 'error');
  }
  router.replace({ name: 'sign-in' });
});
</script>

<template>
  <AuthLayout>
    <h1>{{ $t('auth.confirmEmailChange.title') }}</h1>

    <p v-if="pending" class="text-muted mb-0">{{ $t('auth.confirmEmailChange.pending') }}</p>
  </AuthLayout>
</template>
