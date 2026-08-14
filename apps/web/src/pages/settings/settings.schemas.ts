import { z } from "zod";

// Field rules mirror the API DTOs (apps/api/src/{members,auth}/dto/*).
const password = z.string().min(8).max(4096);

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
    message: "passwordMismatch",
    path: ["newPasswordConfirmation"],
  });
export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;
