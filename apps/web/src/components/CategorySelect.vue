<script setup lang="ts" generic="T extends string | string[] | undefined">
import { useAttrs } from 'vue';
import { categoryLabel, type Category, type CategoryGroup } from '../domain/referenceData';

// The category picker every form shares, single or multiple (generic over
// the v-model). Single renders a native <select>; `multiple` renders a
// bordered, scrollable checkbox list instead (a second pick on a <select
// multiple> needs Ctrl/Cmd+click, which nothing hints at), with each
// group's children indented under it. Options are grouped as
// groupCategories returns them. `id` lands on the <select> or, for the
// checkbox list, on its `role="group"` container, which also derives
// `aria-labelledby` from it to stay named by the caller's FormField label
// (FormField gives that label a matching `${id}-label` id).
defineOptions({ inheritAttrs: false });
defineProps<{
  groups: CategoryGroup[];
  // The flat list `categoryLabel` looks each option's parent up in, for
  // its "Parent > Child" label.
  allCategories: Category[];
  // Label of a leading empty-valued option (a single select's "No
  // category"); without it, there is none. Ignored when `multiple`.
  emptyLabel?: string;
  multiple?: boolean;
}>();
const model = defineModel<T>();
const attrs = useAttrs();
</script>

<template>
  <select v-if="!multiple" v-bind="attrs" v-model="model" class="form-select">
    <option v-if="emptyLabel !== undefined" value="">{{ emptyLabel }}</option>
    <template v-for="group in groups" :key="group.label ?? '_'">
      <template v-if="group.label === null">
        <option v-for="c in group.categories" :key="c.id" :value="c.id">
          {{ categoryLabel(c, allCategories) }}
        </option>
      </template>
      <optgroup v-else :label="group.label">
        <option v-for="c in group.categories" :key="c.id" :value="c.id">
          {{ categoryLabel(c, allCategories) }}
        </option>
      </optgroup>
    </template>
  </select>
  <div
    v-else
    v-bind="attrs"
    class="checkbox-list"
    role="group"
    :aria-labelledby="attrs.id ? `${attrs.id}-label` : undefined"
  >
    <template v-for="group in groups" :key="group.label ?? '_'">
      <div v-if="group.label !== null" class="checkbox-list-group-label">{{ group.label }}</div>
      <div
        v-for="c in group.categories"
        :key="c.id"
        class="form-check"
        :class="{ 'form-check-child': group.label !== null && c.parentId !== null }"
      >
        <input
          :id="attrs.id ? `${attrs.id}-${c.id}` : undefined"
          v-model="model"
          class="form-check-input"
          type="checkbox"
          :value="c.id"
        />
        <label class="form-check-label" :for="attrs.id ? `${attrs.id}-${c.id}` : undefined">
          {{ categoryLabel(c, allCategories) }}
        </label>
      </div>
    </template>
  </div>
</template>
