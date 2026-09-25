import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const valkey = { ping: jest.fn() };

  beforeEach(() => {
    valkey.ping.mockReset().mockResolvedValue('PONG');
  });

  it('returns ok when the database and Valkey respond', async () => {
    const db = { execute: jest.fn().mockResolvedValue(undefined) };
    const controller = new HealthController(db as never, valkey as never);
    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
  });

  it('throws ServiceUnavailableException when the database query fails', async () => {
    const db = {
      execute: jest.fn().mockRejectedValue(new Error('connection refused')),
    };
    const controller = new HealthController(db as never, valkey as never);
    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('throws ServiceUnavailableException when Valkey does not answer', async () => {
    valkey.ping.mockRejectedValue(new Error('ECONNREFUSED'));
    const db = { execute: jest.fn().mockResolvedValue(undefined) };
    const controller = new HealthController(db as never, valkey as never);
    await expect(controller.check()).rejects.toThrow('valkey unreachable');
  });
});
