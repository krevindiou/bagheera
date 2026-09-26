import { runAuthentication } from './webauthn';

/**
 * Runs the step-up ceremony (the passkey-era analog of "enter your current
 * password" — see the API's WebauthnStepUpService) right before a
 * sensitive mutation: changing the account email, adding a passkey,
 * removing one. Shares its ceremony with sign-in (see webauthn.ts).
 * The API consumes the resulting proof on the very next sensitive call, so
 * call this immediately before that call, once per action.
 *
 * Returns false (and lets the caller show its own error) when the prompt
 * is cancelled/unsupported or either request is refused.
 */
export async function completeStepUp(): Promise<boolean> {
  return (await runAuthentication('/webauthn/step-up')).ok;
}
