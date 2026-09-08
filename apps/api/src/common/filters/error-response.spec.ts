import { categorize } from './error-response';

describe('categorize', () => {
  it('maps 400 to validation_error', () => {
    expect(categorize(400)).toBe('validation_error');
  });

  it('maps 403 to access_denied', () => {
    expect(categorize(403)).toBe('access_denied');
  });

  it('maps 422 to access_denied', () => {
    expect(categorize(422)).toBe('access_denied');
  });

  it('maps 404 to not_found', () => {
    expect(categorize(404)).toBe('not_found');
  });

  it('maps anything else, including 401 and 500, to error', () => {
    expect(categorize(401)).toBe('error');
    expect(categorize(500)).toBe('error');
    expect(categorize(418)).toBe('error');
  });
});
