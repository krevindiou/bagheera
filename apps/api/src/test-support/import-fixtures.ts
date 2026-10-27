// Shared by the bank file import integration specs.
import type { SignedInFixture } from './auth-fixture';
import type { Response } from 'supertest';
import { ofxFile, type TestTransaction } from './ofx-files';

export const NO_CHANGES = {};

const CHANGE_KEYS = [
  'labelChanges',
  'paymentMethodChanges',
  'categoryChanges',
  'transferAccountChanges',
] as const;

// Confirms the way the web does: with the revision of a preview worked out from
// the same changes. A preview that fails answers for the confirmation, which
// would fail the same way, and a held file that is gone only matters to a
// confirmation already carried out.
export async function confirmImport(
  fixture: SignedInFixture,
  importId: string,
  body: object = NO_CHANGES,
): Promise<Response> {
  const changes = Object.fromEntries(
    CHANGE_KEYS.flatMap((key) =>
      key in body ? [[key, (body as Record<string, unknown>)[key]]] : [],
    ),
  );
  const preview = await fixture.mutate('post', `/operations/import/${importId}/preview`, changes);
  const revision = preview.status === 200 ? (preview.body as Preview).revision : '0'.repeat(64);
  return fixture.mutate('post', `/operations/import/${importId}/confirm`, { ...body, revision });
}

export const FILE = [
  'Date;Amount;Label',
  '05/03/2026;-12,50;Bakery',
  '06/03/2026;1250,00;Employer',
  '07/03/2026;-3,00;Coffee',
].join('\n');

interface Upload {
  importId: string;
  rowCount: number;
}

export interface Preview {
  revision: string;
  importCount: number;
  skippedCount: number;
  invalidCount: number;
  statement: {
    periodStart: string | null;
    periodEnd: string | null;
    debitTotal: number;
    creditTotal: number;
    closing: { date: string; amount: number; expected: number | null } | null;
    accountCheck: string;
    otherAccountId: string | null;
  };
  rows: {
    line: number;
    status: string;
    paymentMethodOrigin: string | null;
    recorded: {
      valueDate: string;
      thirdParty: string;
      matchedBy: string;
      reconciled: boolean;
    } | null;
    reason: string | null;
    amount: number | null;
    thirdParty: string | null;
    sourceLabel: string | null;
    labelOrigin: string | null;
    paymentMethodId: string | null;
    categoryId: string | null;
    categoryOrigin: string | null;
    transferAccountId: string | null;
    transferAccountOrigin: string | null;
  }[];
}

export interface LabelChange {
  line: number;
  thirdParty: string;
  remember: boolean;
}

export async function createAccount(fixture: SignedInFixture): Promise<string> {
  const bank = await fixture.mutate('post', '/banks/choice', { name: 'Test bank' });
  const bankId = (bank.body as { id: string }).id;
  const account = await fixture.mutate('post', '/accounts', {
    bankId,
    name: 'Account',
    currency: 'EUR',
    initialBalance: 0,
  });
  return (account.body as { account: { id: string } }).account.id;
}

// Most tests describe a file as a header line, then one row per line:
// 'dd/MM/yyyy;amount;label[;row type[;bank reference]]'. A date or an amount
// that does not fit is passed on as written, for the importer to refuse.
export function bankFile(rows: string): Buffer {
  if (rows === '') return Buffer.alloc(0);
  const [, ...lines] = rows.split('\n');
  const transactions = lines
    .filter((line) => line !== '')
    .map((line): TestTransaction => {
      const [date, amount, label, type, reference] = line.split(';');
      const day = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(date);
      return {
        date: day ? `${day[3]}${day[2]}${day[1]}` : date,
        amount: amount.replace(',', '.'),
        name: label,
        ...(type ? { type } : {}),
        ...(reference ? { reference } : {}),
      };
    });
  return ofxFile(transactions);
}

export async function upload(
  fixture: SignedInFixture,
  accountId: string,
  content: string | Buffer,
): Promise<Response> {
  const token = await fixture.getCsrfToken();
  return fixture.agent
    .post('/operations/import')
    .set('x-csrf-token', token)
    .field('accountId', accountId)
    .attach('file', typeof content === 'string' ? bankFile(content) : content, 'bank.ofx');
}

export async function startImport(
  fixture: SignedInFixture,
  accountId: string,
  content: string | Buffer,
) {
  const res = await upload(fixture, accountId, content);
  expect(res.status).toBe(200);
  return res.body as Upload;
}
