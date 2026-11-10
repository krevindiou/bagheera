import { signInEmail, type SignInDetails } from './sign-in.template';

const DETAILS: SignInDetails = {
  at: new Date('2026-11-10T08:30:00Z'),
  timeZone: 'Europe/Paris',
  deviceName: 'MacBook Touch ID',
  sourceAddress: '203.0.113.7',
};

describe('signInEmail', () => {
  it('addresses the member and names the passkey and source address', () => {
    const message = signInEmail('member@example.test', DETAILS, 'en');

    expect(message.to).toBe('member@example.test');
    expect(message.subject).toBe('New sign-in to Bagheera');
    expect(message.html).toContain('MacBook Touch ID');
    expect(message.html).toContain('203.0.113.7');
  });

  it("shows the time in the given zone and the member's locale", () => {
    expect(signInEmail('m@example.test', DETAILS, 'en').html).toContain(
      'November 10, 2026 at 9:30 AM (Europe/Paris)',
    );
    expect(signInEmail('m@example.test', DETAILS, 'fr').html).toContain(
      '10 novembre 2026 à 09:30 (Europe/Paris)',
    );
  });

  it('falls back to a generic label for a passkey with no name', () => {
    const details = { ...DETAILS, deviceName: null };

    expect(signInEmail('m@example.test', details, 'en').html).toContain('unnamed passkey');
    expect(signInEmail('m@example.test', details, 'fr').html).toContain('clé d’accès sans nom');
  });

  // The passkey label is member-supplied.
  it('escapes the passkey name', () => {
    const html = signInEmail('m@example.test', { ...DETAILS, deviceName: '<b>x</b>' }, 'en').html;

    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<b>x</b>');
  });
});
