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

/** Browser and OS names good enough to tell a member's devices apart; null when unknown. */
export function describeUserAgent(userAgent: string | null | undefined): UserAgentSummary {
  if (!userAgent) {
    return { browser: null, os: null };
  }
  return { browser: firstMatch(userAgent, BROWSERS), os: firstMatch(userAgent, SYSTEMS) };
}
