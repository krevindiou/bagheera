import { getTableColumns, type Table } from 'drizzle-orm';

// A table's columns minus `keys`, as a select/returning shape — for a
// response that must not carry an internal column (e.g. a cursor) without
// listing every other column by hand, so a column added later still flows
// through (and trips the DTO's SameKeys guard until the DTO declares it).
export function columnsExcept<T extends Table, K extends keyof T['_']['columns']>(
  table: T,
  ...keys: K[]
): Omit<T['_']['columns'], K> {
  const columns: Partial<T['_']['columns']> = { ...getTableColumns(table) };
  for (const key of keys) {
    delete columns[key];
  }
  return columns as Omit<T['_']['columns'], K>;
}
