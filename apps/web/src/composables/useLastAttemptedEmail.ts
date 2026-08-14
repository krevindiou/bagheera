// Remembers the last email address submitted on any auth form so the next
// one (e.g. sign-in after a failed registration, or forgot-password after
// a failed sign-in) starts prefilled instead of empty. Session-scoped —
// cleared when the tab closes.
const STORAGE_KEY = "bagheera.lastAttemptedEmail";

export function readLastAttemptedEmail(): string {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberAttemptedEmail(email: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, email);
  } catch {
    // Storage unavailable (private browsing, quota) — prefill is a
    // convenience, not a requirement, so failing silently is fine.
  }
}
