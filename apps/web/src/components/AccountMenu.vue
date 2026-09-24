<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { apiClient } from '../api/client';
import { useLocaleSwitch } from '../composables/useLocaleSwitch';
import type { Locale } from '../i18n/locales';
import { useSessionStore } from '../stores/session.store';
import AppIcon from './AppIcon.vue';
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
        <AppIcon name="chevron" class="account-chevron" :size="12" />
      </button>
    </template>

    <div class="account-section-label">{{ t('language.label') }}</div>
    <LocaleOptions :current="current" @pick="pickLocale" />

    <div class="account-divider"></div>
    <button type="button" class="account-logout" @click="signOut">
      <AppIcon name="logout" :size="13" />
      {{ t('home.signOut') }}
    </button>
  </MenuPopover>
</template>
