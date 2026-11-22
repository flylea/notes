import { z } from 'zod';

export const rejectBookingSchema = z.object({
  remark: z.string().max(500).optional(),
});

export type RejectBookingInput = z.infer<typeof rejectBookingSchema>;
