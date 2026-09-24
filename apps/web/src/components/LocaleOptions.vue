<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { SUPPORTED_LOCALES, type Locale } from '../i18n/locales';

// The language listbox shared by the account menu and the pre-auth language
// picker: every supported locale by its own name, the current one checked.
defineProps<{ current: Locale }>();
const emit = defineEmits<{ pick: [locale: Locale] }>();

const { t } = useI18n();
</script>

<template>
  <div role="listbox" :aria-label="t('language.label')">
    <button
      v-for="code in SUPPORTED_LOCALES"
      :key="code"
      type="button"
      role="option"
      class="menu-option"
      :class="{ selected: code === current }"
      :aria-selected="code === current"
      @click="emit('pick', code)"
    >
      {{ t(`language.${code}`) }}
      <svg
        v-if="code === current"
        class="menu-check"
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
</template>
