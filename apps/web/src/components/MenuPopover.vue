<script setup lang="ts">
import { ref } from 'vue';
import { useDismissable } from '../composables/useDismissable';

// A trigger plus a floating panel that closes on Escape or an outside click.
// The consumer draws the trigger (`#trigger` gets `open` for aria-expanded
// and `toggle`) and the panel's contents (default slot); `panelClass` adds
// its placement, since the account menu opens upward and the language
// picker downward. Attributes (the consumer's own root class) land on the
// wrapping element.
defineProps<{ panelClass?: string }>();
const open = defineModel<boolean>('open', { default: false });

const root = ref<HTMLElement | null>(null);
useDismissable(open, root);
</script>

<template>
  <div ref="root">
    <slot name="trigger" :open="open" :toggle="() => (open = !open)" />
    <div v-if="open" class="menu-panel" :class="panelClass">
      <slot />
    </div>
  </div>
</template>
