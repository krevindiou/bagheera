import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { createBullmqConnection } from './bullmq-connection';

jest.mock('ioredis', () => jest.fn());

function configWith(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('createBullmqConnection', () => {
  // Production keeps the password out of VALKEY_URL; a URL-only connection
  // is refused there with NOAUTH.
  it('authenticates with VALKEY_PASSWORD, with the retry setting BullMQ Workers need', () => {
    createBullmqConnection(
      configWith({ VALKEY_URL: 'redis://valkey:6379', VALKEY_PASSWORD: 'secret' }),
    );
    expect(IORedis).toHaveBeenCalledWith('redis://valkey:6379', {
      password: 'secret',
      maxRetriesPerRequest: null,
    });
  });
});
