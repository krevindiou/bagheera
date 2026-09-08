import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BatchIdsDto } from './batch-ids.dto';

// A structurally valid UUIDv7 (version nibble '7', variant nibble '8') —
// class-validator's IsUUID('7') only checks those bits, not real entropy.
const UUID_V7 = '00000000-0000-7000-8000-000000000001';
const UUID_V4 = '9c858901-8a57-4791-81fe-4c455b099bc9';

describe('BatchIdsDto', () => {
  it('accepts a non-empty array of UUIDv7 ids', async () => {
    const dto = plainToInstance(BatchIdsDto, { ids: [UUID_V7] });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects an empty array', async () => {
    const dto = plainToInstance(BatchIdsDto, { ids: [] });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('arrayNotEmpty');
  });

  it('rejects more than 500 ids', async () => {
    const dto = plainToInstance(BatchIdsDto, {
      ids: Array.from({ length: 501 }, () => UUID_V7),
    });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('arrayMaxSize');
  });

  it('accepts exactly 500 ids', async () => {
    const dto = plainToInstance(BatchIdsDto, {
      ids: Array.from({ length: 500 }, () => UUID_V7),
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects a non-UUID entry', async () => {
    const dto = plainToInstance(BatchIdsDto, { ids: ['not-a-uuid'] });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('isUuid');
  });

  it('rejects a UUID of the wrong version', async () => {
    const dto = plainToInstance(BatchIdsDto, { ids: [UUID_V4] });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('isUuid');
  });
});
