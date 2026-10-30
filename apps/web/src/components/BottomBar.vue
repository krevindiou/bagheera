<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

// The bar pinned to the bottom of the content area, for the actions of a list
// selection or of a multi-step page. Fixed rather than an in-flow row — a row
// toggling in/out pushed the page by its own height. Spans the content area
// only, so the sidebar's account menu stays reachable; the inner row follows
// the page's content column (see the variables on BaseLayout's .app-shell) so
// its content lines up with the table edges. Attributes land on the bar.

// Toasts share the bottom edge; publishing the bar's live height (it wraps
// to two rows on narrow screens) lets ToastContainer stack above it.
const HEIGHT_VAR = '--bottom-bar-height';
const bar = ref<HTMLElement | null>(null);
let observer: ResizeObserver | undefined;

function stopPublishingHeight() {
  observer?.disconnect();
  observer = undefined;
  document.documentElement.style.removeProperty(HEIGHT_VAR);
}

watch(bar, (element) => {
  stopPublishingHeight();
  if (!element) return;
  observer = new ResizeObserver(() => {
    document.documentElement.style.setProperty(HEIGHT_VAR, `${element.offsetHeight}px`);
  });
  observer.observe(element);
});
onBeforeUnmount(stopPublishingHeight);
</script>

<template>
  <div ref="bar" class="bottom-bar">
    <div class="bottom-bar-inner">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.bottom-bar {
  position: fixed;
  left: var(--sidebar-width, 0px);
  right: 0;
  bottom: 0;
  z-index: 1040;
  background: var(--surface);
  border-top: 1px solid var(--border);
  box-shadow:
    0 -1px 3px rgba(28, 25, 23, 0.06),
    0 -12px 28px -10px rgba(28, 25, 23, 0.22);
}
.bottom-bar-inner {
  max-width: var(--content-max, none);
  margin: 0 auto;
  padding: 12px var(--content-gutter, 16px);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}
</style>
