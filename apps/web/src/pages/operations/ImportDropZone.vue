<script setup lang="ts">
import { IMPORT_LIMITS } from '@bagheera/reference-data';
import { ref } from 'vue';

// Where the Member provides the bank file, by choosing it or dropping it.
// It only reports the file; the page uploads it.
const props = defineProps<{ disabled: boolean; fileName: string | null }>();
const emit = defineEmits<{ file: [file: File] }>();

const dragging = ref(false);

function chosen(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) emit('file', file);
}

function dropped(event: DragEvent) {
  dragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file && !props.disabled) emit('file', file);
}

function over() {
  dragging.value = !props.disabled;
}
</script>

<template>
  <label
    for="import-file"
    class="import-drop"
    :class="{
      'import-drop--over': dragging,
      'import-drop--disabled': disabled,
      'import-drop--compact': fileName,
    }"
    data-testid="import-drop"
    @dragenter.prevent="over"
    @dragover.prevent="over"
    @dragleave="dragging = false"
    @drop.prevent="dropped"
  >
    <template v-if="fileName">
      <span class="small text-break" data-testid="import-file-name">
        {{ $t('operations.import.fileChosen', { name: fileName }) }}
      </span>
      <span class="small text-decoration-underline text-nowrap" data-testid="import-replace">
        {{ $t('operations.import.replaceFile') }}
      </span>
    </template>
    <template v-else>
      <span class="fw-semibold">{{ $t('operations.import.file') }}</span>
      <span class="text-muted small">{{ $t('operations.import.dropHint') }}</span>
      <span class="text-muted small" data-testid="import-limits">
        {{
          $t('operations.import.fileHint', {
            size: IMPORT_LIMITS.MAX_FILE_BYTES / (1024 * 1024),
            rows: IMPORT_LIMITS.MAX_ROWS,
          })
        }}
      </span>
    </template>
    <input
      id="import-file"
      type="file"
      class="visually-hidden"
      accept=".ofx,.qfx"
      :disabled="disabled"
      data-testid="import-file"
      @change="chosen"
    />
  </label>
</template>

<style scoped>
.import-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 1.5rem 1rem;
  text-align: center;
  cursor: pointer;
  border: 2px dashed var(--bs-border-color);
  border-radius: var(--bs-border-radius);
}

.import-drop:hover,
.import-drop--over,
.import-drop:focus-within {
  border-color: var(--bs-primary);
  background: var(--bs-tertiary-bg);
}

.import-drop--compact {
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  text-align: left;
}

.import-drop--disabled {
  cursor: progress;
  opacity: 0.6;
}
</style>
