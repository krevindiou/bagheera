import { reactive } from "vue";

interface ConfirmState {
  visible: boolean;
  resolve: ((result: boolean) => void) | null;
}

// Single shared instance: one confirmation dialog on screen at a time,
// driven from anywhere via confirm() and rendered by ConfirmModal.vue.
// The dialog is generic ("Confirmation" / "Do you confirm?"), not
// per-action text, so no message is tracked here.
const state = reactive<ConfirmState>({
  visible: false,
  resolve: null,
});

function confirm(): Promise<boolean> {
  state.visible = true;
  return new Promise<boolean>((resolve) => {
    state.resolve = resolve;
  });
}

function settle(result: boolean) {
  state.visible = false;
  state.resolve?.(result);
  state.resolve = null;
}

export function useConfirm() {
  return { state, confirm, settle };
}
