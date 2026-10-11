<script setup lang="ts">
// A form row: label, the control (default slot), an optional hint and the
// error message. The control keeps its own `is-invalid` class. The error
// is always `d-block`, since Bootstrap only shows `.invalid-feedback` as a
// sibling of the control — which it isn't inside an `.input-group`.
// Attributes (`flex-grow-1`, `col`, `transfer-accent`) land on the root.
//
// The label gets an `${for}-label` id so a control that isn't a single
// labelable element (a checkbox-list group) can still be named by it via
// `aria-labelledby`.
defineProps<{ label: string; for: string; error?: string; hint?: string }>();
</script>

<template>
  <div class="mb-3">
    <label :id="`${$props.for}-label`" class="form-label" :for="$props.for">{{ label }}</label>
    <slot />
    <div v-if="error" class="invalid-feedback d-block">{{ error }}</div>
    <div v-if="hint" class="form-text">{{ hint }}</div>
  </div>
</template>
