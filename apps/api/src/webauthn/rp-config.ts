import { ConfigService } from '@nestjs/config';

// Relying-party identity, shared by every ceremony (registration and
// authentication alike) — one place to read the three env vars rather than
// each service repeating `getOrThrow` three times.
export interface RpConfig {
  /** Valid domain name (no scheme/port) the passkey is bound to. */
  rpID: string;
  /** User-visible service name shown by the platform's passkey UI. */
  rpName: string;
  /** Full scheme+host the browser actually requests from — validated against `response.clientDataJSON.origin`. */
  origin: string;
}

export function rpConfig(config: ConfigService): RpConfig {
  return {
    rpID: config.getOrThrow<string>('RP_ID'),
    rpName: config.getOrThrow<string>('RP_NAME'),
    origin: config.getOrThrow<string>('RP_ORIGIN'),
  };
}
