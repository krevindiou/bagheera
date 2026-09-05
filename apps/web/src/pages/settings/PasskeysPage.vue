<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { apiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import { useConfirm } from "../../composables/useConfirm";
import ToastContainer from "../../components/ToastContainer.vue";

// Swagger can't introspect @simplewebauthn/server's WebAuthn-spec types
// (they carry no Nest/class-validator decorators of their own), so the
// generated client types these bodies as an opaque `Record<string, never>`
// — cast at the boundary rather than widening the real API contract.
interface PasskeySummary {
  id: number;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

const { push: toast } = useToast();
const { confirm } = useConfirm();
const { t } = useI18n();
const queryClient = useQueryClient();

const credentialsQuery = useQuery({
  queryKey: ["webauthn-credentials"],
  queryFn: async () => {
    const { data } = await apiClient.GET("/webauthn/credentials");
    return (data as unknown as PasskeySummary[] | undefined) ?? [];
  },
});
const credentials = computed(() => credentialsQuery.data.value ?? []);

async function reload() {
  await queryClient.invalidateQueries({ queryKey: ["webauthn-credentials"] });
}

const deviceName = ref("");
const adding = ref(false);

async function addPasskey() {
  adding.value = true;
  try {
    const { data, response } = await apiClient.POST("/webauthn/registration/options");
    if (!response.ok || !data) {
      toast(t("settings.passkeys.genericError"), "error");
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

    const verifyRes = await apiClient.POST("/webauthn/registration/verify", {
      body: {
        response: attestation as unknown as Record<string, never>,
        deviceName: deviceName.value.trim() || undefined,
      },
    });
    if (!verifyRes.response.ok) {
      toast(t("settings.passkeys.genericError"), "error");
      return;
    }

    deviceName.value = "";
    toast(t("settings.passkeys.added"), "success");
    await reload();
  } finally {
    adding.value = false;
  }
}

async function removePasskey(id: number) {
  if (!(await confirm())) return;
  const { response } = await apiClient.DELETE("/webauthn/credentials/{id}", {
    params: { path: { id } },
  });
  if (!response.ok) {
    toast(t("settings.passkeys.genericError"), "error");
    return;
  }
  toast(t("settings.passkeys.removed"), "success");
  await reload();
}
</script>

<template>
  <div class="container py-5" style="max-width: 640px">
    <h1>{{ $t("settings.passkeys.title") }}</h1>
    <p class="text-muted">{{ $t("settings.passkeys.intro") }}</p>
    <ToastContainer />

    <table v-if="credentials.length > 0" class="table align-middle">
      <thead>
        <tr>
          <th>{{ $t("settings.passkeys.device") }}</th>
          <th>{{ $t("settings.passkeys.createdAt") }}</th>
          <th>{{ $t("settings.passkeys.lastUsedAt") }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="credential in credentials" :key="credential.id">
          <td>{{ credential.deviceName || $t("settings.passkeys.unnamed") }}</td>
          <td>{{ new Date(credential.createdAt).toLocaleDateString() }}</td>
          <td>
            {{
              credential.lastUsedAt
                ? new Date(credential.lastUsedAt).toLocaleDateString()
                : $t("settings.passkeys.neverUsed")
            }}
          </td>
          <td class="text-end">
            <button
              type="button"
              class="btn btn-sm btn-outline-danger"
              @click="removePasskey(credential.id)"
            >
              {{ $t("settings.passkeys.remove") }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="text-muted">{{ $t("settings.passkeys.empty") }}</p>

    <div class="d-flex gap-2 align-items-end">
      <div class="flex-grow-1">
        <label class="form-label" for="passkey-device-name">
          {{ $t("settings.passkeys.deviceNameLabel") }}
        </label>
        <input
          id="passkey-device-name"
          v-model="deviceName"
          type="text"
          class="form-control"
          :placeholder="$t('settings.passkeys.deviceNamePlaceholder')"
        />
      </div>
      <button type="button" class="btn btn-primary" :disabled="adding" @click="addPasskey">
        {{ $t("settings.passkeys.add") }}
      </button>
    </div>
  </div>
</template>
