export interface UserAgentSummary {
  browser: string | null;
  os: string | null;
}

// First match wins: most browsers also claim to be the ones listed after
// them (Edge says Chrome and Safari, Chrome says Safari).
const BROWSERS: [RegExp, string][] = [
  [/\bEdg(e|A|iOS)?\//, 'Edge'],
  [/\b(OPR|Opera)\//, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\b(Firefox|FxiOS)\//, 'Firefox'],
  [/\b(Chrome|CriOS|Chromium)\//, 'Chrome'],
  [/\bVersion\/[\d.]+.*\bSafari\//, 'Safari'],
];

// iOS and Android before the desktop systems their user agents also name.
const SYSTEMS: [RegExp, string][] = [
  [/\b(iPhone|iPad|iPod)\b/, 'iOS'],
  [/\bAndroid\b/, 'Android'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bWindows\b/, 'Windows'],
  [/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
  [/\bLinux\b/, 'Linux'],
];

function firstMatch(userAgent: string, rules: [RegExp, string][]): string | null {
  return rules.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;
}

// Real user agents stay well under this. It bounds what a client can make
// the store keep, and the regex work every signed-in request does on it.
export const USER_AGENT_MAX_LENGTH = 512;

/** Browser and OS names good enough to tell a member's devices apart; null when unknown. */
export function describeUserAgent(userAgent: string | null | undefined): UserAgentSummary {
  if (!userAgent) {
    return { browser: null, os: null };
  }
  const capped = userAgent.slice(0, USER_AGENT_MAX_LENGTH);
  return { browser: firstMatch(capped, BROWSERS), os: firstMatch(capped, SYSTEMS) };
}

/** Same browser on the same system; versions don't count, since browsers update mid-session. */
export function sameDevice(
  signedIn: string | null | undefined,
  current: string | null | undefined,
): boolean {
  const before = describeUserAgent(signedIn);
  const now = describeUserAgent(current);
  return before.browser === now.browser && before.os === now.os;
}
