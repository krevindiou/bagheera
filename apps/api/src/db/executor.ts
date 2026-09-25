import { NodePgDatabase } from 'drizzle-orm/node-postgres';

// An open transaction, exposing the same query-builder surface as the plain
// db handle.
export type Executor = Parameters<NodePgDatabase['transaction']>[0] extends (tx: infer T) => unknown
  ? T
  : never;
