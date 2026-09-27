import type IORedis from 'ioredis';

/**
 * connect-redis 10 only speaks node-redis's client API; this exposes the
 * handful of calls it makes (see its dist/connect-redis.js) on top of the
 * shared ioredis client, so sessions don't need a second Valkey library.
 * Revisit when upgrading connect-redis: any new client call it makes has
 * to be added here.
 */
export function sessionStoreClient(client: IORedis) {
  return {
    get: (key: string) => client.get(key),
    set: (key: string, value: string, options?: { expiration: { type: 'EX'; value: number } }) =>
      options
        ? client.set(key, value, options.expiration.type, options.expiration.value)
        : client.set(key, value),
    expire: (key: string, seconds: number) => client.expire(key, seconds),
    del: (keys: string[]) => (keys.length > 0 ? client.del(...keys) : Promise.resolve(0)),
    mGet: (keys: string[]) => client.mget(...keys),
    // connect-redis scans with node-redis's `scanIterator`, which yields
    // batches of keys, as ioredis's `scanStream` does.
    scanIterator: (options: { MATCH: string; COUNT: number }): AsyncIterable<string[]> =>
      client.scanStream({ match: options.MATCH, count: options.COUNT }),
  };
}
