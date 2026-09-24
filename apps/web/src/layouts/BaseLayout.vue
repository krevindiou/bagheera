<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import AccountMenu from '../components/AccountMenu.vue';
import ConfirmModal from '../components/ConfirmModal.vue';
import ToastContainer from '../components/ToastContainer.vue';
import { useSessionStore } from '../stores/session.store';

const session = useSessionStore();
const route = useRoute();
const { t } = useI18n();

const isAuthenticated = computed(() => session.isAuthenticated);

// The sidebar is a flat 4-item nav (Dashboard/Accounts/Reports/Settings —
// see docs/design_handoff_fintech_noir_theme/README.md). Operations and
// Schedulers are reached *through* Accounts (click a row), so they count
// as "Accounts" for the active-item dot; the 3 settings routes all count
// as "Settings".
const navItems = computed(() => [
  { label: t('nav.home'), to: { name: 'home' }, active: route.name === 'home' },
  {
    label: t('nav.accounts'),
    to: { name: 'accounts' },
    active: ['accounts', 'operations', 'schedulers'].includes(String(route.name)),
  },
  { label: t('nav.reports'), to: { name: 'reports' }, active: route.name === 'reports' },
  {
    label: t('nav.settings'),
    to: { name: 'settings-profile' },
    active: String(route.name).startsWith('settings'),
  },
]);
</script>

<template>
  <div v-if="isAuthenticated" class="app-shell">
    <div class="app-glow"></div>
    <aside class="sidebar">
      <router-link :to="{ name: 'home' }" class="side-brand">
        <span class="logo-mark">B</span>
        <span class="side-brand-name">{{ $t('app.brand') }}</span>
      </router-link>

      <nav class="side-nav">
        <router-link
          v-for="item in navItems"
          :key="item.label"
          :to="item.to"
          class="side-nav-item"
          :class="{ active: item.active }"
        >
          <span class="dot" :class="{ 'dot-active': item.active }"></span>
          {{ item.label }}
        </router-link>
      </nav>

      <div class="side-foot">
        <AccountMenu />
      </div>
    </aside>

    <div class="main">
      <div class="main-inner">
        <router-view />
      </div>
    </div>
  </div>

  <router-view v-else />

  <!-- App-wide overlays, mounted once for every route, signed in or out:
       both render module-level state (useConfirm/useToast) that any page
       or form can drive, so no page carries its own copy. -->
  <ConfirmModal />
  <ToastContainer />
</template>
