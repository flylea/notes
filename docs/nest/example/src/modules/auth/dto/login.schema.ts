import { z } from 'zod';

export const loginSchema = z.object({
  // 先 trim/小写再校验，同时让 Swagger 能拿到 format: email
  email: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
    z.email().max(191),
  ),
  password: z.string().max(72),
});

export type LoginInput = z.infer<typeof loginSchema>;
