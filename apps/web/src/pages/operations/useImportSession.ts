import { IMPORT_LIMITS } from '@bagheera/reference-data';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { apiClient } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import { invalidateAccountData, queryKeys } from '../../api/queryKeys';
import { useToast } from '../../composables/useToast';
import type { Preview, Upload } from './import.types';
import { importDoneMessage } from './importDoneMessage';
import { canReconcileRecorded } from './importRows';
import type { ImportChoices } from './useImportChoices';

/**
 * The course of one import on the server: the file uploaded, its preview as
 * the Member's choices change it, the confirmation, and the release of what the
 * server holds. What the Member decides about the file as a whole (the skipped
 * rows to import anyway, what to reconcile) is kept here too, since the
 * confirmation sends it.
 */
export function useImportSession(accountId: Readonly<Ref<string>>, choices: ImportChoices) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();

  const upload = ref<Upload | null>(null);
  // The import the server still holds for this page, released when the Member
  // replaces it, cancels or leaves.
  let heldImportId: string | null = null;
  const preview = ref<Preview | null>(null);
  const included = ref<Set<number>>(new Set());
  const uploading = ref(false);
  const previewing = ref(false);
  const confirming = ref(false);
  const fileName = ref<string | null>(null);
  // Whether the operations imported, and the recorded operations that skipped
  // rows match, are marked reconciled; and the rows where the Member overrides
  // that for the recorded operation.
  const reconcileImported = ref(true);
  // Whether the Member accepts a file that seems to come from another account.
  const acceptMismatch = ref(false);
  const recordedOverrides = ref<Map<number, boolean>>(new Map());
  // What the live region says after the file is read or the preview changes.
  const announcement = ref('');
  // Changes when a new file or a new preview starts the view over.
  const viewReset = ref(0);

  // Picking or leaving a transfer method can move a row between the rows to
  // import and the skipped ones: show where it now stands.
  watch(choices.placeChanges, () => {
    if (preview.value) void runPreview(true);
  });

  function fail(error: unknown) {
    toast.push(errorMessage(error) ?? t('operations.genericError'), 'error');
  }

  // 404 import_not_found: the held file expired or was replaced.
  function handleFailure(error: unknown, response: Response) {
    if (
      response.status === 404 &&
      (error as { code?: string } | undefined)?.code === 'import_not_found'
    ) {
      upload.value = null;
      preview.value = null;
      heldImportId = null;
    }
    fail(error);
    // The operations behind the preview changed: nothing was imported, so show
    // the preview as it now stands.
    if (
      response.status === 409 &&
      (error as { code?: string } | undefined)?.code === 'import_preview_stale'
    ) {
      void runPreview(true);
    }
  }

  // Best effort: a hold the server is not told about expires by itself.
  function release() {
    const importId = heldImportId;
    if (importId === null) return;
    heldImportId = null;
    apiClient
      .DELETE('/operations/import/{importId}', { params: { path: { importId } } })
      .catch(() => undefined);
  }

  onBeforeUnmount(release);

  async function uploadFile(file: File) {
    if (uploading.value) return;
    if (file.size > IMPORT_LIMITS.MAX_FILE_BYTES) {
      toast.push(t('errors.import_file_too_large'), 'error');
      return;
    }

    uploading.value = true;
    try {
      const { data, error, response } = await apiClient.POST('/operations/import', {
        body: { accountId: accountId.value, file: file as unknown as string },
        bodySerializer: (body) => {
          const formData = new FormData();
          formData.append('accountId', body.accountId);
          formData.append('file', body.file as unknown as Blob, file.name);
          return formData;
        },
      });
      if (!response.ok || !data) {
        fail(error);
        return;
      }
      release();
      heldImportId = data.importId;
      upload.value = data;
      fileName.value = file.name;
      preview.value = null;
      included.value = new Set();
      recordedOverrides.value = new Map();
      choices.reset();
      acceptMismatch.value = false;
      viewReset.value++;
      announcement.value = t(
        'operations.import.preview.announceRead',
        { count: data.rowCount },
        data.rowCount,
      );
    } finally {
      uploading.value = false;
    }
    await runPreview();
  }

  let previewRun = 0;

  // `keepView` re-runs the preview after label changes without leaving the
  // page the Member is on or forgetting the skipped rows they included.
  async function runPreview(keepView = false) {
    if (!upload.value) return;
    const key = choices.labelChangesKey.value;
    // A newer request wins: an older answer arriving later is dropped.
    const run = ++previewRun;
    previewing.value = true;
    try {
      const { data, error, response } = await apiClient.POST(
        '/operations/import/{importId}/preview',
        {
          params: { path: { importId: upload.value.importId } },
          body: {
            labelChanges: choices.labelChanges.value,
            paymentMethodChanges: choices.paymentMethodChanges.value,
            categoryChanges: choices.categoryChanges.value,
            transferAccountChanges: choices.transferAccountChanges.value,
          },
        },
      );
      if (run !== previewRun) return;
      if (!response.ok || !data) {
        handleFailure(error, response);
        return;
      }
      preview.value = data;
      choices.markLabelsApplied(key);
      announcement.value = t('operations.import.preview.announceUpdated', {
        imported: data.importCount,
        skipped: data.skippedCount,
        invalid: data.invalidCount,
      });
      if (keepView) {
        const stillSkipped = new Set(
          data.rows.filter((row) => row.status === 'skipped').map((row) => row.line),
        );
        included.value = new Set([...included.value].filter((line) => stillSkipped.has(line)));
        const reconcilable = new Set(data.rows.filter(canReconcileRecorded).map((row) => row.line));
        recordedOverrides.value = new Map(
          [...recordedOverrides.value].filter(([line]) => reconcilable.has(line)),
        );
      } else {
        included.value = new Set();
        recordedOverrides.value = new Map();
        viewReset.value++;
      }
    } finally {
      if (run === previewRun) previewing.value = false;
    }
  }

  const accountMismatch = computed(
    () =>
      preview.value?.statement.accountCheck === 'different' ||
      preview.value?.statement.accountCheck === 'elsewhere',
  );

  const toImportCount = computed(() => (preview.value?.importCount ?? 0) + included.value.size);

  const reconcilableLines = computed(() =>
    (preview.value?.rows ?? [])
      .filter((row) => canReconcileRecorded(row) && !included.value.has(row.line))
      .map((row) => row.line),
  );

  function reconcilesRecorded(line: number): boolean {
    return recordedOverrides.value.get(line) ?? reconcileImported.value;
  }

  // The lines whose recorded operation the confirmation reconciles.
  const reconcileLines = computed(() => reconcilableLines.value.filter(reconcilesRecorded));
  const reconcileCount = computed(() => reconcileLines.value.length);

  function toggleReconcileRecorded(line: number) {
    recordedOverrides.value = new Map(recordedOverrides.value).set(line, !reconcilesRecorded(line));
  }

  // A new choice for the whole file replaces the choices made row by row.
  function chooseReconcile() {
    recordedOverrides.value = new Map();
  }

  function toggleIncluded(line: number) {
    const next = new Set(included.value);
    if (!next.delete(line)) next.add(line);
    included.value = next;
  }

  async function confirmImport() {
    if (
      !upload.value ||
      !preview.value ||
      (toImportCount.value === 0 && reconcileCount.value === 0) ||
      choices.labelChangesPending.value ||
      previewing.value ||
      confirming.value ||
      (accountMismatch.value && !acceptMismatch.value)
    ) {
      return;
    }
    confirming.value = true;
    try {
      const { data, error, response } = await apiClient.POST(
        '/operations/import/{importId}/confirm',
        {
          params: { path: { importId: upload.value.importId } },
          body: {
            revision: preview.value.revision,
            includedLines: [...included.value],
            reconcile: reconcileImported.value,
            acceptAccountMismatch: accountMismatch.value && acceptMismatch.value,
            reconcileLines: reconcileLines.value,
            labelChanges: choices.labelChanges.value,
            paymentMethodChanges: choices.paymentMethodChanges.value,
            categoryChanges: choices.categoryChanges.value,
            transferAccountChanges: choices.transferAccountChanges.value,
          },
        },
      );
      if (!response.ok || !data) {
        handleFailure(error, response);
        return;
      }
      // The confirmation released it on the server.
      heldImportId = null;
      toast.push(importDoneMessage(t, data), 'success');
      // The other account of each transfer imported gets its mirror, whether the
      // Member picked it or it was suggested.
      const touched = new Set([
        accountId.value,
        ...(preview.value?.rows ?? []).flatMap((row) => {
          const other = choices.transferAccountOf(row);
          return other !== null && (row.status === 'import' || included.value.has(row.line))
            ? [other]
            : [];
        }),
      ]);
      await Promise.all([
        ...[...touched].map((id) => invalidateAccountData(queryClient, id)),
        data.rememberedCount > 0
          ? queryClient.invalidateQueries({ queryKey: queryKeys.labelCorrections })
          : undefined,
      ]);
      await router.push({ name: 'operations', params: { accountId: accountId.value } });
    } finally {
      confirming.value = false;
    }
  }

  async function cancel() {
    release();
    await router.push({ name: 'operations', params: { accountId: accountId.value } });
  }

  return {
    upload,
    preview,
    included,
    uploading,
    previewing,
    confirming,
    fileName,
    reconcileImported,
    acceptMismatch,
    announcement,
    viewReset,
    accountMismatch,
    toImportCount,
    reconcileCount,
    reconcilesRecorded,
    uploadFile,
    runPreview,
    confirmImport,
    cancel,
    toggleIncluded,
    toggleReconcileRecorded,
    chooseReconcile,
  };
}
