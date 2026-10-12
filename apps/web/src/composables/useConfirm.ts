import { reactive } from 'vue';

// Already-translated text. The title and confirm label fall back to the
// generic "Confirmation" / "Ok" when omitted; `danger` turns the confirm
// button red for actions that destroy or irreversibly change data.
export interface ConfirmOptions {
  title?: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface ConfirmState {
  visible: boolean;
  options: ConfirmOptions | null;
  resolve: ((result: boolean) => void) | null;
}

// Single shared instance: one confirmation dialog on screen at a time,
// driven from anywhere via confirm() and rendered by ConfirmModal.vue.
const state = reactive<ConfirmState>({
  visible: false,
  options: null,
  resolve: null,
});

function confirm(options: ConfirmOptions): Promise<boolean> {
  state.options = options;
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
