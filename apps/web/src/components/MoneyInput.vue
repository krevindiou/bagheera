<script setup lang="ts">
import { ref } from 'vue';

// A decimal number input behind a currency-symbol add-on. Attributes (`id`,
// validation handlers) land on the <input>, not the wrapping group.
defineOptions({ inheritAttrs: false });
defineProps<{ symbol: string; invalid?: boolean }>();
const amount = defineModel<number | string | undefined>();

const input = ref<HTMLInputElement | null>(null);
defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <div class="input-group">
    <span class="input-group-text">{{ symbol }}</span>
    <input
      v-bind="$attrs"
      ref="input"
      v-model="amount"
      type="number"
      inputmode="decimal"
      step="0.01"
      class="form-control"
      :class="{ 'is-invalid': invalid }"
    />
  </div>
</template>
