import { isFullyActive } from './reachable';

function pair(
  overrides: Partial<{
    accClosed: boolean;
    accDeleted: boolean;
    bnkClosed: boolean;
    bnkDeleted: boolean;
  }> = {},
) {
  const {
    accClosed = false,
    accDeleted = false,
    bnkClosed = false,
    bnkDeleted = false,
  } = overrides;
  return {
    acc: { closed: accClosed, deleted: accDeleted },
    bnk: { closed: bnkClosed, deleted: bnkDeleted },
  };
}

describe('isFullyActive', () => {
  it('is true when neither the account nor its bank is closed or deleted', () => {
    const { acc, bnk } = pair();
    expect(isFullyActive(acc, bnk)).toBe(true);
  });

  it('is false when the account is closed', () => {
    const { acc, bnk } = pair({ accClosed: true });
    expect(isFullyActive(acc, bnk)).toBe(false);
  });

  it('is false when the account is deleted', () => {
    const { acc, bnk } = pair({ accDeleted: true });
    expect(isFullyActive(acc, bnk)).toBe(false);
  });

  it('is false when the bank is closed', () => {
    const { acc, bnk } = pair({ bnkClosed: true });
    expect(isFullyActive(acc, bnk)).toBe(false);
  });

  it('is false when the bank is deleted', () => {
    const { acc, bnk } = pair({ bnkDeleted: true });
    expect(isFullyActive(acc, bnk)).toBe(false);
  });
});
