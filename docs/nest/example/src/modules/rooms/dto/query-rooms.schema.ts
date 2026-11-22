import { z } from 'zod';
import { paginationSchema } from '../../../common/dto/pagination.schema.js';
import { RoomStatus } from '../../../common/enums.js';

export const queryRoomsSchema = paginationSchema.extend({
  keyword: z.string().max(100).optional(),
  status: z.enum(RoomStatus).optional(),
  minCapacity: z.coerce.number().int().min(1).optional(),
});

export type QueryRoomsInput = z.infer<typeof queryRoomsSchema>;
