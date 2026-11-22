import { z } from 'zod';

export const statsRangeQuerySchema = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});

export type StatsRangeQueryInput = z.infer<typeof statsRangeQuerySchema>;
