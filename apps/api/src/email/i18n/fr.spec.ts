import fr from './fr';

// Mirrors en.spec.ts — same XSS-escaping guarantee, same catalog.
const XSS_PAYLOAD = '<script>alert(1)</script>';
const ESCAPED_PAYLOAD = '&lt;script&gt;alert(1)&lt;/script&gt;';

describe('email/i18n/fr', () => {
  it('escapes the activation link in the registration email', () => {
    expect(fr.registration.body(XSS_PAYLOAD)).toContain(ESCAPED_PAYLOAD);
    expect(fr.registration.body(XSS_PAYLOAD)).not.toContain(XSS_PAYLOAD);
  });

  it('escapes the sign-in link in the account-exists notice', () => {
    expect(fr.accountExists.body(XSS_PAYLOAD)).toContain(ESCAPED_PAYLOAD);
    expect(fr.accountExists.body(XSS_PAYLOAD)).not.toContain(XSS_PAYLOAD);
  });

  it('puts no link in the address-in-use notice', () => {
    expect(fr.addressInUse.body).toContain('appartient déjà à votre compte');
    expect(fr.addressInUse.body).not.toContain('href=');
  });

  it('escapes the new address in the email-changed notice', () => {
    expect(fr.emailChanged.body(XSS_PAYLOAD)).toContain(ESCAPED_PAYLOAD);
    expect(fr.emailChanged.body(XSS_PAYLOAD)).not.toContain(XSS_PAYLOAD);
  });

  it('escapes the confirmation link in the confirm-email-change email', () => {
    expect(fr.confirmEmailChange.body(XSS_PAYLOAD)).toContain(ESCAPED_PAYLOAD);
    expect(fr.confirmEmailChange.body(XSS_PAYLOAD)).not.toContain(XSS_PAYLOAD);
  });

  it('every entry has a non-empty subject', () => {
    for (const entry of Object.values(fr)) {
      expect(entry.subject.length).toBeGreaterThan(0);
    }
  });
});
