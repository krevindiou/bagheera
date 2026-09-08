import { testCryptoService } from '../test-support/test-crypto-service';
import { buildActivationToken, parseActivationToken } from './activation-token';
import { buildEmailChangeToken } from './email-change-token';

describe('activation-token', () => {
  const crypto = testCryptoService();

  it('round-trips email/version through build and parse', () => {
    const token = buildActivationToken(crypto, 'member@example.com', 2);
    const payload = parseActivationToken(crypto, token);
    expect(payload).toMatchObject({
      type: 'register',
      email: 'member@example.com',
      version: 2,
    });
  });

  it('returns null for an expired token', () => {
    const realNow = Date.now;
    Date.now = () => 0;
    const token = buildActivationToken(crypto, 'member@example.com', 1);
    Date.now = realNow;
    expect(parseActivationToken(crypto, token)).toBeNull();
  });

  it('returns null for a tampered/undecryptable token', () => {
    expect(parseActivationToken(crypto, 'garbage')).toBeNull();
  });

  it('returns null when the ciphertext decrypts to valid JSON that is not even an object', () => {
    const primitiveCiphertext = crypto.encrypt(JSON.stringify(42));
    expect(parseActivationToken(crypto, primitiveCiphertext)).toBeNull();
  });

  it('returns null for a token minted for a different purpose (type confusion)', () => {
    const emailChangeToken = buildEmailChangeToken(
      crypto,
      'member-id',
      'new@example.com',
      1,
    );
    expect(parseActivationToken(crypto, emailChangeToken)).toBeNull();
  });
});
