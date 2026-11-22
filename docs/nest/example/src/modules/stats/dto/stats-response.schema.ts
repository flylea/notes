import { z } from 'zod';

export const statsRangeSchema = z.object({
  from: z.string(),
  to: z.string(),
});

export const statsOverviewSchema = z.object({
  totalUsers: z.number().int(),
  totalRooms: z.number().int(),
  totalBookings: z.number().int(),
  pendingBookings: z.number().int(),
  approvedBookings: z.number().int(),
  generatedAt: z.string(),
});

export type StatsOverview = z.infer<typeof statsOverviewSchema>;

export const roomUsageItemSchema = z.object({
  roomId: z.uuid(),
  name: z.string(),
  location: z.string(),
  capacity: z.number().int(),
  bookingCount: z.number().int(),
  bookedMinutes: z.number().int(),
  utilizationRate: z.number(),
});

export type RoomUsageItem = z.infer<typeof roomUsageItemSchema>;

export const roomUsageSchema = z.object({
  range: statsRangeSchema,
  totalRooms: z.number().int(),
  rooms: z.array(roomUsageItemSchema),
});

export type RoomUsage = z.infer<typeof roomUsageSchema>;

export const bookingTrendItemSchema = z.object({
  date: z.string(),
  count: z.number().int(),
});

export type BookingTrendItem = z.infer<typeof bookingTrendItemSchema>;

export const bookingTrendSchema = z.object({
  days: z.number().int(),
  items: z.array(bookingTrendItemSchema),
});

export type BookingTrend = z.infer<typeof bookingTrendSchema>;
