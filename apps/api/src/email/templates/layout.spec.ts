import { emailButton, renderEmailLayout } from './layout';

describe('email/templates/layout', () => {
  describe('renderEmailLayout', () => {
    const html = renderEmailLayout({
      locale: 'en',
      preheader: 'Preview text',
      heading: 'Some heading',
      bodyHtml: '<p>Some body</p>',
    });

    it('includes the locale, preheader, heading and body', () => {
      expect(html).toContain('lang="en"');
      expect(html).toContain('Preview text');
      expect(html).toContain('Some heading');
      expect(html).toContain('<p>Some body</p>');
    });

    it('loads no remote resources — no <link>, <img>, or url() pointing off-host', () => {
      expect(html).not.toMatch(/<link/i);
      expect(html).not.toMatch(/<img/i);
      expect(html).not.toMatch(/url\(\s*['"]?https?:/i);
      expect(html).not.toContain('fonts.googleapis.com');
      expect(html).not.toContain('fonts.gstatic.com');
    });
  });

  describe('emailButton', () => {
    const XSS_PAYLOAD = '<script>alert(1)</script>';
    const ESCAPED_PAYLOAD = '&lt;script&gt;alert(1)&lt;/script&gt;';

    it('escapes the label', () => {
      const html = emailButton(XSS_PAYLOAD, 'https://example.com');
      expect(html).toContain(ESCAPED_PAYLOAD);
      expect(html).not.toContain(XSS_PAYLOAD);
    });

    it('escapes the url, in both the button href and the plain-text copy', () => {
      const html = emailButton('Click me', XSS_PAYLOAD);
      expect(html).toContain(ESCAPED_PAYLOAD);
      expect(html).not.toContain(XSS_PAYLOAD);
    });

    it('includes the url as a visible plain-text link', () => {
      const html = emailButton('Click me', 'https://example.com/confirm');
      expect(html).toContain('https://example.com/confirm');
    });
  });
});
