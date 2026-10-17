import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { vi, type MockInstance } from 'vitest';

describe('HealthController', () => {
  const valkey = { ping: vi.fn() };
  let errorSpy: MockInstance;

  beforeEach(() => {
    valkey.ping.mockReset().mockResolvedValue('PONG');
    errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok when the database and Valkey respond', async () => {
    const db = { execute: vi.fn().mockResolvedValue(undefined) };
    const controller = new HealthController(db as never, valkey as never);
    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('throws ServiceUnavailableException when the database query fails, logging why', async () => {
    const db = {
      execute: vi.fn().mockRejectedValue(new Error('connection refused')),
    };
    const controller = new HealthController(db as never, valkey as never);
    const error = await controller.check().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).message).toBe('database unreachable');
    expect(errorSpy).toHaveBeenCalledWith('database probe failed: connection refused');
  });

  it('throws ServiceUnavailableException when Valkey does not answer, logging why', async () => {
    valkey.ping.mockRejectedValue(new Error('ECONNREFUSED'));
    const db = { execute: vi.fn().mockResolvedValue(undefined) };
    const controller = new HealthController(db as never, valkey as never);
    await expect(controller.check()).rejects.toThrow('valkey unreachable');
    expect(errorSpy).toHaveBeenCalledWith('valkey probe failed: ECONNREFUSED');
  });

  it('logs a non-Error rejection as text', async () => {
    const db = { execute: vi.fn().mockRejectedValue('socket hang up') };
    const controller = new HealthController(db as never, valkey as never);
    await expect(controller.check()).rejects.toThrow('database unreachable');
    expect(errorSpy).toHaveBeenCalledWith('database probe failed: socket hang up');
  });
});
