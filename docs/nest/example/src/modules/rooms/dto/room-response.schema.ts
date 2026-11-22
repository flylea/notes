import { z } from 'zod';
import { RoomStatus } from '../../../common/enums.js';

export const roomResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  capacity: z.number().int(),
  location: z.string(),
  equipment: z.array(z.string()),
  status: z.enum(RoomStatus),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type RoomResponse = z.infer<typeof roomResponseSchema>;
