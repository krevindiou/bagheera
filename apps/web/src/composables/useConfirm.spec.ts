import { beforeEach, describe, expect, it } from 'vitest';
import { useConfirm } from './useConfirm';

describe('useConfirm', () => {
  // Module-singleton state (one dialog for the whole app) — drain any
  // pending confirmation left over from a previous test before each one.
  beforeEach(() => {
    const { state, settle } = useConfirm();
    settle(false);
    state.visible = false;
  });

  it('shows the dialog with the given text and resolves true once confirmed', async () => {
    const { state, confirm, settle } = useConfirm();
    const options = { body: 'Delete it?', confirmLabel: 'Delete', danger: true };
    const pending = confirm(options);
    expect(state.visible).toBe(true);
    expect(state.options).toEqual(options);
    settle(true);
    await expect(pending).resolves.toBe(true);
    expect(state.visible).toBe(false);
  });

  it('resolves false once cancelled', async () => {
    const { confirm, settle } = useConfirm();
    const pending = confirm({ body: 'Delete it?' });
    settle(false);
    await expect(pending).resolves.toBe(false);
  });

  it('shares one dialog instance across every caller', () => {
    const first = useConfirm();
    const second = useConfirm();
    void first.confirm({ body: 'Delete it?' });
    expect(second.state.visible).toBe(true);
  });
});
