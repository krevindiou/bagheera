import { runAuthentication } from './webauthn';

/**
 * Runs the step-up ceremony right before a sensitive mutation (email
 * change, adding or removing a passkey); the API consumes the proof on the
 * next such call. False when the prompt is cancelled or a request refused.
 */
export async function completeStepUp(): Promise<boolean> {
  return (await runAuthentication('/webauthn/step-up')).ok;
}
