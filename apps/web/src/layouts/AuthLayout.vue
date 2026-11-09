<script setup lang="ts">
// The pre-auth shell (sign-in, register, activate, confirm-email-change):
// a plain card centered over a decorative background.
import LanguageSwitcher from '../components/LanguageSwitcher.vue';
import StreamBackground from '../components/auth-background/StreamBackground.vue';
</script>

<template>
  <div class="auth-shell">
    <StreamBackground class="auth-bg" />
    <div class="auth-grain" />
    <LanguageSwitcher class="auth-lang-switcher" />
    <div class="auth-card">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.auth-lang-switcher {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 1;
}

.auth-shell {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: var(--bg);
}
.auth-bg,
.auth-grain {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
/* Fine paper grain over the background, so flat shapes read as a print. */
.auth-grain {
  opacity: 0.08;
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.3 0 0 0 0 0.2 0 0 0 0 0.1 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
.auth-card {
  width: 100%;
  max-width: 400px;
  position: relative;
  z-index: 1;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 44px 40px;
  box-shadow: var(--shadow-float);
}

@media (max-width: 480px) {
  .auth-card {
    padding: 36px 26px;
  }
}
</style>
