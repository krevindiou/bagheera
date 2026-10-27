import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { asc, eq } from 'drizzle-orm';
import { IMPORT_LIMITS } from '@bagheera/reference-data';
import type IORedis from 'ioredis';
import { VALKEY_CLIENT } from '../../session/session.constants';
import { labelCorrection, operation } from '../../db/schema';
import { seedSignedInMember } from '../../test-support/auth-fixture';
import { createTestApp, getDb } from '../../test-support/create-test-app';
import { CryptoService } from '../../security/crypto.service';
import { ImportStore, MAX_PENDING_IMPORTS, STATEMENT_VERSION } from './import.store';
import { ofxFile } from '../../test-support/ofx-files';
import {
  FILE,
  NO_CHANGES,
  type Preview,
  bankFile,
  confirmImport,
  createAccount,
  startImport,
  upload,
} from '../../test-support/import-fixtures';

// What the store holds of an upload, once decrypted.
interface HeldStatement {
  v: number;
  statement: { rows: Record<string, unknown>[] };
}

describe('bank file import: upload, limits and release', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  const operationsOf = (accountId: string) =>
    getDb(app)
      .select()
      .from(operation)
      .where(eq(operation.accountId, accountId))
      .orderBy(asc(operation.valueDate));

  describe('POST /operations/import', () => {
    it('reads the file and returns its row count', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);

      const body = await startImport(fixture, accountId, FILE);

      expect(body.rowCount).toBe(3);
      expect(body.importId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('creates no operation yet', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      await startImport(fixture, accountId, FILE);
      expect(await operationsOf(accountId)).toHaveLength(0);
    });

    it.each([
      ['an empty file', ''],
      ['a statement with no row', 'Date;Amount;Label\n'],
      ['a file that is not OFX', Buffer.from('Date;Amount;Label\n05/03/2026;-1;x\n')],
      ['an OFX file without a statement', Buffer.from('OFXHEADER:100\n\n<OFX>\n</OFX>')],
      [
        'an unsupported version',
        Buffer.from(ofxFile([]).toString('latin1').replace('VERSION:102', 'VERSION:300'), 'latin1'),
      ],
      [
        'text that is not valid in the declared UTF-8',
        Buffer.from(
          ofxFile([{ date: '20260305', amount: '-1', name: 'Bakery' }], { charset: 'utf-8' })
            .toString('latin1')
            .replace('Bakery', 'Caf\xe9'),
          'latin1',
        ),
      ],
    ])('refuses %s', async (_name, content) => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const res = await upload(fixture, accountId, content);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'import_file_invalid' });
    });

    it('accepts exactly the row limit and refuses one more', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const rows = (count: number) =>
        ['d;a;t', ...Array.from({ length: count }, (_, i) => `01/01/2026;-1;Shop ${i}`)].join('\n');

      const ok = await upload(fixture, accountId, rows(IMPORT_LIMITS.MAX_ROWS));
      expect(ok.status).toBe(200);
      const tooMany = await upload(fixture, accountId, rows(IMPORT_LIMITS.MAX_ROWS + 1));
      expect(tooMany.status).toBe(400);
      expect(tooMany.body).toMatchObject({ code: 'import_too_many_rows' });
    });

    it.each([
      ['a NUL character in a label', (text: string) => text.replace('Bakery', 'Bak\u0000ery')],
      [
        'a currency that is not three letters',
        (text: string) => text.replace('<CURDEF>EUR', '<CURDEF>EURO'),
      ],
    ])('refuses %s at upload, not at confirmation', async (_name, change) => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const text = ofxFile([{ date: '20260305', amount: '-1', name: 'Bakery' }]).toString('latin1');
      const res = await upload(fixture, accountId, Buffer.from(change(text), 'latin1'));
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'import_file_invalid' });
    });

    describe('the statement', () => {
      const row = { date: '20260305', amount: '-1', name: 'Bakery' };
      const refused = async (content: Buffer) => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        return upload(fixture, accountId, content);
      };

      it('refuses a statement in another currency than the account, naming both', async () => {
        const res = await refused(ofxFile([row], { currency: 'USD' }));
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({
          code: 'import_statement_currency',
          params: { expected: 'EUR', found: 'USD' },
        });
      });

      it('refuses a file holding several statements', async () => {
        const text = ofxFile([row]).toString('latin1');
        const second = text.slice(text.indexOf('<STMTTRNRS>'), text.indexOf('</STMTTRNRS>') + 12);
        const res = await refused(
          Buffer.from(text.replace('</BANKMSGSRSV1>', `${second}\n</BANKMSGSRSV1>`), 'latin1'),
        );
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code: 'import_statement_several' });
      });

      it('refuses a statement that is neither of a bank account nor of a credit card', async () => {
        const text = ofxFile([row])
          .toString('latin1')
          .replace(/STMTRS/g, 'INVSTMTRS');
        const res = await refused(Buffer.from(text, 'latin1'));
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code: 'import_statement_unsupported' });
      });

      it.each([
        ['a version 2.x file', { version: 2 }],
        ['a credit-card statement', { kind: 'creditcard' }],
        ['a UTF-8 file', { charset: 'utf-8' }],
      ] as const)('accepts %s', async (_name, options) => {
        const res = await refused(ofxFile([row], options));
        expect(res.status).toBe(200);
      });

      it('reads a declared entity as plain text, never resolving it', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        const text = ofxFile([{ ...row, name: '&xxe;' }], { version: 2 })
          .toString('latin1')
          .replace('<OFX>', '<!DOCTYPE OFX [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>\n<OFX>');
        const { importId } = await startImport(fixture, accountId, Buffer.from(text, 'latin1'));
        const preview = await fixture.mutate(
          'post',
          `/operations/import/${importId}/preview`,
          NO_CHANGES,
        );
        expect((preview.body as Preview).rows[0]).toMatchObject({ thirdParty: '&xxe;' });
      });
    });

    it('refuses a request carrying more than the file and the account id', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const token = await fixture.getCsrfToken();
      const res = await fixture.agent
        .post('/operations/import')
        .set('x-csrf-token', token)
        .field('accountId', accountId)
        .field('extra', 'x')
        .attach('file', bankFile(FILE), 'bank.ofx');
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it('refuses a file over 5 MiB, just over and far over', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      for (const size of [IMPORT_LIMITS.MAX_FILE_BYTES + 1, IMPORT_LIMITS.MAX_FILE_BYTES * 2]) {
        const res = await upload(fixture, accountId, Buffer.alloc(size, 'a'));
        expect(res.status).toBe(413);
        expect(res.body).toMatchObject({ code: 'import_file_too_large' });
      }
    });

    it("answers not found for another member's account", async () => {
      const owner = await seedSignedInMember(app);
      const accountId = await createAccount(owner);
      const other = await seedSignedInMember(app);
      const res = await upload(other, accountId, FILE);
      expect(res.status).toBe(404);
    });

    it('refuses a closed account', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      await fixture.mutate('post', `/accounts/${accountId}/close`);
      const res = await upload(fixture, accountId, FILE);
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'account_not_active' });
    });
  });

  describe('throttling (NFR-008)', () => {
    it('keeps the previews off the write budget, so a file reviewed at length can still be confirmed', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, FILE);
      const preview = () => fixture.mutate('post', `/operations/import/${importId}/preview`, {});
      const { revision } = (await preview()).body as Preview;

      const statuses: number[] = [];
      for (let i = 0; i < 60; i++) statuses.push((await preview()).status);

      // The 61st preview in the minute is refused, the 1st was the one above.
      expect(statuses.slice(0, 59).every((status) => status === 200)).toBe(true);
      expect(statuses[59]).toBe(429);
      const res = await fixture.mutate('post', `/operations/import/${importId}/confirm`, {
        revision,
      });
      expect(res.status).toBe(200);
      expect(await operationsOf(accountId)).toHaveLength(3);
    });
  });

  describe('DELETE /operations/import/:importId', () => {
    it('discards the held file', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, FILE);

      const res = await fixture.mutate('delete', `/operations/import/${importId}`);
      expect(res.status).toBe(200);

      const preview = await fixture.mutate(
        'post',
        `/operations/import/${importId}/preview`,
        NO_CHANGES,
      );
      expect(preview.status).toBe(404);
    });
  });

  describe('limits (NFR-019, NFR-021)', () => {
    it('previews the largest allowed file within 5 seconds', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const rows = Array.from(
        { length: IMPORT_LIMITS.MAX_ROWS },
        (_, i) => `${String((i % 28) + 1).padStart(2, '0')}/03/2026;-${i + 1},25;Shop number ${i}`,
      );
      const { importId } = await startImport(fixture, accountId, ['d;a;l', ...rows].join('\n'));

      const started = performance.now();
      const res = await fixture.mutate(
        'post',
        `/operations/import/${importId}/preview`,
        NO_CHANGES,
      );

      expect(performance.now() - started).toBeLessThan(5000);
      expect((res.body as Preview).importCount).toBe(IMPORT_LIMITS.MAX_ROWS);
    });

    it('takes the choices made on every row of the largest file, a body past the default limit', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const rows = Array.from(
        { length: IMPORT_LIMITS.MAX_ROWS },
        (_, i) => `${String((i % 28) + 1).padStart(2, '0')}/03/2026;-${i + 1},25;Shop number ${i}`,
      );
      const { importId } = await startImport(fixture, accountId, ['d;a;l', ...rows].join('\n'));
      const labelChanges = rows.map((_, i) => ({
        line: i + 1,
        thirdParty: `Renamed shop number ${i}`,
        remember: false,
      }));
      expect(JSON.stringify({ labelChanges }).length).toBeGreaterThan(100 * 1024);

      const res = await fixture.mutate('post', `/operations/import/${importId}/preview`, {
        labelChanges,
      });

      expect(res.status).toBe(200);
      expect((res.body as Preview).rows[0]).toMatchObject({ thirdParty: 'Renamed shop number 0' });
    });

    it('keeps every other route to the default body limit', async () => {
      const fixture = await seedSignedInMember(app);

      const res = await fixture.mutate('post', '/banks/choice', { name: 'x'.repeat(150 * 1024) });

      expect(res.status).toBe(413);
    });

    it('previews the largest file within 5 seconds with 1,000 corrections to apply', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const rows = Array.from(
        { length: IMPORT_LIMITS.MAX_ROWS },
        (_, i) =>
          `${String((i % 28) + 1).padStart(2, '0')}/03/2026;-${i + 1},25;Shop number ${i % 1000}`,
      );
      await getDb(app)
        .insert(labelCorrection)
        .values(
          Array.from({ length: IMPORT_LIMITS.MAX_LABEL_CORRECTIONS }, (_, i) => ({
            memberId: fixture.memberId,
            sourceLabel: `Shop number ${i}`,
            thirdParty: `Corrected ${i}`,
          })),
        );
      const { importId } = await startImport(fixture, accountId, ['d;a;l', ...rows].join('\n'));

      const started = performance.now();
      const res = await fixture.mutate(
        'post',
        `/operations/import/${importId}/preview`,
        NO_CHANGES,
      );

      expect(performance.now() - started).toBeLessThan(5000);
      const body = res.body as Preview;
      expect(body.importCount).toBe(IMPORT_LIMITS.MAX_ROWS);
      expect(body.rows.every((row) => row.labelOrigin === 'correction')).toBe(true);
    });

    it('holds the file for at most 30 minutes and drops it once the import ends', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const valkey = app.get<IORedis>(VALKEY_CLIENT);

      const { importId } = await startImport(fixture, accountId, FILE);
      const key = `import:file:${fixture.memberId}:${importId}`;
      const ttl = await valkey.ttl(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(30 * 60);

      await confirmImport(fixture, importId, NO_CHANGES);
      expect(await valkey.exists(key)).toBe(0);
    });

    it('holds the statement encrypted', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const valkey = app.get<IORedis>(VALKEY_CLIENT);

      const { importId } = await startImport(fixture, accountId, FILE);

      const held = (await valkey.get(`import:file:${fixture.memberId}:${importId}`)) ?? '';
      expect(held).not.toBe('');
      for (const word of ['Bakery', 'Employer', 'OFX']) {
        expect(held).not.toContain(word);
        expect(Buffer.from(held, 'base64').toString('latin1')).not.toContain(word);
      }
    });

    it('previews the statement it holds, without reading the file again', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const valkey = app.get<IORedis>(VALKEY_CLIENT);
      const { importId } = await startImport(fixture, accountId, FILE);
      const key = `import:file:${fixture.memberId}:${importId}`;
      const held = JSON.parse(
        app.get(CryptoService).decrypt((await valkey.get(key)) ?? ''),
      ) as HeldStatement;
      held.statement.rows = [{ ...held.statement.rows[0], name: 'Held Row' }];
      await valkey.set(key, app.get(CryptoService).encrypt(JSON.stringify(held)), 'EX', 60);

      const res = await fixture.mutate('post', `/operations/import/${importId}/preview`, {});

      expect(res.status).toBe(200);
      const { rows } = res.body as Preview;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ thirdParty: 'Held Row' });
    });

    it('treats a statement held in another version as no longer available', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const valkey = app.get<IORedis>(VALKEY_CLIENT);
      const { importId } = await startImport(fixture, accountId, FILE);
      const key = `import:file:${fixture.memberId}:${importId}`;
      const held = JSON.parse(
        app.get(CryptoService).decrypt((await valkey.get(key)) ?? ''),
      ) as HeldStatement;
      held.v = STATEMENT_VERSION + 1;
      await valkey.set(key, app.get(CryptoService).encrypt(JSON.stringify(held)), 'EX', 60);

      const res = await fixture.mutate('post', `/operations/import/${importId}/preview`, {});

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'import_not_found' });
    });

    it('treats a held statement that can no longer be decrypted as no longer available', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const valkey = app.get<IORedis>(VALKEY_CLIENT);
      const { importId } = await startImport(fixture, accountId, FILE);
      await valkey.set(`import:file:${fixture.memberId}:${importId}`, '1:AAAA:AAAA:AAAA', 'EX', 60);

      const res = await fixture.mutate('post', `/operations/import/${importId}/preview`, {});

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'import_not_found' });
    });

    it('keeps a first import usable when a second file is uploaded', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const first = await startImport(fixture, accountId, FILE);
      await startImport(fixture, accountId, FILE);

      const res = await confirmImport(fixture, first.importId, NO_CHANGES);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ importedCount: 3, alreadyImported: false });
    });

    it('releases the confirmation lock only for its holder', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, FILE);
      const store = app.get(ImportStore);
      const valkey = app.get<IORedis>(VALKEY_CLIENT);
      const key = `import:lock:${fixture.memberId}:${importId}`;

      const mine = await store.lockConfirmation(fixture.memberId, importId);
      await store.unlockConfirmation(fixture.memberId, importId, 'someone-else');
      expect(await valkey.exists(key)).toBe(1);
      await store.unlockConfirmation(fixture.memberId, importId, mine as string);
      expect(await valkey.exists(key)).toBe(0);
    });

    it('drops the file when the import is abandoned', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const valkey = app.get<IORedis>(VALKEY_CLIENT);
      const { importId } = await startImport(fixture, accountId, FILE);

      await fixture.mutate('delete', `/operations/import/${importId}`);

      expect(await valkey.exists(`import:file:${fixture.memberId}:${importId}`)).toBe(0);
    });

    it('keeps at most a few uploads waiting, the oldest making room for a new one', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const valkey = app.get<IORedis>(VALKEY_CLIENT);
      const fileKey = (importId: string) => `import:file:${fixture.memberId}:${importId}`;

      const ids: string[] = [];
      for (let upload = 0; upload < MAX_PENDING_IMPORTS + 2; upload++) {
        ids.push((await startImport(fixture, accountId, FILE)).importId);
      }

      const [dropped, kept] = [ids.slice(0, 2), ids.slice(2)];
      for (const importId of dropped) expect(await valkey.exists(fileKey(importId))).toBe(0);
      for (const importId of kept) expect(await valkey.exists(fileKey(importId))).toBe(1);
      expect(await valkey.zcard(`import:pending:${fixture.memberId}`)).toBe(MAX_PENDING_IMPORTS);

      await fixture.mutate('delete', `/operations/import/${kept[0]}`);
      expect(await valkey.zcard(`import:pending:${fixture.memberId}`)).toBe(
        MAX_PENDING_IMPORTS - 1,
      );
      const gone = await fixture.mutate('post', `/operations/import/${dropped[0]}/preview`, {});
      expect(gone.status).toBe(404);
    });
  });
});
