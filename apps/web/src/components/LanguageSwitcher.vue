<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { apiClient } from '../api/client';
import { setLocale } from '../i18n';
import {
  isSupportedLocale,
  setStoredLocale,
  SUPPORTED_LOCALES,
  type Locale,
} from '../i18n/locales';
import { useSessionStore } from '../stores/session.store';
import { useToast } from '../composables/useToast';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const { t } = useI18n();
const { push: toast } = useToast();

const current = computed<Locale>(() =>
  isSupportedLocale(route.params.locale) ? route.params.locale : 'en',
);

async function choose(locale: Locale): Promise<void> {
  if (locale === current.value) return;

  // Every call site elsewhere navigates by name and lets the router fill
  // in `locale` from the current route (see router/index.ts's withLocale)
  // — this is the one place that instead passes it explicitly, since
  // switching *is* the locale change.
  await setLocale(locale);
  setStoredLocale(locale);
  await router.replace({ name: route.name ?? undefined, params: { ...route.params, locale } });

  if (session.isAuthenticated) {
    const { response } = await apiClient.POST('/members/locale', { body: { locale } });
    if (response.ok) {
      session.setLocale(locale);
    } else {
      toast(t('language.genericError'), 'error');
    }
  }
}

// A <select> rather than a button row: more locales are coming, and a row
// of buttons grows wider (and eventually wraps) with every one added — a
// dropdown's footprint stays constant regardless of SUPPORTED_LOCALES'
// length.
function onChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  if (isSupportedLocale(value)) {
    void choose(value);
  }
}
</script>

<template>
  <select
    class="form-select form-select-sm lang-switcher"
    :aria-label="t('language.label')"
    :value="current"
    @change="onChange"
  >
    <option v-for="code in SUPPORTED_LOCALES" :key="code" :value="code">
      {{ t(`language.${code}`) }}
    </option>
  </select>
</template>

<style scoped>
.lang-switcher {
  /* Fixed rather than content-sized — a native <select>'s width otherwise
     jumps with whichever option is currently selected, which gets more
     noticeable as more (and more varied-length) locale names are added. */
  width: 110px;
}
</style>
