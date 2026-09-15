import { z } from 'zod';
import { getPasswordStrength } from '../../composables/usePasswordStrength';

// Field rules mirror the API DTOs (apps/api/src/{members,auth}/dto/*).
// Length first, then a minimum strength (score >= 2 / "fair") — see
// auth.schemas.ts's matching `password` for the full rationale; mirrors
// NewPasswordField()'s Matches() regex server-side.
const password = z
  .string()
  .min(8)
  .max(4096)
  .refine((value) => getPasswordStrength(value).score >= 2, { message: 'passwordTooWeak' });

export const profileSchema = z.object({
  email: z.string().trim().email().max(128),
  currentPassword: z.string().min(1),
});
export type ProfileForm = z.infer<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: password,
    newPasswordConfirmation: z.string(),
  })
  .refine((form) => form.newPassword === form.newPasswordConfirmation, {
    message: 'passwordMismatch',
    path: ['newPasswordConfirmation'],
  });
export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;
