import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateReportDto } from './create-report.dto';

describe('CreateReportDto', () => {
  const valid = { type: 'sum', title: 'Groceries', periodGrouping: 'month' };

  async function errorsFor(dates: { valueDateStart?: string; valueDateEnd?: string }) {
    return validate(plainToInstance(CreateReportDto, { ...valid, ...dates }));
  }

  it('accepts an end date after or equal to the start date', async () => {
    expect(await errorsFor({ valueDateStart: '2026-01-01', valueDateEnd: '2026-02-01' })).toEqual(
      [],
    );
    expect(await errorsFor({ valueDateStart: '2026-01-01', valueDateEnd: '2026-01-01' })).toEqual(
      [],
    );
  });

  it('rejects an end date before the start date', async () => {
    const errors = await errorsFor({ valueDateStart: '2026-02-01', valueDateEnd: '2026-01-31' });
    expect(errors[0]?.constraints).toEqual({
      isOnOrAfter: 'valueDateEnd must be on or after valueDateStart',
    });
  });

  it('leaves an open-ended range alone', async () => {
    expect(await errorsFor({ valueDateEnd: '2026-01-31' })).toEqual([]);
    expect(await errorsFor({ valueDateStart: '2026-02-01' })).toEqual([]);
  });
});
