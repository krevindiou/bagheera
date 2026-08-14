import { reactive } from "vue";

interface ConfirmState {
  visible: boolean;
  message: string;
  resolve: ((result: boolean) => void) | null;
}

// Single shared instance: one confirmation dialog on screen at a time,
// driven from anywhere via confirm() and rendered by ConfirmModal.vue.
const state = reactive<ConfirmState>({
  visible: false,
  message: "",
  resolve: null,
});

function confirm(message: string): Promise<boolean> {
  state.message = message;
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
