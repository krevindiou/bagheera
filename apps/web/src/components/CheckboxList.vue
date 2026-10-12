<script setup lang="ts">
import { computed, useAttrs } from 'vue';

// A bordered, scrollable checkbox group for picking several of a short flat
// list (accounts, payment methods): unlike <select multiple>, a second
// pick needs no Ctrl/Cmd+click. `id` lands on the `role="group"` container,
// which derives `aria-labelledby` from it to stay named by the caller's
// FormField label (FormField gives that label a matching `${id}-label` id).
// Items sharing a `group` render under that heading, so same-named items
// from different groups stay distinguishable.
defineOptions({ inheritAttrs: false });
const props = defineProps<{ items: { id: string; label: string; group?: string }[] }>();
const model = defineModel<string[]>({ default: () => [] });
const attrs = useAttrs();

const sections = computed(() => {
  const result: { group?: string; items: typeof props.items }[] = [];
  for (const item of props.items) {
    const last = result.at(-1);
    if (last && last.group === item.group) last.items.push(item);
    else result.push({ group: item.group, items: [item] });
  }
  return result;
});

function inputId(itemId: string): string | undefined {
  return typeof attrs.id === 'string' ? `${attrs.id}-${itemId}` : undefined;
}
</script>

<template>
  <div
    v-bind="attrs"
    class="checkbox-list"
    role="group"
    :aria-labelledby="attrs.id ? `${attrs.id}-label` : undefined"
  >
    <div
      v-for="section in sections"
      :key="section.group ?? ''"
      :role="section.group ? 'group' : undefined"
      :aria-label="section.group"
    >
      <div v-if="section.group" class="checkbox-list-group-label" aria-hidden="true">
        {{ section.group }}
      </div>
      <div v-for="item in section.items" :key="item.id" class="form-check">
        <input
          :id="inputId(item.id)"
          v-model="model"
          class="form-check-input"
          type="checkbox"
          :value="item.id"
        />
        <label class="form-check-label" :for="inputId(item.id)">
          {{ item.label }}
        </label>
      </div>
    </div>
  </div>
</template>
