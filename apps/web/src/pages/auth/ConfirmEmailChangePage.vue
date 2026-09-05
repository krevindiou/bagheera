<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { apiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import ToastContainer from "../../components/ToastContainer.vue";

const route = useRoute();
const router = useRouter();
const { push: toast } = useToast();
const { t } = useI18n();
const pending = ref(true);

onMounted(async () => {
  const key = route.query.key;
  if (typeof key !== "string" || key.length === 0) {
    toast(t("auth.confirmEmailChange.error"), "error");
    router.replace({ name: "sign-in" });
    return;
  }

  const { response } = await apiClient.POST("/members/profile/confirm-email-change", {
    body: { key },
  });
  if (response.ok) {
    toast(t("auth.confirmEmailChange.success"), "success");
  } else {
    toast(t("auth.confirmEmailChange.error"), "error");
  }
  router.replace({ name: "sign-in" });
});
</script>

<template>
  <div class="container py-5" style="max-width: 480px">
    <h1>{{ $t("auth.confirmEmailChange.title") }}</h1>
    <ToastContainer />

    <p v-if="pending">{{ $t("auth.confirmEmailChange.pending") }}</p>
  </div>
</template>
