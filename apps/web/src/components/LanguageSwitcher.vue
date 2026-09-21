<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useEscapeKey } from '../composables/useEscapeKey';
import { useLocaleSwitch } from '../composables/useLocaleSwitch';
import { SUPPORTED_LOCALES, type Locale } from '../i18n/locales';

const { t } = useI18n();
const { current, choose } = useLocaleSwitch();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

// This component is always mounted (the pre-auth shell), so the listener
// lives for the app's whole lifetime — guard the callback on `open` rather
// than mounting/unmounting it, same as ConfirmModal.
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

async function pick(locale: Locale): Promise<void> {
  open.value = false;
  await choose(locale);
}
</script>

<template>
  <div ref="root" class="lang-picker">
    <button
      type="button"
      class="lang-trigger"
      :aria-label="t('language.label')"
      :aria-expanded="open"
      @click="open = !open"
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
    <div v-if="open" class="lang-list" role="listbox" :aria-label="t('language.label')">
      <button
        v-for="code in SUPPORTED_LOCALES"
        :key="code"
        type="button"
        role="option"
        class="lang-option"
        :class="{ selected: code === current }"
        :aria-selected="code === current"
        @click="pick(code)"
      >
        {{ t(`language.${code}`) }}
        <svg
          v-if="code === current"
          class="lang-check"
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
    </div>
  </div>
</template>
