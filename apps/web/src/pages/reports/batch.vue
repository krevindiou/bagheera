<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { apiClient } from "../../api/client";
import { useConfirm } from "../../composables/useConfirm";
import { useToast } from "../../composables/useToast";

const props = defineProps<{ selectedIds: number[] }>();
const emit = defineEmits<{ done: [] }>();

const { confirm } = useConfirm();
const { push: toast } = useToast();
const { t } = useI18n();

async function batchDelete() {
  if (props.selectedIds.length === 0) return;
  if (!(await confirm()))
    return;

  const { response } = await apiClient.POST("/reports/batch/delete", {
    body: { ids: props.selectedIds },
  });
  if (!response.ok) {
    toast(t("reports.genericError"), "error");
    return;
  }
  toast(t("reports.batch.deleted"), "success");
  emit("done");
}
</script>

<template>
  <div class="d-flex gap-2 mb-3" data-testid="report-batch-actions">
    <button
      type="button"
      class="btn btn-sm btn-outline-danger"
      data-testid="report-batch-delete"
      :disabled="selectedIds.length === 0"
      @click="batchDelete"
    >
      {{ $t("reports.batch.delete") }}
    </button>
  </div>
</template>
