<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiClient } from '../../api/client';
import FormField from '../../components/FormField.vue';
import { useToast } from '../../composables/useToast';
import { useSessionStore } from '../../stores/session.store';

// The zone the member's "today" follows — a new operation's default date,
// the dashboard's previous month, when scheduled operations fall due. A
// preference like the language, so saved without a passkey confirmation.
const session = useSessionStore();
const { push: toast } = useToast();
const { t } = useI18n();

const timeZone = ref(session.member?.timeZone ?? 'UTC');
const isSubmitting = ref(false);

// Every zone this browser knows, plus the stored one in case it isn't
// among them.
const options = [...new Set([...Intl.supportedValuesOf('timeZone'), timeZone.value])].sort();

async function onSubmit(): Promise<void> {
  isSubmitting.value = true;
  try {
    const { response } = await apiClient.POST('/members/time-zone', {
      body: { timeZone: timeZone.value },
    });
    if (!response.ok) {
      toast(t('settings.timeZone.genericError'), 'error');
      return;
    }
    session.setTimeZone(timeZone.value);
    toast(t('settings.timeZone.success'), 'success');
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <form novalidate class="mt-5" style="max-width: 380px" @submit.prevent="onSubmit">
    <FormField
      :label="$t('settings.timeZone.label')"
      for="profile-time-zone"
      :hint="$t('settings.timeZone.hint')"
    >
      <select id="profile-time-zone" v-model="timeZone" class="form-select">
        <option v-for="zone in options" :key="zone" :value="zone">{{ zone }}</option>
      </select>
    </FormField>

    <button type="submit" class="btn btn-primary w-100" :disabled="isSubmitting">
      {{ $t('settings.timeZone.submit') }}
    </button>
  </form>
</template>
