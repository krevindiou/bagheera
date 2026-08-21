// Heuristic password-strength scoring for the strength meter shown next to
// new-password fields. This is UX feedback only — it never blocks
// submission; the spec's actual rule (8–4096 characters) stays enforced by
// the Zod schemas.

export type PasswordStrengthLabel = "weak" | "fair" | "good" | "strong";

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: PasswordStrengthLabel;
}

const LABELS: PasswordStrengthLabel[] = ["weak", "weak", "fair", "good", "strong"];

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
