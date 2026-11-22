import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  avatarUrl: z.string().max(500).nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
