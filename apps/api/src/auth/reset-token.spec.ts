import { testCryptoService } from '../test-support/test-crypto-service';
import { buildResetToken, parseResetToken } from './reset-token';
import { buildActivationToken } from '../members/activation-token';

describe('reset-token', () => {
  const crypto = testCryptoService();

  it('round-trips email/version through build and parse', () => {
    const token = buildResetToken(crypto, 'member@example.com', 3);
    const payload = parseResetToken(crypto, token);
    expect(payload).toMatchObject({
      type: 'reset',
      email: 'member@example.com',
      version: 3,
    });
  });

  it('returns null for an expired token', () => {
    const realNow = Date.now;
    Date.now = () => 0; // mint "at the epoch", so it's long since expired
    const token = buildResetToken(crypto, 'member@example.com', 1);
    Date.now = realNow;
    expect(parseResetToken(crypto, token)).toBeNull();
  });

  it('returns null for a tampered/undecryptable token', () => {
    expect(parseResetToken(crypto, 'not-a-real-token')).toBeNull();
  });

  it('returns null for a well-formed-but-foreign ciphertext (decrypts to unrelated JSON)', () => {
    const foreignCiphertext = crypto.encrypt(
      JSON.stringify({ some: 'other shape' }),
    );
    expect(parseResetToken(crypto, foreignCiphertext)).toBeNull();
  });

  it('returns null when the ciphertext decrypts to valid JSON that is not even an object', () => {
    const primitiveCiphertext = crypto.encrypt(JSON.stringify('just a string'));
    expect(parseResetToken(crypto, primitiveCiphertext)).toBeNull();
  });

  it('returns null for a token minted for a different purpose (type confusion)', () => {
    // An activation token, fed to the reset parser, must not be accepted —
    // each token type carries its own `type` tag specifically to prevent
    // cross-purpose replay.
    const activationToken = buildActivationToken(
      crypto,
      'member@example.com',
      1,
    );
    expect(parseResetToken(crypto, activationToken)).toBeNull();
  });
});
