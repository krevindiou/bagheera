import { ParseUUIDPipe } from '@nestjs/common';

// Every path/query id param in this API is a UUIDv7 — one shared instance so
// controllers don't each repeat the `{ version: '7' }` option.
export const ParseUuidV7Pipe = new ParseUUIDPipe({ version: '7' });
