import { testCryptoService } from '../test-support/test-crypto-service';
import { buildEmailChangeToken, parseEmailChangeToken } from './email-change-token';
import { buildSignupToken } from './signup-token';

describe('email-change-token', () => {
  const crypto = testCryptoService();

  it('round-trips memberId/newEmail/version through build and parse', () => {
    const token = buildEmailChangeToken(crypto, 'member-42', 'new@example.com', 1);
    const payload = parseEmailChangeToken(crypto, token);
    expect(payload).toMatchObject({
      type: 'email_change',
      memberId: 'member-42',
      newEmail: 'new@example.com',
      version: 1,
    });
  });

  it('returns null for an expired token', () => {
    const realNow = Date.now;
    Date.now = () => 0;
    const token = buildEmailChangeToken(crypto, 'member-42', 'new@example.com', 1);
    Date.now = realNow;
    expect(parseEmailChangeToken(crypto, token)).toBeNull();
  });

  it('returns null for a tampered/undecryptable token', () => {
    expect(parseEmailChangeToken(crypto, 'garbage')).toBeNull();
  });

  it('returns null when the ciphertext decrypts to valid JSON that is not even an object', () => {
    const primitiveCiphertext = crypto.encrypt(JSON.stringify(null));
    expect(parseEmailChangeToken(crypto, primitiveCiphertext)).toBeNull();
  });

  it('returns null for a token minted for a different purpose (type confusion)', () => {
    const signupToken = buildSignupToken(crypto, 'member@example.com', 'FR', 'en');
    expect(parseEmailChangeToken(crypto, signupToken)).toBeNull();
  });
});
