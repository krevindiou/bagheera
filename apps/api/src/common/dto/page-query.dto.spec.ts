// @Type() needs Reflect.getMetadata, which Nest loads at runtime but an
// isolated unit test doesn't.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PageQueryDto } from './page-query.dto';

async function validatePage(query: Record<string, unknown>) {
  const dto = plainToInstance(PageQueryDto, query);
  return { dto, errors: await validate(dto) };
}

describe('PageQueryDto', () => {
  it('defaults to page 1 when omitted', async () => {
    const { dto, errors } = await validatePage({});
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
  });

  it('coerces a numeric string to a number', async () => {
    const { dto, errors } = await validatePage({ page: '3' });
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(3);
  });

  it.each([['0'], ['-1'], ['1.5'], ['abc']])('rejects page=%s', async (page) => {
    const { errors } = await validatePage({ page });
    expect(errors).toHaveLength(1);
  });
});
