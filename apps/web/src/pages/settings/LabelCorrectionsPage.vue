<script setup lang="ts">
import { computed, watch } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { unwrap } from '../../api/unwrap';
import BatchBar, { type BatchAction } from '../../components/BatchBar.vue';
import ListState from '../../components/ListState.vue';
import { useSelection } from '../../composables/useSelection';
import SettingsTabs from './SettingsTabs.vue';

const queryClient = useQueryClient();
const { selectedIds, selectedIdList, toggleSelected, toggleAll, allSelectState } = useSelection();

const correctionsQuery = useQuery({
  queryKey: queryKeys.labelCorrections,
  queryFn: async () => unwrap(await apiClient.GET('/label-corrections')),
});
const items = computed(() => correctionsQuery.data.value?.items ?? []);
const limit = computed(() => correctionsQuery.data.value?.limit ?? 0);
const isError = computed(() => correctionsQuery.isError.value);
const isPending = computed(() => correctionsQuery.isPending.value);
watch(
  () => correctionsQuery.data.value,
  () => {
    selectedIds.value = new Set();
  },
);

const selectableIds = computed(() => items.value.map((item) => item.id));
const headerSelectState = computed(() => allSelectState(selectableIds.value));

const actions: BatchAction[] = [
  {
    labelKey: 'settings.labelCorrections.delete',
    successKey: 'settings.labelCorrections.deleted',
    errorKey: 'settings.labelCorrections.genericError',
    confirmKey: 'settings.labelCorrections.confirmDelete',
    confirmLabelKey: 'common.delete',
    testid: 'label-correction-delete',
    danger: true,
    async run(ids) {
      const { data, response } = await apiClient.POST('/label-corrections/delete', {
        body: { ids },
      });
      if (!response.ok) return null;
      return data?.deletedCount ?? 0;
    },
  },
];

async function reload() {
  await queryClient.invalidateQueries({ queryKey: queryKeys.labelCorrections });
}
</script>

<template>
  <div>
    <SettingsTabs />
    <p class="text-muted">{{ $t('settings.labelCorrections.intro') }}</p>

    <BatchBar
      :selected-ids="selectedIdList"
      :actions="actions"
      data-testid="label-correction-batch-actions"
      @done="reload"
    />

    <ListState
      :error="isError"
      :loading="isPending"
      :empty="items.length === 0"
      :empty-text="$t('settings.labelCorrections.empty')"
      error-testid="label-corrections-error"
    >
      <p class="text-muted small" data-testid="label-corrections-count">
        {{ $t('settings.labelCorrections.count', { count: items.length, limit }) }}
      </p>
      <div class="table-responsive">
        <table class="table" data-testid="label-corrections-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  :aria-label="$t('common.selectAllOnPage')"
                  :checked="headerSelectState.checked"
                  :indeterminate="headerSelectState.indeterminate"
                  :disabled="selectableIds.length === 0"
                  @change="toggleAll(selectableIds)"
                />
              </th>
              <th>{{ $t('settings.labelCorrections.sourceLabel') }}</th>
              <th>{{ $t('settings.labelCorrections.thirdParty') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in items"
              :key="item.id"
              data-testid="label-correction-row"
              :class="{ 'table-active': selectedIds.has(item.id) }"
            >
              <td>
                <input
                  type="checkbox"
                  :aria-label="$t('common.selectRow', { name: item.sourceLabel })"
                  :checked="selectedIds.has(item.id)"
                  @change="toggleSelected(item.id)"
                />
              </td>
              <td class="text-break">{{ item.sourceLabel }}</td>
              <td class="text-break">{{ item.thirdParty }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ListState>
  </div>
</template>
