import { ParseUUIDPipe } from '@nestjs/common';

// Every path/query id param in this API is a UUIDv7 — one shared instance so
// controllers don't each repeat the `{ version: '7' }` option.
export const ParseUuidV7Pipe = new ParseUUIDPipe({ version: '7' });

// For an optional id query param (e.g. `?bankId=`): passes an omitted value
// through as undefined, but still rejects a *present*, malformed one with a
// 400 instead of letting a raw string reach a `uuid`-typed column, which
// Postgres rejects with 22P02 — a 500 (and Sentry noise) for what's really
// bad input.
export const ParseUuidV7PipeOptional = new ParseUUIDPipe({ version: '7', optional: true });
