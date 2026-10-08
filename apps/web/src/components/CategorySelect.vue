<script setup lang="ts" generic="T extends string | string[] | undefined">
import { categoryLabel, type Category, type CategoryGroup } from '../domain/referenceData';

// The category <select> every form shares, single or multiple (generic
// over the v-model), with options grouped as groupCategories returns them.
// Attributes land on the <select>.
defineProps<{
  groups: CategoryGroup[];
  // The flat list `categoryLabel` looks each option's parent up in, for
  // its "Parent > Child" label.
  allCategories: Category[];
  // Label of a leading empty-valued option (a single select's "No
  // category"); without it, there is none.
  emptyLabel?: string;
}>();
const model = defineModel<T>();
</script>

<template>
  <select v-model="model" class="form-select">
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
</template>
