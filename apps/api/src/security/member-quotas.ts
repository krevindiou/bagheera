import { UnprocessableEntityException } from '@nestjs/common';

/**
 * The most of each thing one member can hold — deleted ones aside, closed
 * ones included. Far beyond what a real household keeps; low enough that a
 * script can't pile rows up without end. Schedulers matter most, since each
 * one keeps generating operations on its own.
 */
export const MEMBER_QUOTAS = {
  banks: 50,
  accounts: 200,
  schedulers: 200,
  reports: 100,
} as const;

export type QuotaKind = keyof typeof MEMBER_QUOTAS;

/** Refuses a create that would take the member past their quota of `kind`. */
export function requireBelowQuota(kind: QuotaKind, held: number): void {
  const limit = MEMBER_QUOTAS[kind];
  if (held >= limit) {
    throw new UnprocessableEntityException(`You can have at most ${limit} ${kind}.`);
  }
}
