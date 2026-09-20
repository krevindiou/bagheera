import { testCryptoService } from '../test-support/test-crypto-service';
import { buildEmailChangeToken } from './email-change-token';
import { buildSignupToken, parseSignupToken } from './signup-token';

describe('signup-token', () => {
  const crypto = testCryptoService();

  it('round-trips email/country/locale through build and parse', () => {
    const token = buildSignupToken(crypto, 'member@example.com', 'FR', 'en');
    const payload = parseSignupToken(crypto, token);
    expect(payload).toMatchObject({
      type: 'signup',
      email: 'member@example.com',
      country: 'FR',
      locale: 'en',
    });
  });

  it('returns null for an expired token', () => {
    const realNow = Date.now;
    Date.now = () => 0;
    const token = buildSignupToken(crypto, 'member@example.com', 'FR', 'en');
    Date.now = realNow;
    expect(parseSignupToken(crypto, token)).toBeNull();
  });

  it('returns null for a tampered/undecryptable token', () => {
    expect(parseSignupToken(crypto, 'garbage')).toBeNull();
  });

  it('returns null when the ciphertext decrypts to valid JSON that is not even an object', () => {
    const primitiveCiphertext = crypto.encrypt(JSON.stringify(42));
    expect(parseSignupToken(crypto, primitiveCiphertext)).toBeNull();
  });

  it('returns null for an unsupported locale', () => {
    const forged = crypto.encrypt(
      JSON.stringify({
        type: 'signup',
        email: 'member@example.com',
        country: 'FR',
        locale: 'zz',
        exp: Date.now() + 60_000,
      }),
    );
    expect(parseSignupToken(crypto, forged)).toBeNull();
  });

  it('returns null for a token minted for a different purpose (type confusion)', () => {
    const emailChangeToken = buildEmailChangeToken(crypto, 'member-id', 'new@example.com', 1);
    expect(parseSignupToken(crypto, emailChangeToken)).toBeNull();
  });
});
