import { BusinessError } from '../../common/filters/business-error';
import { OfxFormatError, OfxLimitError, OfxStatementError, parseOfx } from './ofx';
import { invalidFile, readStatement } from './import.file';

vi.mock('./ofx', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ofx')>()),
  parseOfx: vi.fn(),
}));

describe('readStatement', () => {
  const file = Buffer.from('ofx');

  const businessErrorOf = (fn: () => unknown) => {
    try {
      fn();
    } catch (err) {
      if (err instanceof BusinessError) return err.getResponse();
      throw err;
    }
    throw new Error('did not throw');
  };

  it('returns the statement it read', () => {
    const statement = { kind: 'bank', currency: 'EUR', rows: [] };
    vi.mocked(parseOfx).mockReturnValueOnce(statement as never);

    expect(readStatement(file)).toBe(statement);
  });

  it.each([
    ['a file with too many rows', new OfxLimitError(), 'import_too_many_rows'],
    [
      'a file with several statements',
      new OfxStatementError('several'),
      'import_statement_several',
    ],
    [
      'a statement of another kind',
      new OfxStatementError('unsupported'),
      'import_statement_unsupported',
    ],
    ['a file that is no OFX', new OfxFormatError(), 'import_file_invalid'],
  ])('answers %s with its business error', (_, failure, code) => {
    vi.mocked(parseOfx).mockImplementationOnce(() => {
      throw failure;
    });

    expect(businessErrorOf(() => readStatement(file))).toMatchObject({ code });
  });

  it('gives the number of rows allowed when there are too many', () => {
    vi.mocked(parseOfx).mockImplementationOnce(() => {
      throw new OfxLimitError();
    });

    expect(businessErrorOf(() => readStatement(file))).toMatchObject({
      params: { limit: expect.any(Number) as number },
    });
  });

  it('lets an unexpected failure through', () => {
    const failure = new Error('boom');
    vi.mocked(parseOfx).mockImplementationOnce(() => {
      throw failure;
    });

    expect(() => readStatement(file)).toThrow(failure);
  });
});

describe('invalidFile', () => {
  it('is a 400 import_file_invalid carrying the message', () => {
    const error = invalidFile('nope');

    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toMatchObject({ code: 'import_file_invalid', message: 'nope' });
  });
});
