<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { SUPPORTED_LOCALES, type Locale } from '../i18n/locales';
import AppIcon from './AppIcon.vue';

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
      <AppIcon v-if="code === current" name="check" class="menu-check" :size="12" />
    </button>
  </div>
</template>
