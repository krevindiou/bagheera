import { classifyPairingEdit } from './transfer.service';

describe('classifyPairingEdit', () => {
  it('classifies no prior pairing and no desired target as a no-op', () => {
    expect(
      classifyPairingEdit(
        { targetAccountId: null, mirrorOperationId: null },
        null,
      ),
    ).toEqual({ action: 'none' });
  });

  it('classifies no prior pairing and a desired target as an attach', () => {
    expect(
      classifyPairingEdit(
        { targetAccountId: null, mirrorOperationId: null },
        7,
      ),
    ).toEqual({ action: 'attach', targetAccountId: 7 });
  });

  it('classifies an existing pairing with no desired target as a detach', () => {
    expect(
      classifyPairingEdit({ targetAccountId: 7, mirrorOperationId: 42 }, null),
    ).toEqual({ action: 'detach', mirrorOperationId: 42 });
  });

  it('classifies the same desired target as the existing one as a refresh', () => {
    expect(
      classifyPairingEdit({ targetAccountId: 7, mirrorOperationId: 42 }, 7),
    ).toEqual({ action: 'refresh', mirrorOperationId: 42 });
  });

  it('classifies a different desired target than the existing one as a retarget', () => {
    expect(
      classifyPairingEdit({ targetAccountId: 7, mirrorOperationId: 42 }, 9),
    ).toEqual({
      action: 'retarget',
      mirrorOperationId: 42,
      targetAccountId: 9,
    });
  });
});
