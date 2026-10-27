<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue';
import { FIELD_LIMITS } from '@bagheera/reference-data';

// The inline form that changes the third party of one preview row and says
// whether to remember the change for later imports. It only
// reports a choice; the page decides what to do with it.
const props = defineProps<{ line: number; initialText: string; initialRemember: boolean }>();
const emit = defineEmits<{
  keep: [change: { thirdParty: string; remember: boolean }];
  cancel: [];
}>();

const text = ref(props.initialText);
const remember = ref(props.initialRemember);
const input = useTemplateRef<HTMLInputElement>('input');

onMounted(() => input.value?.focus());

function keep() {
  emit('keep', { thirdParty: text.value.trim(), remember: remember.value });
}
</script>

<template>
  <form class="d-flex flex-column gap-1" @submit.prevent="keep" @keydown.esc.stop="emit('cancel')">
    <input
      ref="input"
      v-model="text"
      type="text"
      class="form-control form-control-sm"
      :maxlength="FIELD_LIMITS.THIRD_PARTY"
      :aria-label="$t('operations.import.preview.thirdPartyInput', { line })"
      data-testid="import-label-input"
    />
    <label class="d-flex align-items-center gap-2 small mb-0">
      <input v-model="remember" type="checkbox" data-testid="import-label-remember" />
      {{ $t('operations.import.preview.remember') }}
    </label>
    <div class="d-flex gap-2">
      <button type="submit" class="btn btn-sm btn-primary" data-testid="import-label-apply">
        {{ $t('operations.import.preview.applyChange') }}
      </button>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        data-testid="import-label-cancel"
        @click="emit('cancel')"
      >
        {{ $t('operations.import.preview.cancelChange') }}
      </button>
    </div>
  </form>
</template>
