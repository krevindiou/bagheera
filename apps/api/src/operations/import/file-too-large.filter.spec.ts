import { PayloadTooLargeException } from '@nestjs/common';
import { vi } from 'vitest';
import { fakeArgumentsHost, fakeRequest, fakeResponse } from '../../test-support/fake-http-context';
import { PayloadTooLargeToBusinessError } from './file-too-large.filter';

vi.mock('@sentry/node');

describe('PayloadTooLargeToBusinessError', () => {
  it('answers the bare 413 with the business error of a file over the limit', async () => {
    const res = fakeResponse();

    await new PayloadTooLargeToBusinessError().catch(
      new PayloadTooLargeException(),
      fakeArgumentsHost(fakeRequest(), res),
    );

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 413, code: 'import_file_too_large' }),
    );
  });
});
