import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok when the database responds', async () => {
    const db = { execute: jest.fn().mockResolvedValue(undefined) };
    const controller = new HealthController(db as never);
    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
  });

  it('throws ServiceUnavailableException when the database query fails', async () => {
    const db = {
      execute: jest.fn().mockRejectedValue(new Error('connection refused')),
    };
    const controller = new HealthController(db as never);
    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
