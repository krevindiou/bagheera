import { getTableColumns } from 'drizzle-orm';
import { columnsExcept } from './columns';
import { scheduler } from './schema';

describe('columnsExcept', () => {
  it("returns the table's own column objects, minus the excluded keys", () => {
    const columns = columnsExcept(scheduler, 'lastGeneratedDate', 'notes');
    const all = getTableColumns(scheduler);

    expect(Object.keys(columns).sort()).toEqual(
      Object.keys(all)
        .filter((key) => key !== 'lastGeneratedDate' && key !== 'notes')
        .sort(),
    );
    expect(columns.id).toBe(all.id);
  });

  it("doesn't mutate the table's own column map", () => {
    columnsExcept(scheduler, 'lastGeneratedDate');
    expect(getTableColumns(scheduler)).toHaveProperty('lastGeneratedDate');
  });
});
