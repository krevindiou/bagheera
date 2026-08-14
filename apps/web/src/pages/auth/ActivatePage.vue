<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { apiClient } from "../../api/client";

type Status = "pending" | "success" | "error";

const route = useRoute();
const status = ref<Status>("pending");

onMounted(async () => {
  const key = route.query.key;
  if (typeof key !== "string" || key.length === 0) {
    status.value = "error";
    return;
  }

  const { response } = await apiClient.POST("/members/activate", { body: { key } });
  status.value = response.ok ? "success" : "error";
});
</script>

<template>
  <div class="container py-5" style="max-width: 480px">
    <h1>{{ $t("auth.activate.title") }}</h1>

    <p v-if="status === 'pending'">{{ $t("auth.activate.pending") }}</p>
    <div v-else-if="status === 'success'" class="alert alert-success" role="alert">
      {{ $t("auth.activate.success") }}
    </div>
    <div v-else class="alert alert-danger" role="alert">
      {{ $t("auth.activate.error") }}
    </div>

    <div v-if="status !== 'pending'" class="mt-3">
      <router-link :to="{ name: 'sign-in' }">{{ $t("auth.activate.signInLink") }}</router-link>
    </div>
  </div>
</template>
