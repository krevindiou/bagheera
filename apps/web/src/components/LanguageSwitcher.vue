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

<style scoped>
/* A themed replacement for a native <select>: a compact trigger (current
   locale code) that opens a small listbox of full locale names — same
   panel/hairline/violet language as the rest of the shell instead of OS
   chrome. */
.lang-picker {
  position: relative;
  flex: none;
}
.lang-trigger {
  display: flex;
  align-items: center;
  gap: 5px;
  background: var(--panel-2);
  border: 1px solid var(--hair-strong);
  color: var(--paper-dim);
  font-size: 11.5px;
  font-weight: 600;
  padding: 5px 7px 5px 9px;
  border-radius: 6px;
  cursor: pointer;
}
.lang-trigger:hover {
  color: var(--paper);
  border-color: var(--paper-faint);
}
.lang-trigger[aria-expanded='true'] {
  color: var(--paper);
  border-color: var(--violet);
}
.lang-chevron {
  flex: none;
  color: var(--paper-faint);
  transition: transform 0.15s ease;
}
.lang-trigger[aria-expanded='true'] .lang-chevron {
  transform: rotate(180deg);
  color: var(--violet-soft);
}
</style>
