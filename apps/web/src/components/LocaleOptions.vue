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

<style scoped>
.menu-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  background: none;
  border: none;
  padding: 7px 9px;
  border-radius: 5px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--paper-dim);
  cursor: pointer;
  text-align: left;
}
.menu-option:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--paper);
}
.menu-option.selected {
  color: var(--paper);
}
.menu-check {
  color: var(--violet-soft);
  flex: none;
}
</style>
