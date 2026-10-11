<script setup lang="ts">
import { useAttrs } from 'vue';

// A bordered, scrollable checkbox group for picking several of a short flat
// list (accounts, payment methods): unlike <select multiple>, a second
// pick needs no Ctrl/Cmd+click. `id` lands on the `role="group"` container, which derives `aria-labelledby`
// from it to stay named by the caller's FormField label (FormField gives
// that label a matching `${id}-label` id).
defineOptions({ inheritAttrs: false });
defineProps<{ items: { id: string; label: string }[] }>();
const model = defineModel<string[]>({ default: () => [] });
const attrs = useAttrs();
</script>

<template>
  <div
    v-bind="attrs"
    class="checkbox-list"
    role="group"
    :aria-labelledby="attrs.id ? `${attrs.id}-label` : undefined"
  >
    <div v-for="item in items" :key="item.id" class="form-check">
      <input
        :id="attrs.id ? `${attrs.id}-${item.id}` : undefined"
        v-model="model"
        class="form-check-input"
        type="checkbox"
        :value="item.id"
      />
      <label class="form-check-label" :for="attrs.id ? `${attrs.id}-${item.id}` : undefined">
        {{ item.label }}
      </label>
    </div>
  </div>
</template>
