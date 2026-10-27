import type IORedis from 'ioredis';
import { vi, type Mock } from 'vitest';
import { testCryptoService } from '../../test-support/test-crypto-service';
import type { OfxStatement } from './ofx';
import {
  IMPORT_HOLD_SECONDS,
  ImportStore,
  MAX_PENDING_IMPORTS,
  STATEMENT_VERSION,
} from './import.store';

const MEMBER = 'member-1';
const ACCOUNT = 'account-1';

const STATEMENT: OfxStatement = {
  kind: 'bank',
  currency: 'EUR',
  rows: [
    {
      date: '20240105',
      amount: '-12.50',
      type: 'DEBIT',
      name: 'CAFÉ BAKERY',
      memo: '',
      reference: 'F1',
    },
  ],
  closing: { amount: '100.00', date: '20240131' },
  accountRef: { bankId: '12345', accountId: '123456789' },
};

const sealedStatement = (statement: unknown = STATEMENT, v: number = STATEMENT_VERSION) =>
  crypto.encrypt(JSON.stringify({ v, statement }));

interface FakeClient {
  multi: Mock;
  get: Mock;
  set: Mock;
  del: Mock;
  eval: Mock;
  zrange: Mock;
}

const CHAIN_STEPS = ['set', 'del', 'zadd', 'zrem', 'zremrangebyscore', 'expire', 'zcard'] as const;
type Chain = Record<(typeof CHAIN_STEPS)[number] | 'exec', Mock>;

function fakeClient(): { client: FakeClient; chain: Chain } {
  const chain = { exec: vi.fn().mockResolvedValue([]) } as Chain;
  for (const step of CHAIN_STEPS) chain[step] = vi.fn().mockReturnValue(chain);
  const client: FakeClient = {
    multi: vi.fn().mockReturnValue(chain),
    zrange: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    eval: vi.fn().mockResolvedValue(1),
  };
  return { client, chain };
}

const crypto = testCryptoService();

function storeOver(client: FakeClient): ImportStore {
  return new ImportStore(client as unknown as IORedis, crypto);
}

// What the store holds: the details as text, the statement sealed.
function holding(meta: string | null, sealed: string | null) {
  return (key: string) => Promise.resolve(key.startsWith('import:meta:') ? meta : sealed);
}

