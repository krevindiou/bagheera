import { Writable } from 'node:stream';
import pino from 'pino';
import { LOG_REDACT_PATHS } from './redact-paths';

describe('LOG_REDACT_PATHS', () => {
  it('removes credentials and the CSRF token from a logged request', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _enc, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const logger = pino({ redact: { paths: LOG_REDACT_PATHS, remove: true } }, sink);

    logger.info({
      req: {
        headers: {
          cookie: 'bagheera.sid=secret',
          authorization: 'Bearer secret',
          'x-csrf-token': 'secret',
          'user-agent': 'kept',
        },
      },
      res: { headers: { 'set-cookie': ['bagheera.sid=secret'], 'content-type': 'kept' } },
    });

    const logged = JSON.parse(lines[0]) as {
      req: { headers: Record<string, string> };
      res: { headers: Record<string, string> };
    };
    expect(logged.req.headers).toEqual({ 'user-agent': 'kept' });
    expect(logged.res.headers).toEqual({ 'content-type': 'kept' });
  });
});
