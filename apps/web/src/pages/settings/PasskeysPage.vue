<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { apiClient } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import { completeStepUp } from '../../api/stepUp';
import { useToast } from '../../composables/useToast';
import { useConfirm } from '../../composables/useConfirm';
import ToastContainer from '../../components/ToastContainer.vue';
import IconButton from '../../components/IconButton.vue';
import PlusIcon from '../../components/PlusIcon.vue';
import SettingsTabs from './SettingsTabs.vue';

// Swagger can't introspect @simplewebauthn/server's WebAuthn-spec types
// (they carry no Nest/class-validator decorators of their own), so the
// generated client types these bodies as an opaque `Record<string, never>`
// — cast at the boundary rather than widening the real API contract.
interface PasskeySummary {
  id: string;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

const { push: toast } = useToast();
const { confirm } = useConfirm();
const { t } = useI18n();
const queryClient = useQueryClient();

const credentialsQuery = useQuery({
  queryKey: ['webauthn-credentials'],
  queryFn: async () => {
    const { data } = await apiClient.GET('/webauthn/credentials');
    return (data as unknown as PasskeySummary[] | undefined) ?? [];
  },
});
const credentials = computed(() => credentialsQuery.data.value ?? []);

async function reload() {
  await queryClient.invalidateQueries({ queryKey: ['webauthn-credentials'] });
}

const deviceName = ref('');
const adding = ref(false);

async function addPasskey() {
  adding.value = true;
  try {
    // The API only starts a registration after a fresh step-up with a
    // passkey the member already holds (a session alone could be a stolen
    // one) — see WebauthnRegistrationService.
    if (!(await completeStepUp())) {
      toast(t('settings.passkeys.stepUpFailed'), 'error');
      return;
    }

    const { data, response } = await apiClient.POST('/webauthn/registration/options');
    if (!response.ok || !data) {
      toast(t('settings.passkeys.genericError'), 'error');
      return;
    }

    let attestation;
    try {
      attestation = await startRegistration({
        optionsJSON: data as unknown as PublicKeyCredentialCreationOptionsJSON,
      });
    } catch {
      // The platform prompt was cancelled/dismissed, or this browser/device
      // doesn't support it — not a server error, just abandon the attempt.
      return;
    }

    const verifyRes = await apiClient.POST('/webauthn/registration/verify', {
      body: {
        response: attestation as unknown as Record<string, never>,
        deviceName: deviceName.value.trim() || undefined,
      },
    });
    if (!verifyRes.response.ok) {
      toast(t('settings.passkeys.genericError'), 'error');
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
  // Removal is step-up gated like registration: a stolen session that
  // could delete passkeys could lock the real owner out for good.
  if (!(await completeStepUp())) {
    toast(t('settings.passkeys.stepUpFailed'), 'error');
    return;
  }
  const { error, response } = await apiClient.DELETE('/webauthn/credentials/{id}', {
    params: { path: { id } },
  });
  if (!response.ok) {
    // Branches on the status code, not the server's English text (same
    // rule ProfilePage.vue/PasskeysPage's own registration flow follow) —
    // a 400 here specifically means "that's your last passkey", distinct
    // from every other failure mode, which stays the generic toast.
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
    <ToastContainer />

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
          <PlusIcon />
          {{ $t('settings.passkeys.add') }}
        </button>
      </div>

      <div v-if="credentials.length > 0" class="table-responsive">
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
              <td>{{ new Date(credential.createdAt).toLocaleDateString() }}</td>
              <td>
                {{
                  credential.lastUsedAt
                    ? new Date(credential.lastUsedAt).toLocaleDateString()
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
      <p v-else class="text-muted">{{ $t('settings.passkeys.empty') }}</p>
    </div>
  </div>
</template>
