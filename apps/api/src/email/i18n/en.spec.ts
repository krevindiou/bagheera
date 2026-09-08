import en from './en';

// escape-html.spec.ts already covers safeHtml() itself; this pins that
// every templated (non-static) email body actually routes its interpolated
// value through it — a future template forgetting to wrap a newly added
// interpolated field in safeHtml would otherwise open a stored-XSS path in
// a transactional email (these bodies are rendered as HTML by mail clients).
const XSS_PAYLOAD = '<script>alert(1)</script>';
const ESCAPED_PAYLOAD = '&lt;script&gt;alert(1)&lt;/script&gt;';

describe('email/i18n/en', () => {
  it('escapes the activation link in the registration email', () => {
    expect(en.registration.body(XSS_PAYLOAD)).toContain(ESCAPED_PAYLOAD);
    expect(en.registration.body(XSS_PAYLOAD)).not.toContain(XSS_PAYLOAD);
  });

  it('escapes the change-password link in the password-recovery email', () => {
    expect(en.passwordRecovery.body(XSS_PAYLOAD)).toContain(ESCAPED_PAYLOAD);
    expect(en.passwordRecovery.body(XSS_PAYLOAD)).not.toContain(XSS_PAYLOAD);
  });

  it('escapes the new address in the email-changed notice', () => {
    expect(en.emailChanged.body(XSS_PAYLOAD)).toContain(ESCAPED_PAYLOAD);
    expect(en.emailChanged.body(XSS_PAYLOAD)).not.toContain(XSS_PAYLOAD);
  });

  it('escapes the confirmation link in the confirm-email-change email', () => {
    expect(en.confirmEmailChange.body(XSS_PAYLOAD)).toContain(ESCAPED_PAYLOAD);
    expect(en.confirmEmailChange.body(XSS_PAYLOAD)).not.toContain(XSS_PAYLOAD);
  });

  it('every entry has a non-empty subject', () => {
    for (const entry of Object.values(en)) {
      expect(entry.subject.length).toBeGreaterThan(0);
    }
  });
});
