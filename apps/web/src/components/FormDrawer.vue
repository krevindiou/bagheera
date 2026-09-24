<script setup lang="ts">
import { ref, useId } from 'vue';
import { useEscapeKey } from '../composables/useEscapeKey';
import { useFocusTrap } from '../composables/useFocusTrap';

// Shared shell for every slide-over form (operation, scheduler, search,
// report, account, bank choice/edit): the backdrop, a titled header with
// a close button, the <form> itself, and one footer layout — the
// caller's primary action(s) sharing a row (the #actions slot), Cancel
// full-width beneath. Backdrop click, the × button, Cancel and Escape all
// emit `close`; the caller decides what closing means.
//
// Attributes land on the <form>, not the backdrop (the vee-validate
// forms' `novalidate`, the search panel's `data-testid`). The native
// submit is default-prevented before `submit` is emitted, so a
// vee-validate `handleSubmit(...)` wrapper or a plain handler both work
// as the listener.
defineOptions({ inheritAttrs: false });

defineProps<{
  title: string;
  // Secondary line under the title (e.g. the report form's per-type hint).
  subtitle?: string;
}>();
const emit = defineEmits<{ submit: []; close: [] }>();

const titleId = useId();
const subtitleId = `${titleId}-subtitle`;

const panel = ref<HTMLElement | null>(null);
useEscapeKey(() => emit('close'));
useFocusTrap(panel);
</script>

<template>
  <div class="drawer-backdrop" @click="emit('close')">
    <div
      ref="panel"
      class="drawer"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="subtitle ? subtitleId : undefined"
      @click.stop
    >
      <div class="drawer-header">
        <div>
          <h2 :id="titleId" class="drawer-title mb-0">{{ title }}</h2>
          <p v-if="subtitle" :id="subtitleId" class="form-text mb-0">{{ subtitle }}</p>
        </div>
        <button
          type="button"
          class="drawer-close"
          :aria-label="$t('common.cancel')"
          @click="emit('close')"
        >
          ×
        </button>
      </div>

      <form v-bind="$attrs" @submit.prevent="emit('submit')">
        <slot />
        <div class="drawer-actions d-flex gap-2">
          <slot name="actions" />
        </div>
        <button type="button" class="btn btn-outline-secondary w-100 mt-2" @click="emit('close')">
          {{ $t('common.cancel') }}
        </button>
      </form>
    </div>
  </div>
</template>
