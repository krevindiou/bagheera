import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { closeValkeyClient, createValkeyClient } from './valkey-client';

jest.mock('ioredis', () => jest.fn());

describe('createValkeyClient', () => {
  const client = { on: jest.fn() };
  const config = {
    getOrThrow: jest.fn().mockReturnValue('redis://valkey:6379'),
    get: jest.fn().mockReturnValue('secret'),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    (IORedis as unknown as jest.Mock).mockReturnValue(client);
  });

  it('connects with the configured URL and password', () => {
    expect(createValkeyClient(config, new Logger('t'))).toBe(client);
    expect(IORedis).toHaveBeenCalledWith('redis://valkey:6379', { password: 'secret' });
  });

  it('passes extra options through', () => {
    createValkeyClient(config, undefined, { maxRetriesPerRequest: null });
    expect(IORedis).toHaveBeenCalledWith('redis://valkey:6379', {
      password: 'secret',
      maxRetriesPerRequest: null,
    });
    expect(client.on).not.toHaveBeenCalled();
  });

  it('logs client errors', () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    createValkeyClient(config, new Logger('t'));
    const [event, listener] = client.on.mock.calls[0] as [string, (err: Error) => void];
    listener(new Error('boom'));
    expect(event).toBe('error');
    expect(error).toHaveBeenCalledWith('Valkey client error', expect.any(Error));
    error.mockRestore();
  });
});

describe('closeValkeyClient', () => {
  it('quits an open client', async () => {
    const quit = jest.fn().mockResolvedValue('OK');
    await closeValkeyClient({ status: 'ready', quit } as unknown as IORedis);
    expect(quit).toHaveBeenCalled();
  });

  it('does not quit an already-closed client', async () => {
    const quit = jest.fn();
    await closeValkeyClient({ status: 'end', quit } as unknown as IORedis);
    expect(quit).not.toHaveBeenCalled();
  });
});
