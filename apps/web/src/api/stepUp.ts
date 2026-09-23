import { startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { apiClient } from './client';

/**
 * Runs the step-up ceremony (the passkey-era analog of "enter your current
 * password" — see the API's WebauthnStepUpService) right before a
 * sensitive mutation: changing the account email, adding a passkey,
 * removing one. Same two-hop shape as SignInPage.vue's own passkey sign-in.
 * The API consumes the resulting proof on the very next sensitive call, so
 * call this immediately before that call, once per action.
 *
 * Returns false (and lets the caller show its own error) when the prompt
 * is cancelled/unsupported or either request is refused.
 */
export async function completeStepUp(): Promise<boolean> {
  const { data, response } = await apiClient.POST('/webauthn/step-up/options');
  if (!response.ok || !data) return false;

  let assertion;
  try {
    assertion = await startAuthentication({
      optionsJSON: data as unknown as PublicKeyCredentialRequestOptionsJSON,
    });
  } catch {
    return false;
  }

  // The generated client can't type this body beyond an opaque object,
  // since Swagger has no visibility into @simplewebauthn/server's
  // WebAuthn-spec types (see PasskeysPage.vue).
  const { response: verifyResponse } = await apiClient.POST('/webauthn/step-up/verify', {
    body: { response: assertion as unknown as Record<string, never> },
  });
  return verifyResponse.ok;
}
