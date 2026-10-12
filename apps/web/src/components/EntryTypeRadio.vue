<script setup lang="ts">
import type { EntryType } from '@bagheera/reference-data';

// The debit/credit radio pair of the operation, scheduler and search forms.
// `idPrefix` makes the input ids `<prefix>-debit` / `<prefix>-credit`
// (/ `<prefix>-any`) and is the radios' shared `name`, so they form one
// native group: one Tab stop, arrow keys to switch. The checked radio takes
// focus when the form opens. The legend is visible only when `legend` is
// given (the search panel), otherwise kept for screen readers. `anyLabel`
// adds a third, leading "any type" (undefined) choice — only the search
// panel passes it; the operation/scheduler forms omit it and so still
// require debit or credit.
defineProps<{ idPrefix: string; legend?: string; anyLabel?: string }>();
const type = defineModel<EntryType | undefined>({ required: true });
</script>

<template>
  <fieldset class="mb-3">
    <legend :class="legend ? 'form-label' : 'visually-hidden'">
      {{ legend ?? $t('operations.search.type') }}
    </legend>
    <div v-if="anyLabel" class="form-check form-check-inline">
      <input
        :id="`${idPrefix}-any`"
        v-model="type"
        v-autofocus="type === undefined"
        :name="idPrefix"
        class="form-check-input"
        type="radio"
        :value="undefined"
      />
      <label class="form-check-label" :for="`${idPrefix}-any`">{{ anyLabel }}</label>
    </div>
    <div class="form-check form-check-inline">
      <input
        :id="`${idPrefix}-debit`"
        v-model="type"
        v-autofocus="type === 'debit'"
        :name="idPrefix"
        class="form-check-input"
        type="radio"
        value="debit"
      />
      <label class="form-check-label" :for="`${idPrefix}-debit`">{{
        $t('operations.debit')
      }}</label>
    </div>
    <div class="form-check form-check-inline">
      <input
        :id="`${idPrefix}-credit`"
        v-model="type"
        v-autofocus="type === 'credit'"
        :name="idPrefix"
        class="form-check-input"
        type="radio"
        value="credit"
      />
      <label class="form-check-label" :for="`${idPrefix}-credit`">{{
        $t('operations.credit')
      }}</label>
    </div>
  </fieldset>
</template>
