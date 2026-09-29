<script setup lang="ts">
import { useRoute } from 'vue-router';

// Shared header for both settings routes: one "Settings" title plus an
// underline tab bar (see docs/design_handoff_fintech_noir_theme/README.md
// §9). The routes stay separate (each keeps its own URL, guard, and
// spec) — this is purely the shared chrome each page renders at its top.
const route = useRoute();

const tabs = [
  { name: 'settings-profile', label: 'settings.profile.title' },
  { name: 'settings-passkeys', label: 'settings.passkeys.title' },
] as const;
</script>

<template>
  <h1 class="mb-4">{{ $t('nav.settings') }}</h1>
  <nav class="tab-bar">
    <router-link
      v-for="tab in tabs"
      :key="tab.name"
      :to="{ name: tab.name }"
      class="tab-item"
      :class="{ active: route.name === tab.name }"
    >
      {{ $t(tab.label) }}
    </router-link>
  </nav>
</template>

<style scoped>
.tab-bar {
  display: flex;
  gap: 22px;
  border-bottom: 1px solid var(--hair);
  margin-bottom: 26px;
}
.tab-item {
  padding-bottom: 12px;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--paper-dim);
  border-bottom: 2px solid transparent;
  text-decoration: none;
}
.tab-item:hover {
  color: var(--paper);
}
.tab-item.active {
  color: var(--paper);
  border-bottom-color: var(--violet-bright);
}
</style>
