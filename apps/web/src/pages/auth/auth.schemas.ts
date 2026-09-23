import { z } from 'zod';

// Field rules mirror the API DTOs (apps/api/src/{members,webauthn}/dto/*)
// so invalid submissions are caught client-side before hitting the network.
const email = z.string().trim().email().max(128);
const country = z.string().regex(/^[A-Za-z]{2}$/);

export const registerSchema = z.object({ email, country });
export type RegisterForm = z.infer<typeof registerSchema>;
