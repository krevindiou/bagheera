<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLocaleSwitch } from '../composables/useLocaleSwitch';
import type { Locale } from '../i18n/locales';
import AppIcon from './AppIcon.vue';
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
        <AppIcon name="chevron" class="lang-chevron" :size="10" />
      </button>
    </template>

    <LocaleOptions :current="current" @pick="pick" />
  </MenuPopover>
</template>
