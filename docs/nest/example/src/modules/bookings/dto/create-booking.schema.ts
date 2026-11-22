import { z } from 'zod';

export const createBookingSchema = z.object({
  roomId: z.uuid(),
  startTime: z.iso.datetime({ offset: true }),
  endTime: z.iso.datetime({ offset: true }),
  remark: z.string().max(500).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
