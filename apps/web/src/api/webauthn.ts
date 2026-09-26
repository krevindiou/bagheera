import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { apiClient } from './client';

export type CeremonyResult =
  { ok: true } | { ok: false; reason: 'cancelled' | 'rate-limited' | 'rejected' };

type AuthenticationPath = '/webauthn/authentication' | '/webauthn/step-up';
type RegistrationPath = '/webauthn/registration' | '/webauthn/signup';

// Swagger can't introspect @simplewebauthn/server's WebAuthn-spec types
// (they carry no Nest/class-validator decorators of their own), so the
// generated client types these bodies as an opaque `Record<string, never>`
// and the options responses as untyped — every cast lives here, at the
// boundary, rather than widening the real API contract. The path unions
// above keep callers type-checked; this loose signature only exists so one
// function can POST to any of them.
type LooseResult = { data?: unknown; response: Response };
const post = apiClient.POST as unknown as (
  path: string,
  init?: { body: unknown },
) => Promise<LooseResult>;

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
  } catch {
    // The platform prompt was cancelled/dismissed or is unsupported.
    return { ok: false, reason: 'cancelled' };
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
): Promise<CeremonyResult> {
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
  } catch {
    // The platform prompt was cancelled/dismissed, or this browser/device
    // doesn't support it.
    return { ok: false, reason: 'cancelled' };
  }

  const verify = await post(`${base}/verify`, {
    body: { response: attestation, ...extra.verifyBody },
  });
  if (verify.response.status === 429) return { ok: false, reason: 'rate-limited' };
  return verify.response.ok ? { ok: true } : { ok: false, reason: 'rejected' };
}
