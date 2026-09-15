import { z } from 'zod';
import { getPasswordStrength } from '../../composables/usePasswordStrength';

// Field rules mirror the API DTOs (apps/api/src/{members,auth}/dto/*) so
// invalid submissions are caught client-side before hitting the network.
const email = z.string().trim().email().max(128);
// Length first, then a minimum strength (score >= 2 / "fair" — at least 2
// of lowercase/uppercase/digit/symbol) — mirrors NewPasswordField()'s
// Matches() regex server-side (apps/api/src/common/dto-fields.ts). The
// strength meter's own "Weak" tier and this gate are the same threshold on
// purpose: the meter never shows red for a password that's still accepted.
const password = z
  .string()
  .min(8)
  .max(4096)
  .refine((value) => getPasswordStrength(value).score >= 2, { message: 'passwordTooWeak' });
const country = z.string().regex(/^[A-Za-z]{2}$/);

export const signInSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});
export type SignInForm = z.infer<typeof signInSchema>;

export const registerSchema = z
  .object({
    email,
    country,
    password,
    passwordConfirmation: z.string(),
  })
  .refine((form) => form.password === form.passwordConfirmation, {
    message: 'passwordMismatch',
    path: ['passwordConfirmation'],
  });
export type RegisterForm = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password,
    passwordConfirmation: z.string(),
  })
  .refine((form) => form.password === form.passwordConfirmation, {
    message: 'passwordMismatch',
    path: ['passwordConfirmation'],
  });
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
