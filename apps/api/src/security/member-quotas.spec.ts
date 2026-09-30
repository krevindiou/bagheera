import { BusinessError } from '../common/filters/business-error';
import { MEMBER_QUOTAS, requireBelowQuota } from './member-quotas';

describe('requireBelowQuota', () => {
  it('lets a create through while the member holds fewer than the quota', () => {
    expect(() => requireBelowQuota('reports', MEMBER_QUOTAS.reports - 1)).not.toThrow();
  });

  it('refuses it once they hold the quota, naming the limit and kind in code params', () => {
    expect(() => requireBelowQuota('banks', MEMBER_QUOTAS.banks)).toThrow(
      `You can have at most ${MEMBER_QUOTAS.banks} banks.`,
    );
    try {
      requireBelowQuota('banks', MEMBER_QUOTAS.banks);
    } catch (err) {
      expect(err).toBeInstanceOf(BusinessError);
      expect((err as BusinessError).getResponse()).toMatchObject({
        code: 'quota_exceeded',
        params: { limit: MEMBER_QUOTAS.banks, kind: 'banks' },
      });
    }
  });
});
