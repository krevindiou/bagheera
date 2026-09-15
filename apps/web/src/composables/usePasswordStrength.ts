// Heuristic password-strength scoring for the strength meter shown next to
// new-password fields. The meter's own bar/label is still just a live
// preview — but its weakest tier ("weak", score < 2) is also the actual
// gate the Zod schemas enforce (see passwordValidationKey below and each
// schema's `password` refine): the meter never shows "Weak" for a value
// that's still accepted. The 8–4096 length rule is separate and checked
// first, independent of scoring.

export type PasswordStrengthLabel = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: PasswordStrengthLabel;
}

const LABELS: PasswordStrengthLabel[] = ['weak', 'weak', 'fair', 'good', 'strong'];

export function getPasswordStrength(password: string): PasswordStrength {
  const varietyCount = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((pattern) =>
    pattern.test(password),
  ).length;

  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (password.length >= 16 && varietyCount >= 4) score = 4;
  else if (password.length >= 12 && varietyCount >= 3) score = 3;
  else if (password.length >= 8 && varietyCount >= 2) score = 2;
  else if (password.length >= 8) score = 1;

  return { score, label: LABELS[score] };
}

// The i18n key a new-password field should show for a length/refine
// failure — decided from the value itself (mirrors amountErrorKey in
// OperationForm.vue/SchedulerForm.vue) rather than parsed out of
// vee-validate's resolved zod message, which none of these forms otherwise
// inspect. Length is checked first: a too-short password is "too short,"
// full stop, even if what little of it exists happens to mix classes.
export function passwordValidationKey(
  password: string,
): 'auth.validation.passwordLength' | 'auth.validation.passwordWeak' {
  return password.length < 8 ? 'auth.validation.passwordLength' : 'auth.validation.passwordWeak';
}
