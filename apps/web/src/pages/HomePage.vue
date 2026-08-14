<script setup lang="ts">
// Placeholder landing page for signed-in members. Replaced by the real
// dashboard once that page exists.
import { useRouter } from "vue-router";
import { apiClient } from "../api/client";
import { useSessionStore } from "../stores/session.store";

const router = useRouter();
const session = useSessionStore();

async function signOut() {
  await apiClient.POST("/auth/sign-out");
  session.clear();
  router.push({ name: "sign-in" });
}
</script>

<template>
  <div class="container py-5">
    <p>{{ $t("home.signedInAs", { email: session.member?.email ?? "" }) }}</p>
    <div class="d-flex gap-2">
      <router-link :to="{ name: 'settings-profile' }" class="btn btn-outline-secondary">
        {{ $t("home.profileLink") }}
      </router-link>
      <router-link :to="{ name: 'settings-password' }" class="btn btn-outline-secondary">
        {{ $t("home.passwordLink") }}
      </router-link>
      <button type="button" class="btn btn-outline-secondary" @click="signOut">
        {{ $t("home.signOut") }}
      </button>
    </div>
  </div>
</template>
