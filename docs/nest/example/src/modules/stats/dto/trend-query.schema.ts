import { z } from 'zod';

export const trendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(14),
});

export type TrendQueryInput = z.infer<typeof trendQuerySchema>;
