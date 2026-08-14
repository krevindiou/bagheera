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
  <div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 1080">
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
