import { z } from 'zod';
import { Role } from '../../../common/enums.js';

export const authUserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: z.enum(Role),
  avatarUrl: z.string().nullable(),
});

export type AuthUserPayload = z.infer<typeof authUserSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.string(),
  user: authUserSchema,
});

export type AuthResponse = z.infer<typeof authResponseSchema>;
