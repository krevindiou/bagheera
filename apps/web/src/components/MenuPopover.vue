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

<style scoped>
/* The floating panel shared by the account menu and the language picker;
   each consumer passes only its own placement via `panelClass`
   (.account-panel, .lang-list below) — kept here rather than in
   AccountMenu.vue/LanguageSwitcher.vue because `panelClass` is just a
   string those components hand this one; the actual .menu-panel element
   (and so its data-v scope) belongs to this component, not theirs. */
.menu-panel {
  position: absolute;
  background: var(--panel-2);
  border: 1px solid var(--hair-strong);
  border-radius: 7px;
  box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.6);
  padding: 4px;
  z-index: 5;
}

/* Opens upward: the account menu's trigger sits at the very bottom of the
   sidebar, so a downward menu would run off-screen. */
.account-panel {
  bottom: calc(100% + 8px);
  left: 0;
  right: 0;
}
.lang-list {
  top: calc(100% + 6px);
  right: 0;
  min-width: 132px;
}

/* The sidebar becomes a top bar below this width (mirrors BaseLayout.vue's
   own 820px breakpoint, where the sidebar switches from a side column to a
   top strip) — the account panel has room below it now, not above. */
@media (max-width: 820px) {
  .account-panel {
    top: calc(100% + 8px);
    bottom: auto;
  }
}
</style>
