import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type IORedis from 'ioredis';
import { CryptoService } from '../../security/crypto.service';
import { VALKEY_CLIENT } from '../../session/session.constants';
import type { OfxStatement } from './ofx';

// How long an uploaded file, or the result of its import, is kept.
export const IMPORT_HOLD_SECONDS = 30 * 60;
const CONFIRM_LOCK_SECONDS = 2 * 60;
// Uploads a Member may have waiting at once (a few tabs, a retry); an upload
// past that replaces the oldest one.
export const MAX_PENDING_IMPORTS = 5;

// Bump when OfxStatement changes shape: a statement held under another version
// reads as expired rather than being misread.
export const STATEMENT_VERSION = 1;

export interface PendingImport {
  importId: string;
  accountId: string;
  statement: OfxStatement;
}

export interface ImportOutcome {
  importedCount: number;
  skippedCount: number;
  invalidCount: number;
  rememberedCount: number;
  // Label corrections left out because the Member holds the most allowed.
  notRememberedCount: number;
  reconciledCount: number;
}

// Only the holder of the lock releases it: one that outlived its expiry must
// not free the lock of the confirmation that took over.
const RELEASE_LOCK = `if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0`;

/**
 * Holds a Member's uploaded bank statement, read once at upload, between the
 * upload and the confirmation, and nowhere else, encrypted: it names the
 * account and every operation. Keys
 * carry the Member, so another Member's import id never resolves, and the
 * import id, so a second upload does not cancel a first one still being
 * reviewed, up to MAX_PENDING_IMPORTS of them.
 */
@Injectable()
export class ImportStore {
  constructor(
    @Inject(VALKEY_CLIENT) private readonly client: IORedis,
    private readonly crypto: CryptoService,
  ) {}

  private metaKey(memberId: string, importId: string): string {
    return `import:meta:${memberId}:${importId}`;
  }

  private fileKey(memberId: string, importId: string): string {
    return `import:file:${memberId}:${importId}`;
  }

  private resultKey(memberId: string, importId: string): string {
    return `import:result:${memberId}:${importId}`;
  }

  // The Member's pending import ids, scored by when their hold ends.
  private pendingKey(memberId: string): string {
    return `import:pending:${memberId}`;
  }

  private lockKey(memberId: string, importId: string): string {
    return `import:lock:${memberId}:${importId}`;
  }

  async save(memberId: string, accountId: string, statement: OfxStatement): Promise<string> {
    const importId = randomUUID();
    const now = Date.now();
    const pending = this.pendingKey(memberId);
    const results = await this.client
      .multi()
      .set(
        this.fileKey(memberId, importId),
        this.crypto.encrypt(JSON.stringify({ v: STATEMENT_VERSION, statement })),
        'EX',
        IMPORT_HOLD_SECONDS,
      )
      .set(
        this.metaKey(memberId, importId),
        JSON.stringify({ accountId }),
        'EX',
        IMPORT_HOLD_SECONDS,
      )
      .zremrangebyscore(pending, '-inf', now)
      .zadd(pending, now + IMPORT_HOLD_SECONDS * 1000, importId)
      .expire(pending, IMPORT_HOLD_SECONDS)
      .zcard(pending)
      .exec();
    const held = Number(results?.[results.length - 1]?.[1] ?? 0);
    if (held > MAX_PENDING_IMPORTS) await this.evictOldest(memberId, held - MAX_PENDING_IMPORTS);
    return importId;
  }

  private async evictOldest(memberId: string, count: number): Promise<void> {
    const oldest = await this.client.zrange(this.pendingKey(memberId), '0', String(count - 1));
    if (oldest.length === 0) return;
    await this.client
      .multi()
      .del(...oldest.flatMap((id) => [this.fileKey(memberId, id), this.metaKey(memberId, id)]))
      .zrem(this.pendingKey(memberId), ...oldest)
      .exec();
  }

  async load(memberId: string, importId: string): Promise<PendingImport | null> {
    const [meta, sealed] = await Promise.all([
      this.client.get(this.metaKey(memberId, importId)),
      this.client.get(this.fileKey(memberId, importId)),
    ]);
    if (!meta || !sealed) return null;
    const { accountId } = JSON.parse(meta) as { accountId: string };
    try {
      const held = JSON.parse(this.crypto.decrypt(sealed)) as {
        v?: number;
        statement?: OfxStatement;
      };
      if (held.v !== STATEMENT_VERSION || !held.statement) return null;
      return { importId, accountId, statement: held.statement };
    } catch {
      // Sealed under a key that is gone, altered, or held by an older release
      // as a raw file: as good as expired.
      return null;
    }
  }

  async discard(memberId: string, importId: string): Promise<void> {
    await this.client
      .multi()
      .del(this.fileKey(memberId, importId), this.metaKey(memberId, importId))
      .zrem(this.pendingKey(memberId), importId)
      .exec();
  }

  async saveOutcome(memberId: string, importId: string, outcome: ImportOutcome): Promise<void> {
    await this.client.set(
      this.resultKey(memberId, importId),
      JSON.stringify(outcome),
      'EX',
      IMPORT_HOLD_SECONDS,
    );
  }

  async loadOutcome(memberId: string, importId: string): Promise<ImportOutcome | null> {
    const stored = await this.client.get(this.resultKey(memberId, importId));
    if (!stored) return null;
    return JSON.parse(stored) as ImportOutcome;
  }

  // The token to release the lock with; null when a confirmation of this
  // import is already running.
  async lockConfirmation(memberId: string, importId: string): Promise<string | null> {
    const token = randomUUID();
    const set = await this.client.set(
      this.lockKey(memberId, importId),
      token,
      'EX',
      CONFIRM_LOCK_SECONDS,
      'NX',
    );
    return set === 'OK' ? token : null;
  }

  async unlockConfirmation(memberId: string, importId: string, token: string): Promise<void> {
    await this.client.eval(RELEASE_LOCK, 1, this.lockKey(memberId, importId), token);
  }
}
