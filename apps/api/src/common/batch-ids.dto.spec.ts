import { validate } from 'class-validator';
import { BatchIdsDto } from './batch-ids.dto';

const UUID_1 = '00000000-0000-7000-8000-000000000001';
const UUID_2 = '00000000-0000-7000-8000-000000000002';
const UUID_3 = '00000000-0000-7000-8000-000000000003';

describe('BatchIdsDto', () => {
  it('accepts a non-empty array of UUIDv7 ids under the cap', async () => {
    const dto = Object.assign(new BatchIdsDto(), {
      ids: [UUID_1, UUID_2, UUID_3],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an empty array', async () => {
    const dto = Object.assign(new BatchIdsDto(), { ids: [] });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('arrayNotEmpty');
  });

  it('rejects an array over the 500-item cap', async () => {
    const dto = Object.assign(new BatchIdsDto(), {
      ids: Array.from(
        { length: 501 },
        (_, i) => `00000000-0000-7000-8000-${String(i).padStart(12, '0')}`,
      ),
    });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('arrayMaxSize');
  });

  it('rejects a non-UUID id', async () => {
    const dto = Object.assign(new BatchIdsDto(), { ids: [0] });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('isUuid');
  });

  it('rejects a non-v7 UUID', async () => {
    // A well-formed UUIDv4 — wrong version nibble.
    const dto = Object.assign(new BatchIdsDto(), {
      ids: ['00000000-0000-4000-8000-000000000001'],
    });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('isUuid');
  });
});
