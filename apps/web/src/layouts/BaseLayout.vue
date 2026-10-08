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

// Operations and schedulers are reached through Accounts, so they light up
// "Accounts"; every settings route lights up "Settings".
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

  <!-- Mounted once, signed in or out: they render useConfirm/useToast's
       shared state. -->
  <ConfirmModal />
  <ToastContainer />
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
  position: relative;
  background: var(--ink);
}
/* Decorative violet halo from the top-left corner. */
.app-glow {
  position: absolute;
  width: 520px;
  height: 520px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(154, 114, 232, 0.16), transparent 70%);
  filter: blur(50px);
  pointer-events: none;
  top: -120px;
  left: -120px;
}
.sidebar {
  width: 236px;
  flex: none;
  background: var(--panel);
  border-right: 1px solid var(--hair);
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
  /* Positioned so .app-glow (absolute) paints behind it; sticky also pins
     it, logout included, to the viewport. */
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  /* Above .main (positioned, later in the DOM): on mobile .account-panel
     overflows into .main, which would otherwise eat its clicks. */
  z-index: 2;
}
.side-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  text-decoration: none;
  color: var(--paper);
}
.side-brand-name {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 600;
  font-size: 17px;
}
.side-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 28px;
}
.side-nav-item {
  cursor: pointer;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 14.5px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--paper-dim);
  text-decoration: none;
}
.side-nav-item:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--paper);
}
.side-nav-item.active {
  color: var(--paper);
}
.side-nav-item .dot {
  width: 6px;
  height: 6px;
}
.side-foot {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--hair);
}

.main {
  flex: 1;
  min-width: 0;
  position: relative;
}
.main-inner {
  max-width: 1080px;
  margin: 0 auto;
  padding: 36px 40px 60px;
}

@media (max-width: 820px) {
  .app-shell {
    flex-direction: column;
  }
  /* Row 1: brand and account menu, always visible. Row 2: the nav, the one
     strip that scrolls sideways. */
  .sidebar {
    width: 100%;
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-areas: 'brand . foot' 'nav nav nav';
    align-items: center;
    padding: 14px 16px;
    row-gap: 14px;
    height: auto;
    overflow-y: visible;
  }
  .side-brand {
    grid-area: brand;
    margin-bottom: 0 !important;
  }
  .side-nav {
    grid-area: nav;
    flex-direction: row;
    margin-top: 0;
    gap: 6px;
    overflow-x: auto;
  }
  .side-foot {
    grid-area: foot;
    margin-top: 0;
    padding-top: 0;
    border-top: none;
    max-width: 220px;
  }
  .main-inner {
    padding: 24px 18px 40px;
  }
}
</style>
