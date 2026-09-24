<script setup lang="ts">
// The debit/credit radio pair of the operation, scheduler and search forms.
// `idPrefix` makes the input ids `<prefix>-debit` / `<prefix>-credit`; the
// debit radio takes focus when the form opens. An optional `legend` heads
// the pair (the search panel labels it).
defineProps<{ idPrefix: string; legend?: string }>();
const type = defineModel<'debit' | 'credit'>({ required: true });
</script>

<template>
  <div class="mb-3">
    <div v-if="legend" class="form-label">{{ legend }}</div>
    <div class="form-check form-check-inline">
      <input
        :id="`${idPrefix}-debit`"
        v-model="type"
        v-autofocus
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
        class="form-check-input"
        type="radio"
        value="credit"
      />
      <label class="form-check-label" :for="`${idPrefix}-credit`">{{
        $t('operations.credit')
      }}</label>
    </div>
  </div>
</template>
