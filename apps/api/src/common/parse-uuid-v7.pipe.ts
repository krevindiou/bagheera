import { ParseUUIDPipe } from '@nestjs/common';

// Every path/query id param in this API is a UUIDv7.
export const ParseUuidV7Pipe = new ParseUUIDPipe({ version: '7' });

// Optional id query param (e.g. `?bankId=`): omitted passes as undefined;
// a malformed one is a 400, not a Postgres 22P02 500.
export const ParseUuidV7PipeOptional = new ParseUUIDPipe({ version: '7', optional: true });
