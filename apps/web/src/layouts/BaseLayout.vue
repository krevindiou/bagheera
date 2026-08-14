<script setup lang="ts">
import ConfirmModal from "../components/ConfirmModal.vue";
import ToastContainer from "../components/ToastContainer.vue";
import { useSessionStore } from "../stores/session.store";

const session = useSessionStore();
</script>

<template>
  <div id="app-root">
    <nav class="navbar navbar-expand navbar-dark bg-dark">
      <div class="container-fluid">
        <router-link v-if="session.isAuthenticated" :to="{ name: 'home' }" class="navbar-brand">
          {{ $t("app.brand") }}
        </router-link>
        <span v-else class="navbar-brand">{{ $t("app.brand") }}</span>
      </div>
    </nav>
    <main>
      <router-view />
    </main>
    <ToastContainer />
    <ConfirmModal />
  </div>
</template>
