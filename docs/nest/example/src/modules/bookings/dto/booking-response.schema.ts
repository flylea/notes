import { z } from 'zod';
import { BookingStatus, Role } from '../../../common/enums.js';
import { roomResponseSchema } from '../../rooms/dto/room-response.schema.js';

/** 预订里带出的用户摘要（不含 passwordHash）。 */
export const bookingUserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: z.enum(Role),
  avatarUrl: z.string().nullable(),
});

export const bookingResponseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  roomId: z.uuid(),
  startTime: z.string(),
  endTime: z.string(),
  status: z.enum(BookingStatus),
  remark: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BookingResponse = z.infer<typeof bookingResponseSchema>;

export const bookingDetailResponseSchema = bookingResponseSchema.extend({
  room: roomResponseSchema,
  user: bookingUserSchema.nullable(),
});

export type BookingDetailResponse = z.infer<typeof bookingDetailResponseSchema>;
