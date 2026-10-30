<script setup lang="ts">
// The pre-auth shell (sign-in, register, activate, confirm-email-change):
// a plain card centered on the page background.
import LanguageSwitcher from '../components/LanguageSwitcher.vue';
</script>

<template>
  <div class="auth-shell">
    <LanguageSwitcher class="auth-lang-switcher" />
    <div class="auth-card">
      <div class="logo-mark auth-logo">B</div>
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
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: var(--bg);
}
.auth-card {
  width: 100%;
  max-width: 400px;
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 44px 40px;
  box-shadow: var(--shadow-float);
}
.auth-logo {
  width: 40px;
  height: 40px;
  border-radius: 9px;
  font-size: 18px;
  margin-bottom: 28px;
}

@media (max-width: 480px) {
  .auth-card {
    padding: 36px 26px;
  }
}
</style>
