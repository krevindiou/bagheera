import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { createValkeyClient } from './valkey-client';

jest.mock('redis', () => ({ createClient: jest.fn() }));

describe('createValkeyClient', () => {
  const client = { on: jest.fn(), connect: jest.fn().mockResolvedValue(undefined) };
  const config = {
    getOrThrow: jest.fn().mockReturnValue('redis://valkey:6379'),
    get: jest.fn().mockReturnValue('secret'),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(client);
  });

  it('connects with the configured URL and password', async () => {
    await expect(createValkeyClient(config, new Logger('t'))).resolves.toBe(client);
    expect(createClient).toHaveBeenCalledWith({ url: 'redis://valkey:6379', password: 'secret' });
    expect(client.connect).toHaveBeenCalled();
  });

  it('logs client errors', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    await createValkeyClient(config, new Logger('t'));
    const [event, listener] = client.on.mock.calls[0] as [string, (err: Error) => void];
    listener(new Error('boom'));
    expect(event).toBe('error');
    expect(error).toHaveBeenCalledWith('Valkey client error', expect.any(Error));
    error.mockRestore();
  });
});
