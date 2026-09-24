<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { apiClient } from '../api/client';
import { useLocaleSwitch } from '../composables/useLocaleSwitch';
import type { Locale } from '../i18n/locales';
import { useSessionStore } from '../stores/session.store';
import LocaleOptions from './LocaleOptions.vue';
import MenuPopover from './MenuPopover.vue';

// The sidebar footer's account button: avatar + email double as the menu
// trigger, matching the avatar-as-menu-button convention most SaaS shells
// use (Linear/Notion/Slack) rather than the account chip and language
// picker sitting as separate always-visible controls.
const session = useSessionStore();
const router = useRouter();
const { t } = useI18n();
const { current, choose } = useLocaleSwitch();

const open = ref(false);

const initials = computed(() => (session.member?.email ?? '??').slice(0, 2).toUpperCase());

async function pickLocale(locale: Locale): Promise<void> {
  open.value = false;
  await choose(locale);
}

async function signOut(): Promise<void> {
  open.value = false;
  await apiClient.POST('/auth/sign-out');
  session.clear();
  router.push({ name: 'sign-in' });
}
</script>

<template>
  <MenuPopover v-model:open="open" class="account-menu" panel-class="account-panel">
    <template #trigger="{ open: expanded, toggle }">
      <button
        type="button"
        class="account-trigger"
        :aria-label="t('home.accountMenu')"
        :aria-expanded="expanded"
        @click="toggle"
      >
        <span class="account-avatar">{{ initials }}</span>
        <span class="account-email" :title="session.member?.email">
          {{ session.member?.email }}
        </span>
        <svg
          class="account-chevron"
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </template>

    <div class="account-section-label">{{ t('language.label') }}</div>
    <LocaleOptions :current="current" @pick="pickLocale" />

    <div class="account-divider"></div>
    <button type="button" class="account-logout" @click="signOut">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        />
        <path
          d="M10.5 11L14 8l-3.5-3"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path d="M14 8H6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      </svg>
      {{ t('home.signOut') }}
    </button>
  </MenuPopover>
</template>
