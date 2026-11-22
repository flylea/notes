import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2).max(50),
  // 先 trim/小写再校验，同时让 Swagger 能拿到 format: email
  email: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
    z.email().max(191),
  ),
  password: z
    .string()
    .min(8)
    .max(72)
    .regex(/^(?=.*[A-Za-z])(?=.*\d)/, { message: '密码必须同时包含字母和数字' }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
