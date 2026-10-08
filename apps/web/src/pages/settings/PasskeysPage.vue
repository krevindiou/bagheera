<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiClient } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import { queryKeys } from '../../api/queryKeys';
import { unwrap } from '../../api/unwrap';
import { completeStepUp } from '../../api/stepUp';
import { runRegistration } from '../../api/webauthn';
import { useToast } from '../../composables/useToast';
import { useConfirm } from '../../composables/useConfirm';
import IconButton from '../../components/IconButton.vue';
import ListState from '../../components/ListState.vue';
import AppIcon from '../../components/AppIcon.vue';
import { formatTimestampDate } from '../../domain/money';
import SettingsTabs from './SettingsTabs.vue';

const { push: toast } = useToast();
const { confirm } = useConfirm();
const { t } = useI18n();
const queryClient = useQueryClient();

const credentialsQuery = useQuery({
  queryKey: queryKeys.webauthnCredentials,
  queryFn: async () => unwrap(await apiClient.GET('/webauthn/credentials')),
});
const credentials = computed(() => credentialsQuery.data.value ?? []);
const credentialsError = computed(() => credentialsQuery.isError.value);

async function reload() {
  await queryClient.invalidateQueries({ queryKey: queryKeys.webauthnCredentials });
}

const deviceName = ref('');
const adding = ref(false);

async function addPasskey() {
  adding.value = true;
  try {
    // The API requires a fresh step-up first.
    if (!(await completeStepUp())) {
      toast(t('settings.passkeys.stepUpFailed'), 'error');
      return;
    }

    const result = await runRegistration('/webauthn/registration', {
      verifyBody: { deviceName: deviceName.value.trim() || undefined },
    });
    if (!result.ok) {
      // A cancelled prompt isn't an error.
      if (result.reason !== 'cancelled') toast(t('settings.passkeys.genericError'), 'error');
      return;
    }

    deviceName.value = '';
    toast(t('settings.passkeys.added'), 'success');
    await reload();
  } finally {
    adding.value = false;
  }
}

async function removePasskey(id: string) {
  if (!(await confirm())) return;
  // The API refuses this anyway (the 400 below) — checked here too only so
  // the member isn't asked for a step-up that can't lead anywhere.
  if (credentials.value.length <= 1) {
    toast(t('settings.passkeys.lastPasskeyError'), 'error');
    return;
  }
  // Step-up gated, like registration.
  if (!(await completeStepUp())) {
    toast(t('settings.passkeys.stepUpFailed'), 'error');
    return;
  }
  const { error, response } = await apiClient.DELETE('/webauthn/credentials/{id}', {
    params: { path: { id } },
  });
  if (!response.ok) {
    // A 400 here means "last passkey" (branch on status, not English text).
    if (response.status === 400) {
      toast(t('settings.passkeys.lastPasskeyError'), 'error');
      return;
    }
    toast(errorMessage(error) ?? t('settings.passkeys.genericError'), 'error');
    return;
  }
  toast(t('settings.passkeys.removed'), 'success');
  await reload();
}
</script>

<template>
  <div>
    <SettingsTabs />
    <p class="text-muted" style="max-width: 460px">{{ $t('settings.passkeys.intro') }}</p>
    <p class="text-muted" style="max-width: 460px; font-size: 13.5px">
      {{ $t('settings.passkeys.stepUpHint') }}
    </p>

    <div style="max-width: 460px">
      <div class="d-flex gap-2 align-items-end mb-3">
        <div class="flex-grow-1">
          <label class="form-label" for="passkey-device-name">
            {{ $t('settings.passkeys.deviceNameLabel') }}
          </label>
          <input
            id="passkey-device-name"
            v-model="deviceName"
            type="text"
            class="form-control"
            :placeholder="$t('settings.passkeys.deviceNamePlaceholder')"
          />
        </div>
        <button
          type="button"
          class="btn btn-primary d-inline-flex align-items-center gap-1"
          :disabled="adding"
          @click="addPasskey"
        >
          <AppIcon name="plus" :size="16" />
          {{ $t('settings.passkeys.add') }}
        </button>
      </div>

      <ListState
        :error="credentialsError"
        :empty="credentials.length === 0"
        :empty-text="$t('settings.passkeys.empty')"
        error-testid="passkeys-error"
      >
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead>
              <tr>
                <th>{{ $t('settings.passkeys.device') }}</th>
                <th>{{ $t('settings.passkeys.createdAt') }}</th>
                <th>{{ $t('settings.passkeys.lastUsedAt') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="credential in credentials" :key="credential.id">
                <td>{{ credential.deviceName || $t('settings.passkeys.unnamed') }}</td>
                <td>{{ formatTimestampDate(credential.createdAt) }}</td>
                <td>
                  {{
                    credential.lastUsedAt
                      ? formatTimestampDate(credential.lastUsedAt)
                      : $t('settings.passkeys.neverUsed')
                  }}
                </td>
                <td class="text-end">
                  <IconButton
                    icon="trash"
                    danger
                    :label="$t('settings.passkeys.remove')"
                    @click="removePasskey(credential.id)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ListState>
    </div>
  </div>
</template>
