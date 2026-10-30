<script setup lang="ts">
import { ref, useId } from 'vue';

// A label that says it has more to tell with a dotted underline (the cue
// browsers give an abbreviation), the extra `text` showing in a bubble to
// its right on hover or keyboard
// focus (the bubble is also its accessible description, so a touch or screen
// reader user can reach it). Escape closes it while the label has focus;
// moving off re-arms it. The bubble opens sideways, not above or below, so a
// table's rounded, clipping container never cuts it off.
defineProps<{ text: string }>();

const id = useId();
const dismissed = ref(false);
</script>

<template>
  <span
    class="hint"
    :class="{ 'hint-dismissed': dismissed }"
    tabindex="0"
    :aria-describedby="id"
    @keydown.esc="dismissed = true"
    @mouseleave="dismissed = false"
    @blur="dismissed = false"
  >
    <span class="hint-label"><slot /></span>
    <span :id="id" role="tooltip" class="hint-bubble">{{ text }}</span>
  </span>
</template>

<style scoped>
.hint {
  position: relative;
  display: inline-block;
  cursor: help;
}
.hint-label {
  text-decoration: underline dotted var(--text-faint);
  text-underline-offset: 4px;
}
.hint-bubble {
  position: absolute;
  top: 50%;
  left: 100%;
  margin-left: 10px;
  transform: translateY(-50%);
  z-index: 5;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--text);
  color: var(--surface);
  font-size: 12.5px;
  line-height: 1.3;
  white-space: nowrap;
  box-shadow: 0 6px 18px -6px rgba(28, 25, 23, 0.35);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.12s;
}
.hint:hover:not(.hint-dismissed) .hint-bubble,
.hint:focus-visible:not(.hint-dismissed) .hint-bubble {
  opacity: 1;
  visibility: visible;
}
</style>
