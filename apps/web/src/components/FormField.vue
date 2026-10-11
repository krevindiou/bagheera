<script setup lang="ts">
import { onMounted, onUpdated, ref } from 'vue';

// A form row: label, the control (default slot), an optional hint and the
// error message. The control keeps its own `is-invalid` class. The error
// is always `d-block`, since Bootstrap only shows `.invalid-feedback` as a
// sibling of the control — which it isn't inside an `.input-group`.
// Attributes (`flex-grow-1`, `col`, `transfer-accent`) land on the root.
//
// The label's `${for}-label` id names controls that aren't labelable (a
// checkbox-list group). After each render, the element whose id is `for`
// gets `aria-describedby` (the shown error/hint) and `aria-invalid`, so no
// caller has to wire them; values a control sets itself are kept.
const props = defineProps<{ label: string; for: string; error?: string; hint?: string }>();

const root = ref<HTMLElement | null>(null);
// Ids/attribute this component itself last wrote, per control element — so
// a later pass only replaces what it previously set, never a value a
// control manages on its own.
const ownDescribedByIds = new WeakMap<Element, Set<string>>();
const ownInvalid = new WeakSet<Element>();

function syncA11y() {
  const control = root.value?.querySelector<HTMLElement>(`#${CSS.escape(props.for)}`);
  if (!control) return;

  const ids: string[] = [];
  if (props.error) ids.push(`${props.for}-error`);
  if (props.hint) ids.push(`${props.for}-hint`);

  const previouslyOwned = ownDescribedByIds.get(control) ?? new Set<string>();
  const kept = (control.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter((token) => token && !previouslyOwned.has(token));
  const next = [...kept, ...ids];
  if (next.length) {
    control.setAttribute('aria-describedby', next.join(' '));
  } else {
    control.removeAttribute('aria-describedby');
  }
  ownDescribedByIds.set(control, new Set(ids));

  const hasForeignInvalid = control.hasAttribute('aria-invalid') && !ownInvalid.has(control);
  if (!hasForeignInvalid) {
    if (props.error) {
      control.setAttribute('aria-invalid', 'true');
      ownInvalid.add(control);
    } else if (ownInvalid.has(control)) {
      control.removeAttribute('aria-invalid');
      ownInvalid.delete(control);
    }
  }
}

onMounted(syncA11y);
onUpdated(syncA11y);
</script>

<template>
  <div ref="root" class="mb-3">
    <label :id="`${props.for}-label`" class="form-label" :for="props.for">{{ label }}</label>
    <slot />
    <div v-if="error" :id="`${props.for}-error`" class="invalid-feedback d-block">{{ error }}</div>
    <div v-if="hint" :id="`${props.for}-hint`" class="form-text">{{ hint }}</div>
  </div>
</template>
