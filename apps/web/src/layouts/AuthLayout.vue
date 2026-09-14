<script setup lang="ts">
// Shared "FinTech-Noir" pre-auth shell — dark gradient + vignette + blurred
// violet halo behind a centered card (see Bagheera App v3.dc.html). Used by
// sign-in and every other pre-auth page (register, forgot/reset password,
// activate, confirm-email-change) so they all read as one consistent entry
// experience rather than only sign-in being restyled.
</script>

<template>
  <div class="auth-shell">
    <div class="auth-halo"></div>
    <div class="auth-card">
      <div class="logo-mark auth-logo">B</div>
      <div class="auth-rule"></div>
      <slot />
    </div>
  </div>
</template>
