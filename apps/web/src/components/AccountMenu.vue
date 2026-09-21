<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { apiClient } from '../api/client';
import { useEscapeKey } from '../composables/useEscapeKey';
import { useLocaleSwitch } from '../composables/useLocaleSwitch';
import { SUPPORTED_LOCALES, type Locale } from '../i18n/locales';
import { useSessionStore } from '../stores/session.store';

// The sidebar footer's account button: avatar + email double as the menu
// trigger, matching the avatar-as-menu-button convention most SaaS shells
// use (Linear/Notion/Slack) rather than the account chip and language
// picker sitting as separate always-visible controls.
const session = useSessionStore();
const router = useRouter();
const { t } = useI18n();
const { current, choose } = useLocaleSwitch();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

const initials = computed(() => (session.member?.email ?? '??').slice(0, 2).toUpperCase());

// Always mounted (BaseLayout's sidebar), so this listener lives for the
// app's whole lifetime — guard the callback on `open` rather than
// mounting/unmounting it, same as ConfirmModal.
useEscapeKey(() => {
  if (open.value) open.value = false;
});

function onDocumentClick(event: MouseEvent): void {
  if (open.value && root.value && !root.value.contains(event.target as Node)) {
    open.value = false;
  }
}
onMounted(() => document.addEventListener('click', onDocumentClick));
onUnmounted(() => document.removeEventListener('click', onDocumentClick));

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
  <div ref="root" class="account-menu">
    <button
      type="button"
      class="account-trigger"
      :aria-label="t('home.accountMenu')"
      :aria-expanded="open"
      @click="open = !open"
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

    <div v-if="open" class="account-panel">
      <div class="account-section-label">{{ t('language.label') }}</div>
      <button
        v-for="code in SUPPORTED_LOCALES"
        :key="code"
        type="button"
        role="option"
        class="account-lang-option"
        :class="{ selected: code === current }"
        :aria-selected="code === current"
        @click="pickLocale(code)"
      >
        {{ t(`language.${code}`) }}
        <svg
          v-if="code === current"
          class="account-check"
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 8.5l3.2 3.2L13 4.5"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>

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
    </div>
  </div>
</template>
