import { verificationFailureReason } from './verification-failure';

describe('verificationFailureReason', () => {
  it('keeps an origin mismatch readable, so a misconfigured RP_ORIGIN shows in logs', () => {
    const message =
      'Unexpected registration response origin "https://evil.test", expected "https://example.test"';
    expect(verificationFailureReason(new Error(message))).toBe(message);
  });

  it('masks both challenges in a challenge mismatch', () => {
    const reason = verificationFailureReason(
      new Error('Unexpected authentication response challenge "abc123", expected "def456"'),
    );
    expect(reason).toBe(
      'Unexpected authentication response challenge "[redacted]", expected "[redacted]"',
    );
  });

  it('handles a thrown non-Error', () => {
    expect(verificationFailureReason('boom')).toBe('boom');
  });
});
