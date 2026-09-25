// Stable, machine-readable codes for the user-facing business errors, so
// clients can translate them instead of showing the English `message`. The
// message stays in the response as a fallback. Services keep throwing plain
// HttpExceptions with these exact messages; the exception filter attaches the
// code, so a reworded message must be updated here too (error-codes.spec.ts
// pins the table).
export const ERROR_CODE_BY_MESSAGE: Record<string, string> = {
  'Bank is not active.': 'bank_not_active',
  'Bank is already deleted.': 'bank_already_deleted',
  'Account is not active.': 'account_not_active',
  'Account is already deleted.': 'account_already_deleted',
  'Account cannot be changed.': 'account_cannot_be_changed',
  'Bank and currency cannot be changed.': 'bank_currency_immutable',
  'You must select a bank.': 'bank_required',
  'Opening operation cannot be edited.': 'opening_operation_locked',
  'Transfer account is not active.': 'transfer_account_not_active',
  'Transfer account currency mismatch.': 'transfer_currency_mismatch',
  'Invalid transfer account.': 'transfer_account_invalid',
  'Cannot transfer to the same account.': 'transfer_same_account',
  'Invalid payment method for this type.': 'payment_method_invalid',
  'Invalid category for this type.': 'category_invalid',
  'Step-up verification is required or has expired.': 'step_up_required',
  'Step-up verification failed.': 'step_up_failed',
  'Passkey registration failed.': 'passkey_registration_failed',
  'Passkey sign-in failed.': 'passkey_sign_in_failed',
  'Sign-up link is invalid or has expired.': 'signup_link_invalid',
  'Email change error (link expired or already used?)': 'email_change_link_invalid',
  'Cannot remove your last passkey — it would lock you out permanently.': 'last_passkey',
};

const QUOTA_MESSAGE = /^You can have at most (\d+) (\w+)\.$/;

export interface ErrorCode {
  code: string;
  params?: Record<string, string | number>;
}

export function errorCodeOf(message: string | string[]): ErrorCode | undefined {
  if (typeof message !== 'string') {
    return undefined;
  }
  const known = ERROR_CODE_BY_MESSAGE[message];
  if (known) {
    return { code: known };
  }
  const quota = QUOTA_MESSAGE.exec(message);
  if (quota) {
    return { code: 'quota_exceeded', params: { limit: Number(quota[1]), kind: quota[2] } };
  }
  return undefined;
}
