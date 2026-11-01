import { normalizeEmail, plusTaggedMailbox } from './email-address';

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Someone@Example.TEST ')).toBe('someone@example.test');
  });
});

describe('plusTaggedMailbox', () => {
  it('drops the tag from the local part, normalized', () => {
    expect(plusTaggedMailbox(' Inbox+News@Example.test')).toBe('inbox@example.test');
  });

  it('drops everything after the first plus', () => {
    expect(plusTaggedMailbox('inbox+a+b@example.test')).toBe('inbox@example.test');
  });

  it('is undefined for an untagged address', () => {
    expect(plusTaggedMailbox('inbox@example.test')).toBeUndefined();
  });

  it('ignores a plus outside the local part', () => {
    expect(plusTaggedMailbox('inbox@ex+ample.test')).toBeUndefined();
  });

  it('is undefined for a value with no @', () => {
    expect(plusTaggedMailbox('inbox+tag')).toBeUndefined();
  });
});
