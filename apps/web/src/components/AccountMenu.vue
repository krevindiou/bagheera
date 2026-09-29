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
  void router.push({ name: 'sign-in' });
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

<style scoped>
.account-menu {
  position: relative;
}
.account-trigger {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  background: none;
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 6px;
  cursor: pointer;
  color: inherit;
  text-align: left;
}
.account-trigger:hover,
.account-trigger[aria-expanded='true'] {
  background: rgba(255, 255, 255, 0.04);
  border-color: var(--hair-strong);
}
.account-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--panel-2);
  border: 1px solid var(--hair-strong);
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
}
.account-email {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.account-chevron {
  flex: none;
  color: var(--paper-faint);
  transition: transform 0.15s ease;
}
.account-trigger[aria-expanded='true'] .account-chevron {
  transform: rotate(180deg);
  color: var(--paper);
}
.account-section-label {
  padding: 8px 9px 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--paper-faint);
}
.account-divider {
  height: 1px;
  background: var(--hair);
  margin: 4px 0;
}
.account-logout {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: none;
  border: none;
  padding: 9px;
  border-radius: 5px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--red);
  cursor: pointer;
  text-align: left;
}
.account-logout:hover {
  background: rgba(232, 105, 122, 0.1);
}
</style>
