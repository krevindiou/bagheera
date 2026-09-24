<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLocaleSwitch } from '../composables/useLocaleSwitch';
import type { Locale } from '../i18n/locales';
import LocaleOptions from './LocaleOptions.vue';
import MenuPopover from './MenuPopover.vue';

const { t } = useI18n();
const { current, choose } = useLocaleSwitch();

const open = ref(false);

async function pick(locale: Locale): Promise<void> {
  open.value = false;
  await choose(locale);
}
</script>

<template>
  <MenuPopover v-model:open="open" class="lang-picker" panel-class="lang-list">
    <template #trigger="{ open: expanded, toggle }">
      <button
        type="button"
        class="lang-trigger"
        :aria-label="t('language.label')"
        :aria-expanded="expanded"
        @click="toggle"
      >
        {{ current.toUpperCase() }}
        <svg
          class="lang-chevron"
          width="10"
          height="10"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </template>

    <LocaleOptions :current="current" @pick="pick" />
  </MenuPopover>
</template>
