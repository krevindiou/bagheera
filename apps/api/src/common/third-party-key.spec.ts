import { PgDialect } from 'drizzle-orm/pg-core';
import { operation } from '../db/schema';
import { thirdPartyKeyOf, TRIMMED_CHARACTER_CODES } from './third-party-key';

describe('third-party key', () => {
  it('trims exactly what String.prototype.trim trims', () => {
    const trimmedByJs: number[] = [];
    for (let code = 0; code <= 0xffff; code++) {
      if (String.fromCharCode(code).trim() === '') trimmedByJs.push(code);
    }
    expect([...TRIMMED_CHARACTER_CODES].sort((a, b) => a - b)).toEqual(trimmedByJs);
  });

  it('spells its trim set as a literal, so that an expression index serves it', () => {
    const { sql, params } = new PgDialect().sqlToQuery(thirdPartyKeyOf(operation.thirdParty));
    expect(sql).toMatch(/^lower\(btrim\("operation"\."third_party", E'(\\u[0-9a-f]{4})+'\)\)$/);
    expect(params).toEqual([]);
  });
});
