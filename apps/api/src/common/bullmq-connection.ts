import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

/**
 * An ioredis connection for BullMQ (the session and rate-limit clients use
 * the `redis` package instead), with `maxRetriesPerRequest: null` as BullMQ
 * requires for Workers. The password comes from VALKEY_PASSWORD, like those
 * clients': production keeps it out of VALKEY_URL (see .kamal/secrets), and
 * a URL-only connection there is refused with NOAUTH.
 */
export function createBullmqConnection(config: ConfigService): IORedis {
  return new IORedis(config.getOrThrow<string>('VALKEY_URL'), {
    password: config.get<string>('VALKEY_PASSWORD'),
    maxRetriesPerRequest: null,
  });
}
