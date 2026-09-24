import { UnprocessableEntityException } from '@nestjs/common';
import { MEMBER_QUOTAS, requireBelowQuota } from './member-quotas';

describe('requireBelowQuota', () => {
  it('lets a create through while the member holds fewer than the quota', () => {
    expect(() => requireBelowQuota('reports', MEMBER_QUOTAS.reports - 1)).not.toThrow();
  });

  it('refuses it once they hold the quota, naming the limit', () => {
    expect(() => requireBelowQuota('banks', MEMBER_QUOTAS.banks)).toThrow(
      new UnprocessableEntityException(`You can have at most ${MEMBER_QUOTAS.banks} banks.`),
    );
  });
});
