import type { Request } from 'express';
import { vi } from 'vitest';
import type { SessionRegistryService } from '../session/session-registry.service';
import { SignOutService } from './sign-out.service';

function build(memberId: string | undefined, destroyError?: Error) {
  const registry = { unregister: vi.fn().mockResolvedValue(undefined) };
  const destroy = vi.fn((cb: (err?: Error) => void) => cb(destroyError));
  const req = { sessionID: 'sid', session: { memberId, destroy } } as unknown as Request;
  const service = new SignOutService(registry as unknown as SessionRegistryService);
  return { registry, destroy, req, service };
}

describe('SignOutService', () => {
  it('destroys the session and drops it from the member registry', async () => {
    const { registry, destroy, req, service } = build('m1');
    await service.signOut(req);
    expect(destroy).toHaveBeenCalled();
    expect(registry.unregister).toHaveBeenCalledWith('m1', 'sid');
  });

  it('skips the registry for an anonymous session', async () => {
    const { registry, req, service } = build(undefined);
    await service.signOut(req);
    expect(registry.unregister).not.toHaveBeenCalled();
  });

  it('rejects when the store fails to destroy the session', async () => {
    const { registry, req, service } = build('m1', new Error('boom'));
    await expect(service.signOut(req)).rejects.toThrow('boom');
    expect(registry.unregister).not.toHaveBeenCalled();
  });
});
