import { z } from 'zod';
import { Role } from '../../../common/enums.js';

export const userResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: z.enum(Role),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
