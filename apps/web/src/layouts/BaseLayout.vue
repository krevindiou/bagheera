<script setup lang="ts">
import ConfirmModal from "../components/ConfirmModal.vue";
import ToastContainer from "../components/ToastContainer.vue";
</script>

<template>
  <div id="app-root">
    <nav class="navbar navbar-expand navbar-dark bg-dark">
      <div class="container-fluid">
        <span class="navbar-brand">{{ $t("app.brand") }}</span>
      </div>
    </nav>
    <main>
      <router-view />
    </main>
    <ToastContainer />
    <ConfirmModal />
  </div>
</template>
