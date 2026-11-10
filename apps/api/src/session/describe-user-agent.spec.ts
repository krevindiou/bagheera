import { describeUserAgent, sameDevice } from './describe-user-agent';

describe('describeUserAgent', () => {
  it.each([
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Chrome',
      'Windows',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
      'Edge',
      'Windows',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
      'Safari',
      'macOS',
    ],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0', 'Firefox', 'Linux'],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
      'Safari',
      'iOS',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
      'Chrome',
      'iOS',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
      'Samsung Internet',
      'Android',
    ],
    [
      'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/114.0.0.0',
      'Opera',
      'ChromeOS',
    ],
  ])('reads %s', (userAgent, browser, os) => {
    expect(describeUserAgent(userAgent)).toEqual({ browser, os });
  });

  // A signed-in client picks the header, and every request matches it.
  it('reads only the first 512 characters', () => {
    expect(describeUserAgent(`${'x'.repeat(512)} Firefox/132.0 (X11; Linux)`)).toEqual({
      browser: null,
      os: null,
    });
    expect(describeUserAgent(`Version/${'1'.repeat(16_000)}`)).toEqual({ browser: null, os: null });
  });

  it('names nothing it does not recognize', () => {
    expect(describeUserAgent('curl/8.10.1')).toEqual({ browser: null, os: null });
    expect(describeUserAgent(null)).toEqual({ browser: null, os: null });
    expect(describeUserAgent('')).toEqual({ browser: null, os: null });
  });
});

describe('sameDevice', () => {
  const firefoxLinux = (version: number) =>
    `Mozilla/5.0 (X11; Linux x86_64; rv:${version}.0) Gecko/20100101 Firefox/${version}.0`;

  it('ignores the version a browser updated to', () => {
    expect(sameDevice(firefoxLinux(132), firefoxLinux(133))).toBe(true);
  });

  it('tells another browser or system apart', () => {
    expect(
      sameDevice(
        firefoxLinux(132),
        'Mozilla/5.0 (Windows NT 10.0; Win64; rv:132.0) Gecko/20100101 Firefox/132.0',
      ),
    ).toBe(false);
    expect(
      sameDevice(
        firefoxLinux(132),
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      ),
    ).toBe(false);
    expect(sameDevice(firefoxLinux(132), undefined)).toBe(false);
  });

  it('matches two user agents it recognizes nothing in', () => {
    expect(sameDevice(null, 'curl/8.10.1')).toBe(true);
  });
});
