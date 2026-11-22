import { z } from 'zod';
import { createRoomSchema } from './create-room.schema.js';

export const updateRoomSchema = createRoomSchema.partial();

export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
