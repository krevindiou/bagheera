<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiClient } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import { queryKeys } from '../../api/queryKeys';
import { unwrap } from '../../api/unwrap';
import { completeStepUp } from '../../api/stepUp';
import { useToast } from '../../composables/useToast';
import { useConfirm } from '../../composables/useConfirm';
import IconButton from '../../components/IconButton.vue';
import ListState from '../../components/ListState.vue';
import AppIcon from '../../components/AppIcon.vue';
import { formatTimestampDateTime } from '../../domain/money';
import SettingsTabs from './SettingsTabs.vue';

const { push: toast } = useToast();
const { confirm } = useConfirm();
const { t } = useI18n();
const queryClient = useQueryClient();

const sessionsQuery = useQuery({
  queryKey: queryKeys.sessions,
  queryFn: async () => unwrap(await apiClient.GET('/auth/sessions')),
});
const sessions = computed(() => sessionsQuery.data.value ?? []);
type Session = (typeof sessions.value)[number];
const sessionsError = computed(() => sessionsQuery.isError.value);
const sessionsPending = computed(() => sessionsQuery.isPending.value);
const hasOtherSessions = computed(() => sessions.value.some((session) => !session.current));

async function reload() {
  await queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
}

function describe(session: Session): string {
  return t('settings.sessions.deviceDescription', {
    browser: session.browser ?? t('settings.sessions.unknownBrowser'),
    os: session.os ?? t('settings.sessions.unknownOs'),
  });
}

// Both revocations are step-up gated by the API; the confirm comes first so
// a passkey prompt never shows up for an action the member then cancels.
async function confirmAndStepUp(body: string, confirmLabel: string): Promise<boolean> {
  if (!(await confirm({ body, confirmLabel, danger: true }))) return false;
  if (!(await completeStepUp())) {
    toast(t('settings.sessions.stepUpFailed'), 'error');
    return false;
  }
  return true;
}

async function signOut(session: Session) {
  const proceed = await confirmAndStepUp(
    t('settings.sessions.confirmSignOut', { name: describe(session) }),
    t('settings.sessions.signOut'),
  );
  if (!proceed) return;
  const { error, response } = await apiClient.DELETE('/auth/sessions/{id}', {
    params: { path: { id: session.id } },
  });
  // A 404 means it ended meanwhile: the reload drops it either way.
  if (!response.ok && response.status !== 404) {
    toast(errorMessage(error) ?? t('settings.sessions.genericError'), 'error');
    return;
  }
  toast(t('settings.sessions.signedOut'), 'success');
  await reload();
}

async function signOutOthers() {
  const proceed = await confirmAndStepUp(
    t('settings.sessions.confirmSignOutOthers'),
    t('settings.sessions.signOutOthers'),
  );
  if (!proceed) return;
  const { error, response } = await apiClient.DELETE('/auth/sessions');
  if (!response.ok) {
    toast(errorMessage(error) ?? t('settings.sessions.genericError'), 'error');
    return;
  }
  toast(t('settings.sessions.signedOutOthers'), 'success');
  await reload();
}
</script>

<template>
  <div>
    <SettingsTabs />
    <p class="text-muted" style="max-width: 560px">{{ $t('settings.sessions.intro') }}</p>
    <p class="text-muted" style="max-width: 560px; font-size: 13.5px">
      {{ $t('settings.sessions.stepUpHint') }}
    </p>

    <div style="max-width: 760px">
      <ListState
        :error="sessionsError"
        :loading="sessionsPending"
        :empty="sessions.length === 0"
        :empty-text="$t('settings.sessions.noOtherSession')"
        error-testid="sessions-error"
      >
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead>
              <tr>
                <th>{{ $t('settings.sessions.device') }}</th>
                <th>{{ $t('settings.sessions.ipAddress') }}</th>
                <th>{{ $t('settings.sessions.signedInAt') }}</th>
                <th>{{ $t('settings.sessions.lastActiveAt') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="session in sessions"
                :key="session.id"
                :data-testid="`session-${session.id}`"
              >
                <td>
                  {{ describe(session) }}
                  <span v-if="session.current" class="badge text-bg-secondary ms-1">
                    {{ $t('settings.sessions.thisDevice') }}
                  </span>
                </td>
                <td>{{ session.ipAddress ?? $t('settings.sessions.unknownAddress') }}</td>
                <td>{{ formatTimestampDateTime(session.signedInAt) }}</td>
                <td>
                  {{
                    session.current
                      ? $t('settings.sessions.activeNow')
                      : formatTimestampDateTime(session.lastActiveAt)
                  }}
                </td>
                <td class="text-end">
                  <IconButton
                    v-if="!session.current"
                    icon="logout"
                    danger
                    :label="$t('settings.sessions.signOut')"
                    :aria-label="
                      $t('common.actionOn', {
                        action: $t('settings.sessions.signOut'),
                        name: describe(session),
                      })
                    "
                    @click="signOut(session)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!hasOtherSessions" class="text-muted mt-2" style="font-size: 13.5px">
          {{ $t('settings.sessions.noOtherSession') }}
        </p>
        <button
          v-else
          type="button"
          class="btn btn-outline-danger d-inline-flex align-items-center gap-1 mt-3"
          data-testid="sign-out-others"
          @click="signOutOthers"
        >
          <AppIcon name="logout" :size="16" />
          {{ $t('settings.sessions.signOutOthers') }}
        </button>
      </ListState>
    </div>
  </div>
</template>
