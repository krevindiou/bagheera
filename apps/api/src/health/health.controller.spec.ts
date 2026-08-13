import { Test, TestingModule } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '../db/db.constants';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const execute = jest.fn();

  const build = async (): Promise<HealthController> => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DRIZZLE, useValue: { execute } }],
    }).compile();
    return module.get(HealthController);
  };

  beforeEach(() => execute.mockReset());

  it('returns ok when the DB round-trip succeeds', async () => {
    execute.mockResolvedValue(undefined);
    const controller = await build();

    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
    expect(execute).toHaveBeenCalledWith(sql`select 1`);
  });

  it('throws 503 when the DB round-trip fails', async () => {
    execute.mockRejectedValue(new Error('connection refused'));
    const controller = await build();

    await expect(controller.check()).rejects.toMatchObject({ status: 503 });
  });
});
