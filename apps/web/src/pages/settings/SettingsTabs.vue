<script setup lang="ts">
import { useRoute } from 'vue-router';

// Shared header for all 3 settings routes: one "Settings" title plus an
// underline tab bar (see docs/design_handoff_fintech_noir_theme/README.md
// §9). The 3 routes stay separate (each keeps its own URL, guard, and
// spec) — this is purely the shared chrome each page renders at its top.
const route = useRoute();

const tabs = [
  { name: 'settings-profile', label: 'settings.profile.title' },
  { name: 'settings-password', label: 'settings.password.tab' },
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
