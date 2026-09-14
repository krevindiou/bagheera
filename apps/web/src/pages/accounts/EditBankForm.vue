<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { useI18n } from 'vue-i18n';
import { apiClient } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import { useEscapeKey } from '../../composables/useEscapeKey';
import { useToast } from '../../composables/useToast';
import { editBankSchema, type EditBankForm } from './accounts.schemas';
import type { Bank } from './accounts.types';

const props = defineProps<{ bank: Bank }>();
const emit = defineEmits<{ saved: []; cancel: [] }>();

const { push: toast } = useToast();
const { t } = useI18n();

useEscapeKey(() => emit('cancel'));

const { defineField, handleSubmit, errors, isSubmitting } = useForm<EditBankForm>({
  validationSchema: toTypedSchema(editBankSchema),
  initialValues: { name: props.bank.name },
});
const [name, nameAttrs] = defineField('name');

const onSubmit = handleSubmit(async (values) => {
  const { error, response } = await apiClient.PATCH('/banks/{id}', {
    params: { path: { id: props.bank.id } },
    body: values,
  });
  if (!response.ok) {
    toast(errorMessage(error) ?? t('accounts.genericError'), 'error');
    return;
  }
  toast(t('accounts.bankSaved'), 'success');
  emit('saved');
});
</script>

<template>
  <div class="drawer-backdrop" @click="emit('cancel')">
    <form novalidate class="drawer" @click.stop @submit="onSubmit">
      <div class="drawer-header">
        <h2 class="mb-0" style="font-size: 20px">{{ $t('accounts.editBankTitle') }}</h2>
        <button
          type="button"
          class="drawer-close"
          :aria-label="$t('common.cancel')"
          @click="emit('cancel')"
        >
          ×
        </button>
      </div>

      <div class="mb-3">
        <label class="form-label" for="bank-name">{{ $t('accounts.bankNameLabel') }}</label>
        <input
          id="bank-name"
          v-model="name"
          v-bind="nameAttrs"
          v-autofocus
          type="text"
          class="form-control"
          :class="{ 'is-invalid': errors.name }"
        />
        <div v-if="errors.name" class="invalid-feedback">
          {{ $t('auth.validation.required') }}
        </div>
      </div>

      <div class="d-flex gap-2">
        <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
          {{ $t('accounts.submit') }}
        </button>
        <button type="button" class="btn btn-outline-secondary" @click="emit('cancel')">
          {{ $t('common.cancel') }}
        </button>
      </div>
    </form>
  </div>
</template>
