import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { apiClient } from './client';

// `rejected` is the server refusing; `prompt-failed` is the browser or
// authenticator failing locally, which leaves the server-side state intact.
export type CeremonyFailure = 'cancelled' | 'prompt-failed' | 'rate-limited' | 'rejected';
// Only registration can hit an authenticator that already holds a passkey.
export type RegistrationFailure = CeremonyFailure | 'already-registered';
export type CeremonyResult<Failure extends string = CeremonyFailure> =
  { ok: true } | { ok: false; reason: Failure };

type AuthenticationPath = '/webauthn/authentication' | '/webauthn/step-up';
type RegistrationPath = '/webauthn/registration' | '/webauthn/signup';

// Swagger can't describe @simplewebauthn's types, so the generated client
// has these bodies and responses untyped; the casts stay here. The path
// unions above keep callers type-checked.
type LooseResult = { data?: unknown; response: Response };
const post = apiClient.POST as unknown as (
  path: string,
  init?: { body: unknown },
) => Promise<LooseResult>;

function errorName(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'name' in error ? error.name : undefined;
}

// NotAllowedError is a dismissed or timed-out prompt, AbortError one
// superseded by a newer ceremony; anything else is a real failure that
// callers must surface.
function promptFailure(error: unknown): 'cancelled' | 'prompt-failed' {
  const name = errorName(error);
  return name === 'NotAllowedError' || name === 'AbortError' ? 'cancelled' : 'prompt-failed';
}

/**
 * The two-hop authentication ceremony shared by sign-in and step-up:
 * POST `<base>/options` → passkey prompt → POST `<base>/verify`.
 */
export async function runAuthentication(base: AuthenticationPath): Promise<CeremonyResult> {
  const options = await post(`${base}/options`);
  if (options.response.status === 429) return { ok: false, reason: 'rate-limited' };
  if (!options.response.ok || !options.data) return { ok: false, reason: 'rejected' };

  let assertion;
  try {
    assertion = await startAuthentication({
      optionsJSON: options.data as PublicKeyCredentialRequestOptionsJSON,
    });
  } catch (error) {
    return { ok: false, reason: promptFailure(error) };
  }

  const verify = await post(`${base}/verify`, { body: { response: assertion } });
  if (verify.response.status === 429) return { ok: false, reason: 'rate-limited' };
  return verify.response.ok ? { ok: true } : { ok: false, reason: 'rejected' };
}

/**
 * The two-hop registration ceremony shared by sign-up and adding a passkey:
 * POST `<base>/options` → passkey prompt → POST `<base>/verify`.
 * `optionsBody` is sent with the options request, `verifyBody` is merged
 * next to the attestation in the verify request.
 */
export async function runRegistration(
  base: RegistrationPath,
  extra: { optionsBody?: object; verifyBody?: object } = {},
): Promise<CeremonyResult<RegistrationFailure>> {
  const options = await post(
    `${base}/options`,
    extra.optionsBody ? { body: extra.optionsBody } : undefined,
  );
  if (options.response.status === 429) return { ok: false, reason: 'rate-limited' };
  if (!options.response.ok || !options.data) return { ok: false, reason: 'rejected' };

  let attestation;
  try {
    attestation = await startRegistration({
      optionsJSON: options.data as PublicKeyCredentialCreationOptionsJSON,
    });
  } catch (error) {
    // The authenticator matched the options' excludeCredentials.
    if (errorName(error) === 'InvalidStateError')
      return { ok: false, reason: 'already-registered' };
    return { ok: false, reason: promptFailure(error) };
  }

  const verify = await post(`${base}/verify`, {
    body: { response: attestation, ...extra.verifyBody },
  });
  if (verify.response.status === 429) return { ok: false, reason: 'rate-limited' };
  return verify.response.ok ? { ok: true } : { ok: false, reason: 'rejected' };
}
