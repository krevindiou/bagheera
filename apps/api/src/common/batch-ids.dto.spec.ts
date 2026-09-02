import { validate } from 'class-validator';
import { BatchIdsDto } from './batch-ids.dto';

describe('BatchIdsDto', () => {
  it('accepts a non-empty array of positive ints under the cap', async () => {
    const dto = Object.assign(new BatchIdsDto(), { ids: [1, 2, 3] });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an empty array', async () => {
    const dto = Object.assign(new BatchIdsDto(), { ids: [] });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('arrayNotEmpty');
  });

  it('rejects an array over the 500-item cap', async () => {
    const dto = Object.assign(new BatchIdsDto(), {
      ids: Array.from({ length: 501 }, (_, i) => i + 1),
    });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('arrayMaxSize');
  });

  it('rejects a non-positive id', async () => {
    const dto = Object.assign(new BatchIdsDto(), { ids: [0] });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('min');
  });

  it('rejects a non-integer id', async () => {
    const dto = Object.assign(new BatchIdsDto(), { ids: [1.5] });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('isInt');
  });
});
