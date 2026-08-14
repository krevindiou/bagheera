import { HashService } from './hash.service';

describe('HashService', () => {
  let service: HashService;

  beforeEach(() => {
    service = new HashService();
  });

  it('hashes and verifies a matching password', async () => {
    const hash = await service.hash('correct-horse-battery-staple');
    await expect(
      service.verify(hash, 'correct-horse-battery-staple'),
    ).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash('correct-horse-battery-staple');
    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('rejects a malformed hash instead of throwing', async () => {
    await expect(service.verify('not-a-real-hash', 'anything')).resolves.toBe(
      false,
    );
  });

  it('produces Argon2id hashes', async () => {
    const hash = await service.hash('password');
    expect(hash).toMatch(/^\$argon2id\$/);
  });
});