describe('ImportStore', () => {
  it('keeps the statement and its owner under the Member, with an expiry', async () => {
    const { client, chain } = fakeClient();

    const importId = await storeOver(client).save(MEMBER, ACCOUNT, STATEMENT);

    expect(chain.set).toHaveBeenCalledWith(
      `import:file:${MEMBER}:${importId}`,
      expect.any(String),
      'EX',
      IMPORT_HOLD_SECONDS,
    );
    expect(chain.set).toHaveBeenCalledWith(
      `import:meta:${MEMBER}:${importId}`,
      JSON.stringify({ accountId: ACCOUNT }),
      'EX',
      IMPORT_HOLD_SECONDS,
    );
    expect(chain.exec).toHaveBeenCalled();
  });

  it('holds the statement encrypted, not as it was read', async () => {
    const { client, chain } = fakeClient();

    const importId = await storeOver(client).save(MEMBER, ACCOUNT, STATEMENT);

    const held = chain.set.mock.calls.find(
      ([key]) => key === `import:file:${MEMBER}:${importId}`,
    )?.[1] as string;
    expect(held).not.toContain('123456789');
    expect(held).not.toContain('BAKERY');
    expect(JSON.parse(crypto.decrypt(held))).toEqual({
      v: STATEMENT_VERSION,
      statement: STATEMENT,
    });
  });

  it('gives each upload its own import id', async () => {
    const { client } = fakeClient();
    const store = storeOver(client);
    expect(await store.save(MEMBER, ACCOUNT, STATEMENT)).not.toBe(
      await store.save(MEMBER, ACCOUNT, STATEMENT),
    );
  });

  describe('load', () => {
    it('returns the pending import under its id', async () => {
      const { client } = fakeClient();
      client.get.mockImplementation(
        holding(JSON.stringify({ accountId: ACCOUNT }), sealedStatement()),
      );

      expect(await storeOver(client).load(MEMBER, 'i-1')).toEqual({
        importId: 'i-1',
        accountId: ACCOUNT,
        statement: STATEMENT,
      });
    });

    it('looks for the statement and the details under the Member and the id', async () => {
      const { client } = fakeClient();
      client.get.mockResolvedValue(null);

      await storeOver(client).load(MEMBER, 'i-1');

      expect(client.get).toHaveBeenCalledWith(`import:meta:${MEMBER}:i-1`);
      expect(client.get).toHaveBeenCalledWith(`import:file:${MEMBER}:i-1`);
    });

    it.each([
      ['the details', null, sealedStatement()],
      ['the statement', JSON.stringify({ accountId: ACCOUNT }), null],
    ])('returns null when %s expired', async (_what, meta, file) => {
      const { client } = fakeClient();
      client.get.mockImplementation(holding(meta, file));

      expect(await storeOver(client).load(MEMBER, 'i-1')).toBeNull();
    });

    it.each([
      ['altered', 'k:AAAA:AAAA:AAAA'],
      ['not sealed at all', 'OFXHEADER:100'],
      [
        'a raw file, as an earlier release held it',
        crypto.encryptBytes(Buffer.from('OFXHEADER:100')),
      ],
      ['of another version', sealedStatement(STATEMENT, STATEMENT_VERSION + 1)],
      ['without a statement', crypto.encrypt(JSON.stringify({ v: STATEMENT_VERSION }))],
    ])('returns null when the held statement is %s', async (_what, held) => {
      const { client } = fakeClient();
      client.get.mockImplementation(holding(JSON.stringify({ accountId: ACCOUNT }), held));

      expect(await storeOver(client).load(MEMBER, 'i-1')).toBeNull();
    });

    it('returns null when the statement was sealed under a key that is gone', async () => {
      const { client } = fakeClient();
      const meta = JSON.stringify({ accountId: ACCOUNT });
      client.get.mockImplementation(
        holding(
          meta,
          testCryptoService('2').encrypt(
            JSON.stringify({ v: STATEMENT_VERSION, statement: STATEMENT }),
          ),
        ),
      );
      const onlyFirst = testCryptoService('1');
      onlyFirst.loadKeys(JSON.stringify({ '1': Buffer.alloc(32, 7).toString('base64') }), '1');

      expect(
        await new ImportStore(client as unknown as IORedis, onlyFirst).load(MEMBER, 'i-1'),
      ).toBeNull();
    });
  });

  describe('discard', () => {
    it('removes the statement and its details of the id, and forgets it as pending', async () => {
      const { client, chain } = fakeClient();

      await storeOver(client).discard(MEMBER, 'i-1');

      expect(chain.del).toHaveBeenCalledWith(
        `import:file:${MEMBER}:i-1`,
        `import:meta:${MEMBER}:i-1`,
      );
      expect(chain.zrem).toHaveBeenCalledWith(`import:pending:${MEMBER}`, 'i-1');
      expect(chain.exec).toHaveBeenCalled();
    });
  });

  describe('pending imports', () => {
    const exec = (held: number) => [
      [null, 'OK'],
      [null, 'OK'],
      [null, 0],
      [null, 1],
      [null, 1],
      [null, held],
    ];

    it('registers the upload under the Member until its hold ends', async () => {
      const { client, chain } = fakeClient();

      const importId = await storeOver(client).save(MEMBER, ACCOUNT, STATEMENT);

      expect(chain.zremrangebyscore).toHaveBeenCalledWith(
        `import:pending:${MEMBER}`,
        '-inf',
        expect.any(Number),
      );
      expect(chain.zadd).toHaveBeenCalledWith(
        `import:pending:${MEMBER}`,
        expect.any(Number),
        importId,
      );
      expect(chain.expire).toHaveBeenCalledWith(`import:pending:${MEMBER}`, IMPORT_HOLD_SECONDS);
    });

    it('keeps every upload while the Member is within the limit', async () => {
      const { client, chain } = fakeClient();
      chain.exec.mockResolvedValue(exec(MAX_PENDING_IMPORTS));

      await storeOver(client).save(MEMBER, ACCOUNT, STATEMENT);

      expect(client.zrange).not.toHaveBeenCalled();
      expect(chain.del).not.toHaveBeenCalled();
    });

    it('drops the oldest uploads past the limit', async () => {
      const { client, chain } = fakeClient();
      chain.exec.mockResolvedValueOnce(exec(MAX_PENDING_IMPORTS + 2));
      client.zrange.mockResolvedValue(['old-1', 'old-2']);

      await storeOver(client).save(MEMBER, ACCOUNT, STATEMENT);

      expect(client.zrange).toHaveBeenCalledWith(`import:pending:${MEMBER}`, '0', '1');
      expect(chain.del).toHaveBeenCalledWith(
        `import:file:${MEMBER}:old-1`,
        `import:meta:${MEMBER}:old-1`,
        `import:file:${MEMBER}:old-2`,
        `import:meta:${MEMBER}:old-2`,
      );
      expect(chain.zrem).toHaveBeenCalledWith(`import:pending:${MEMBER}`, 'old-1', 'old-2');
    });
  });

  describe('outcome', () => {
    const outcome = {
      importedCount: 2,
      skippedCount: 1,
      invalidCount: 0,
      rememberedCount: 1,
      notRememberedCount: 2,
      reconciledCount: 3,
    };

    it('keeps the result of an import under the Member and the id', async () => {
      const { client } = fakeClient();

      await storeOver(client).saveOutcome(MEMBER, 'i-1', outcome);

      expect(client.set).toHaveBeenCalledWith(
        `import:result:${MEMBER}:i-1`,
        JSON.stringify(outcome),
        'EX',
        IMPORT_HOLD_SECONDS,
      );
    });

    it('reads the stored result back', async () => {
      const { client } = fakeClient();
      client.get.mockResolvedValue(JSON.stringify(outcome));

      expect(await storeOver(client).loadOutcome(MEMBER, 'i-1')).toEqual(outcome);
      expect(client.get).toHaveBeenCalledWith(`import:result:${MEMBER}:i-1`);
    });

    it('returns null when no result is stored', async () => {
      const { client } = fakeClient();
      client.get.mockResolvedValue(null);

      expect(await storeOver(client).loadOutcome(MEMBER, 'i-1')).toBeNull();
    });
  });

  describe('confirmation lock', () => {
    it('is taken when nobody holds it, and returns the token of its holder', async () => {
      const { client } = fakeClient();

      const token = await storeOver(client).lockConfirmation(MEMBER, 'i-1');

      expect(token).toEqual(expect.any(String));
      expect(client.set).toHaveBeenCalledWith(`import:lock:${MEMBER}:i-1`, token, 'EX', 120, 'NX');
    });

    it('is refused while another confirmation holds it', async () => {
      const { client } = fakeClient();
      client.set.mockResolvedValue(null);

      expect(await storeOver(client).lockConfirmation(MEMBER, 'i-1')).toBeNull();
    });

    it('is released only with the token of its holder', async () => {
      const { client } = fakeClient();

      await storeOver(client).unlockConfirmation(MEMBER, 'i-1', 'token-1');

      expect(client.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call('get', KEYS[1]) == ARGV[1]"),
        1,
        `import:lock:${MEMBER}:i-1`,
        'token-1',
      );
    });
  });
});
