import type IORedis from 'ioredis';

/**
 * In-memory stand-in for the few Valkey commands SignupMailThrottle and
 * SingleUseStore use, with expiry following `Date.now()` so fake timers
 * drive it.
 */
export class FakeValkey {
  private readonly entries = new Map<string, { value: string; expiresAt?: number }>();

  set(
    key: string,
    value: string,
    ...options: [mode: 'PX', ms: number, condition?: 'NX']
  ): Promise<'OK' | null> {
    if (options[2] === 'NX' && this.live(key)) {
      return Promise.resolve(null);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + options[1] });
    return Promise.resolve('OK');
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.live(key)?.value ?? null);
  }

  getdel(key: string): Promise<string | null> {
    const entry = this.live(key);
    this.entries.delete(key);
    return Promise.resolve(entry?.value ?? null);
  }

  pttl(key: string): Promise<number> {
    const entry = this.live(key);
    if (!entry) return Promise.resolve(-2);
    return Promise.resolve(entry.expiresAt === undefined ? -1 : entry.expiresAt - Date.now());
  }

  incr(key: string): Promise<number> {
    return Promise.resolve(this.add(key, 1));
  }

  decr(key: string): Promise<number> {
    return Promise.resolve(this.add(key, -1));
  }

  expire(key: string, seconds: number): Promise<number> {
    const entry = this.live(key);
    if (!entry) return Promise.resolve(0);
    entry.expiresAt = Date.now() + seconds * 1000;
    return Promise.resolve(1);
  }

  del(key: string): Promise<number> {
    return Promise.resolve(this.entries.delete(key) ? 1 : 0);
  }

  asClient(): IORedis {
    return this as unknown as IORedis;
  }

  private add(key: string, by: number): number {
    const entry = this.live(key);
    const next = Number(entry?.value ?? 0) + by;
    this.entries.set(key, { value: String(next), expiresAt: entry?.expiresAt });
    return next;
  }

  private live(key: string): { value: string; expiresAt?: number } | undefined {
    const entry = this.entries.get(key);
    if (entry?.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }
}
