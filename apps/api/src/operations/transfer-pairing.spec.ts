// classifyPairingEdit is pure and exported standalone from transfer.service.ts
// specifically so it's unit-testable with zero DB — see that file's own doc
// comment on the function.
import { classifyPairingEdit, PreviousPairing } from './transfer.service';

const noMirror: PreviousPairing = {
  targetAccountId: null,
  mirrorOperationId: null,
};
const paired: PreviousPairing = {
  targetAccountId: 'account-a',
  mirrorOperationId: 'mirror-1',
};

describe('classifyPairingEdit', () => {
  it('is a no-op when there was no mirror and none is desired', () => {
    expect(classifyPairingEdit(noMirror, null)).toEqual({ action: 'none' });
  });

  it('detaches an existing mirror when the desired target becomes null', () => {
    expect(classifyPairingEdit(paired, null)).toEqual({
      action: 'detach',
      mirrorOperationId: 'mirror-1',
    });
  });

  it('refreshes in place when the desired target is unchanged', () => {
    expect(classifyPairingEdit(paired, 'account-a')).toEqual({
      action: 'refresh',
      mirrorOperationId: 'mirror-1',
    });
  });

  it('retargets an existing mirror to a different account', () => {
    expect(classifyPairingEdit(paired, 'account-b')).toEqual({
      action: 'retarget',
      mirrorOperationId: 'mirror-1',
      targetAccountId: 'account-b',
    });
  });

  it('attaches a fresh mirror when none existed and a target is now desired', () => {
    expect(classifyPairingEdit(noMirror, 'account-a')).toEqual({
      action: 'attach',
      targetAccountId: 'account-a',
    });
  });
});
