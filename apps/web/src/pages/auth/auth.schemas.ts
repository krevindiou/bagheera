import { z } from "zod";

// Field rules mirror the API DTOs (apps/api/src/{members,auth}/dto/*) so
// invalid submissions are caught client-side before hitting the network.
const email = z.string().trim().email().max(128);
const password = z.string().min(8).max(4096);
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
    message: "passwordMismatch",
    path: ["passwordConfirmation"],
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
    message: "passwordMismatch",
    path: ["passwordConfirmation"],
  });
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
