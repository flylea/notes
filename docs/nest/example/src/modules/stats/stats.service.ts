import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service.js';
import { BookingStatus } from '../../common/enums.js';
import { PRISMA } from '../../database/database.constants.js';
import type { Database } from '../../database/prisma.js';
import type { StatsRangeQueryDto } from './dto/stats-range-query.dto.js';
import type { TrendQueryDto } from './dto/trend-query.dto.js';
import type {
  BookingTrendDto,
  RoomUsageDto,
  StatsOverviewDto,
} from './dto/stats-response.dto.js';

const OVERVIEW_CACHE_TTL = 30;
const USAGE_CACHE_TTL = 60;
const TREND_CACHE_TTL = 60;
const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class StatsService {
  constructor(
    @Inject(PRISMA) private readonly db: Database,
    private readonly redis: RedisService,
  ) {}

  async overview(): Promise<StatsOverviewDto> {
    const cacheKey = 'stats:overview';
    const cached = await this.redis.getJson<StatsOverviewDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const [totalUsers, totalRooms, totalBookings, pendingBookings, approvedBookings] =
      await Promise.all([
        this.db.orm.public.User.aggregate((aggregate) => ({ total: aggregate.count() })),
        this.db.orm.public.Room.aggregate((aggregate) => ({ total: aggregate.count() })),
        this.db.orm.public.Booking.aggregate((aggregate) => ({ total: aggregate.count() })),
        this.db.orm.public.Booking.where({ status: BookingStatus.PENDING }).aggregate(
          (aggregate) => ({ total: aggregate.count() }),
        ),
        this.db.orm.public.Booking.where({ status: BookingStatus.APPROVED }).aggregate(
          (aggregate) => ({ total: aggregate.count() }),
        ),
      ]);

    const result: StatsOverviewDto = {
      totalUsers: totalUsers.total,
      totalRooms: totalRooms.total,
      totalBookings: totalBookings.total,
      pendingBookings: pendingBookings.total,
      approvedBookings: approvedBookings.total,
      generatedAt: new Date().toISOString(),
    };

    await this.redis.setJson(cacheKey, result, OVERVIEW_CACHE_TTL);
    return result;
  }

  /**
   * 房间使用率 = 区间内 APPROVED 预订总时长 / 区间总时长。
   * 这里先在数据库按区间过滤，再在应用层汇总（数据量大时可改成 SQL GROUP BY）。
   */
  async roomUsage(query: StatsRangeQueryDto): Promise<RoomUsageDto> {
    const { from, to } = this.resolveRange(query);
    const cacheKey = `stats:room-usage:${from.toISOString()}:${to.toISOString()}`;
    const cached = await this.redis.getJson<RoomUsageDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const [rooms, bookings] = await Promise.all([
      this.db.orm.public.Room.orderBy((room) => room.name.asc()).all(),
      this.db.orm.public.Booking.where((booking, { fns }) =>
        fns.and(
          booking.status.eq(BookingStatus.APPROVED),
          booking.startTime.gte(from.toISOString()),
          booking.endTime.lte(to.toISOString()),
        ),
      )
        .select('id', 'roomId', 'startTime', 'endTime')
        .all(),
    ]);

    const usage = new Map<string, { bookingCount: number; bookedMinutes: number }>();
    for (const booking of bookings) {
      const minutes =
        (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / 60_000;
      const current = usage.get(booking.roomId) ?? { bookingCount: 0, bookedMinutes: 0 };
      current.bookingCount += 1;
      current.bookedMinutes += minutes;
      usage.set(booking.roomId, current);
    }

    const totalMinutes = (to.getTime() - from.getTime()) / 60_000;
    const result: RoomUsageDto = {
      range: { from: from.toISOString(), to: to.toISOString() },
      totalRooms: rooms.length,
      rooms: rooms.map((room) => {
        const current = usage.get(room.id) ?? { bookingCount: 0, bookedMinutes: 0 };
        const utilizationRate =
          totalMinutes > 0
            ? Math.min(100, Math.round((current.bookedMinutes / totalMinutes) * 1000) / 10)
            : 0;
        return {
          roomId: room.id,
          name: room.name,
          location: room.location,
          capacity: room.capacity,
          bookingCount: current.bookingCount,
          bookedMinutes: Math.round(current.bookedMinutes),
          utilizationRate,
        };
      }),
    };

    await this.redis.setJson(cacheKey, result, USAGE_CACHE_TTL);
    return result;
  }

  async bookingTrend(query: TrendQueryDto): Promise<BookingTrendDto> {
    const days = query.days ?? 14;
    const now = new Date();
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (days - 1));

    const cacheKey = `stats:booking-trend:${days}:${start.toISOString().slice(0, 10)}`;
    const cached = await this.redis.getJson<BookingTrendDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const bookings = await this.db.orm.public.Booking.where((booking) =>
      booking.createdAt.gte(start.toISOString()),
    )
      .select('id', 'createdAt')
      .all();

    const counts = new Map<string, number>();
    for (const booking of bookings) {
      const date = new Date(booking.createdAt).toISOString().slice(0, 10);
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }

    const items = Array.from({ length: days }, (_, index) => {
      const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      return { date, count: counts.get(date) ?? 0 };
    });

    const result: BookingTrendDto = { days, items };
    await this.redis.setJson(cacheKey, result, TREND_CACHE_TTL);
    return result;
  }

  private resolveRange(query: StatsRangeQueryDto): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - DEFAULT_RANGE_MS);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('时间格式不正确');
    }
    if (from.getTime() >= to.getTime()) {
      throw new BadRequestException('开始时间必须早于结束时间');
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
      throw new BadRequestException('统计区间不能超过 90 天');
    }

    return { from, to };
  }
}
