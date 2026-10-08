<script setup lang="ts">
// The pre-auth shell (sign-in, register, activate, confirm-email-change):
// dark gradient, vignette and violet halo behind a centered card.
import LanguageSwitcher from '../components/LanguageSwitcher.vue';
</script>

<template>
  <div class="auth-shell">
    <div class="auth-halo"></div>
    <LanguageSwitcher class="auth-lang-switcher" />
    <div class="auth-card">
      <div class="logo-mark auth-logo">B</div>
      <div class="auth-rule"></div>
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
  background: linear-gradient(160deg, #150f1e 0%, var(--ink) 45%, #0a0810 100%);
}
.auth-shell::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 0%, rgba(124, 79, 209, 0.16), transparent 55%);
  pointer-events: none;
}
.auth-halo {
  position: absolute;
  width: 480px;
  height: 480px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(154, 114, 232, 0.35), transparent 70%);
  filter: blur(40px);
  pointer-events: none;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.auth-card {
  width: 100%;
  max-width: 420px;
  position: relative;
  z-index: 1;
  background: var(--panel);
  border-radius: 6px;
  padding: 48px 44px;
  box-shadow:
    0 30px 80px -20px rgba(0, 0, 0, 0.6),
    0 0 0 1px var(--hair-strong),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
.auth-logo {
  width: 44px;
  height: 44px;
  font-size: 20px;
  margin-bottom: 26px;
}
.auth-rule {
  width: 32px;
  height: 2px;
  background: linear-gradient(90deg, var(--violet-bright), transparent);
  margin-bottom: 18px;
}

@media (max-width: 480px) {
  .auth-card {
    padding: 36px 26px;
  }
}
</style>
