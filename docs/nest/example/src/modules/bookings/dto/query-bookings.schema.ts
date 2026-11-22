import { z } from 'zod';
import { paginationSchema } from '../../../common/dto/pagination.schema.js';
import { BookingStatus } from '../../../common/enums.js';

export const queryBookingsSchema = paginationSchema.extend({
  status: z.enum(BookingStatus).optional(),
  roomId: z.uuid().optional(),
  userId: z.uuid().optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});

export type QueryBookingsInput = z.infer<typeof queryBookingsSchema>;
