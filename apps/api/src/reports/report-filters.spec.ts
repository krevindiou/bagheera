import { reportOperationConditions } from './report-filters';
import { report } from '../db/schema';

type ReportPick = Pick<
  typeof report.$inferSelect,
  'valueDateStart' | 'valueDateEnd' | 'thirdParties' | 'reconciledOnly'
>;

const baseReport: ReportPick = {
  valueDateStart: null,
  valueDateEnd: null,
  thirdParties: null,
  reconciledOnly: false,
};

describe('reportOperationConditions', () => {
  it('always scopes to the given account ids, even with no other filters set', () => {
    const conditions = reportOperationConditions(baseReport, ['account-1', 'account-2']);
    expect(conditions).toHaveLength(1);
  });

  it('adds a lower bound when valueDateStart is set', () => {
    const conditions = reportOperationConditions({ ...baseReport, valueDateStart: '2026-01-01' }, [
      'account-1',
    ]);
    expect(conditions).toHaveLength(2);
  });

  it('adds an upper bound when valueDateEnd is set', () => {
    const conditions = reportOperationConditions({ ...baseReport, valueDateEnd: '2026-12-31' }, [
      'account-1',
    ]);
    expect(conditions).toHaveLength(2);
  });

  it('adds a third-party text search when thirdParties is set', () => {
    const conditions = reportOperationConditions({ ...baseReport, thirdParties: 'landlord' }, [
      'account-1',
    ]);
    expect(conditions).toHaveLength(2);
  });

  it('adds a reconciled-only condition when reconciledOnly is true', () => {
    const conditions = reportOperationConditions({ ...baseReport, reconciledOnly: true }, [
      'account-1',
    ]);
    expect(conditions).toHaveLength(2);
  });

  it('omits the category condition when categoryIds is left at its default (empty)', () => {
    const conditions = reportOperationConditions(baseReport, ['account-1']);
    expect(conditions).toHaveLength(1);
  });

  it('adds a category condition when categoryIds is non-empty', () => {
    const conditions = reportOperationConditions(baseReport, ['account-1'], ['cat-1', 'cat-2']);
    expect(conditions).toHaveLength(2);
  });

  it('combines every filter when all are set', () => {
    const conditions = reportOperationConditions(
      {
        valueDateStart: '2026-01-01',
        valueDateEnd: '2026-12-31',
        thirdParties: 'landlord',
        reconciledOnly: true,
      },
      ['account-1'],
      ['cat-1'],
    );
    // accountIds + start + end + thirdParties + reconciledOnly + categoryIds
    expect(conditions).toHaveLength(6);
  });
});
