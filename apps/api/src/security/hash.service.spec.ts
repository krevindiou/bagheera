import { HashService } from './hash.service';

describe('HashService', () => {
  const service = new HashService();

  it('hashes using the argon2id variant', async () => {
    const hash = await service.hash('correct horse battery staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('verifies a hash against the password it was made from', async () => {
    const hash = await service.hash('correct horse battery staple');
    await expect(service.verify(hash, 'correct horse battery staple')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('correct horse battery staple');
    await expect(service.verify(hash, 'wrong password')).resolves.toBe(false);
  });

  it('returns false, rather than throwing, for a malformed/foreign hash string', async () => {
    await expect(service.verify('not-a-real-argon2-hash', 'anything')).resolves.toBe(false);
  });
});
