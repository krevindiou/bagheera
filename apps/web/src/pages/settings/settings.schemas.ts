import { FIELD_LIMITS } from '@bagheera/reference-data';
import { z } from 'zod';

export const profileSchema = z.object({
  email: z.string().trim().email().max(FIELD_LIMITS.EMAIL),
});
export type ProfileForm = z.infer<typeof profileSchema>;
