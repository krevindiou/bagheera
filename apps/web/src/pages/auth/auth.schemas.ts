import { COUNTRY_CODES } from '@bagheera/reference-data';
import { z } from 'zod';
import type { components } from '../../api/schema';

type Country = components['schemas']['RegisterDto']['country'];

const COUNTRY_CODE_SET: ReadonlySet<string> = new Set(COUNTRY_CODES);

function isCountry(value: string): value is Country {
  return COUNTRY_CODE_SET.has(value);
}

// Field rules mirror the API DTOs (apps/api/src/{members,webauthn}/dto/*)
// so invalid submissions are caught client-side before hitting the network.
const email = z.string().trim().email().max(128);
const country = z.string().refine(isCountry);

export const registerSchema = z.object({ email, country });
export type RegisterForm = z.input<typeof registerSchema>;
export type RegisterBody = z.output<typeof registerSchema>;
