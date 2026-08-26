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

  const { response } = await apiClient.POST("/operations/batch/delete", {
    body: { ids: props.selectedIds },
  });
  if (!response.ok) {
    toast(t("operations.genericError"), "error");
    return;
  }
  toast(t("operations.batch.deleted"), "success");
  emit("done");
}

async function batchReconcile() {
  if (props.selectedIds.length === 0) return;
  if (!(await confirm()))
    return;

  const { response } = await apiClient.POST("/operations/batch/reconcile", {
    body: { ids: props.selectedIds },
  });
  if (!response.ok) {
    toast(t("operations.genericError"), "error");
    return;
  }
  toast(t("operations.batch.reconciled"), "success");
  emit("done");
}
</script>

<template>
  <div v-if="selectedIds.length > 0" class="d-flex gap-2 mb-3" data-testid="batch-actions">
    <button
      type="button"
      class="btn btn-sm btn-outline-danger"
      data-testid="batch-delete"
      @click="batchDelete"
    >
      {{ $t("operations.batch.delete") }}
    </button>
    <button
      type="button"
      class="btn btn-sm btn-outline-secondary"
      data-testid="batch-reconcile"
      @click="batchReconcile"
    >
      {{ $t("operations.batch.reconcile") }}
    </button>
  </div>
</template>
