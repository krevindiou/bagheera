import { z } from 'zod';

export const profileSchema = z.object({
  email: z.string().trim().email().max(128),
});
export type ProfileForm = z.infer<typeof profileSchema>;
