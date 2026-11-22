import { z } from 'zod';
import { RoomStatus } from '../../../common/enums.js';

export const createRoomSchema = z.object({
  name: z.string().min(2).max(100),
  capacity: z.coerce.number().int().min(1).max(500),
  location: z.string().min(2).max(200),
  equipment: z.array(z.string()).max(20).optional(),
  status: z.enum(RoomStatus).optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
