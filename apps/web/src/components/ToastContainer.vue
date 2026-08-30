<script setup lang="ts">
import { useToast } from "../composables/useToast";

const { toasts, dismiss } = useToast();

const variantClass: Record<string, string> = {
  success: "text-bg-success",
  error: "text-bg-danger",
  info: "text-bg-secondary",
};
</script>

<template>
  <!-- Toasts render in the normal document flow, placed by each page
       directly under its own title, rather than as a fixed
       viewport-corner overlay. -->
  <div v-if="toasts.length > 0" class="toast-container container py-2 d-flex flex-column gap-2">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast show"
      :class="variantClass[toast.variant]"
      role="alert"
    >
      <div class="d-flex">
        <div class="toast-body">{{ toast.text }}</div>
        <button
          type="button"
          class="btn-close btn-close-white me-2 m-auto"
          @click="dismiss(toast.id)"
        ></button>
      </div>
    </div>
  </div>
</template>
