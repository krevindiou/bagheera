<script setup lang="ts">
import { computed } from "vue";
import { getPasswordStrength } from "../composables/usePasswordStrength";

const { password } = defineProps<{ password: string }>();

const strength = computed(() => getPasswordStrength(password));
const widthPercent = computed(() => (strength.value.score + 1) * 20);
const barClass = computed(
  () =>
    ({
      weak: "bg-danger",
      fair: "bg-warning",
      good: "bg-info",
      strong: "bg-success",
    })[strength.value.label],
);
</script>

<template>
  <div v-if="password.length > 0" class="mt-1">
    <div
      class="progress"
      style="height: 4px"
      role="progressbar"
      :aria-valuenow="widthPercent"
    >
      <div
        class="progress-bar"
        :class="barClass"
        :style="{ width: `${widthPercent}%` }"
      ></div>
    </div>
    <small class="form-text">{{
      $t(`password.strength.${strength.label}`)
    }}</small>
  </div>
</template>
