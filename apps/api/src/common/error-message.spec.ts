import { errorMessage } from './error-message';

describe('errorMessage', () => {
  it("returns an Error's message", () => {
    expect(errorMessage(new Error('connection refused'))).toBe('connection refused');
  });

  it('stringifies a thrown non-Error', () => {
    expect(errorMessage('plain string')).toBe('plain string');
    expect(errorMessage(42)).toBe('42');
    expect(errorMessage(undefined)).toBe('undefined');
  });
});
