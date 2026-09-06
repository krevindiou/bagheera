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
        'account-7',
      ),
    ).toEqual({ action: 'attach', targetAccountId: 'account-7' });
  });

  it('classifies an existing pairing with no desired target as a detach', () => {
    expect(
      classifyPairingEdit(
        { targetAccountId: 'account-7', mirrorOperationId: 'operation-42' },
        null,
      ),
    ).toEqual({ action: 'detach', mirrorOperationId: 'operation-42' });
  });

  it('classifies the same desired target as the existing one as a refresh', () => {
    expect(
      classifyPairingEdit(
        { targetAccountId: 'account-7', mirrorOperationId: 'operation-42' },
        'account-7',
      ),
    ).toEqual({ action: 'refresh', mirrorOperationId: 'operation-42' });
  });

  it('classifies a different desired target than the existing one as a retarget', () => {
    expect(
      classifyPairingEdit(
        { targetAccountId: 'account-7', mirrorOperationId: 'operation-42' },
        'account-9',
      ),
    ).toEqual({
      action: 'retarget',
      mirrorOperationId: 'operation-42',
      targetAccountId: 'account-9',
    });
  });
});
