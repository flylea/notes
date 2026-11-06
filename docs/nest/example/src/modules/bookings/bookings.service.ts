import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { all } from '@prisma/orm-postgres/orm-client';
import { paginate, type PaginatedResult } from '../../common/dto/paginated.dto.js';
import { BookingStatus, Role, RoomStatus } from '../../common/enums.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { PRISMA } from '../../database/database.constants.js';
import type { Database } from '../../database/prisma.js';
import type { RoomRow } from '../rooms/rooms.service.js';
import type { UserRow } from '../users/users.service.js';
import type { CreateBookingDto } from './dto/create-booking.dto.js';
import type { QueryBookingsDto } from './dto/query-bookings.dto.js';
import type { RejectBookingDto } from './dto/reject-booking.dto.js';

/** 占用时间段的状态：只有被驳回/取消的预订不占用会议室。 */
const OCCUPYING_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.APPROVED];
const MAX_DURATION_MS = 8 * 60 * 60 * 1000;

const BOOKING_USER_FIELDS = ['id', 'name', 'email', 'role', 'avatarUrl'] as const;

export interface BookingRow {
  id: string;
  userId: string;
  roomId: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingDetailRow extends BookingRow {
  room: RoomRow;
  user: Pick<UserRow, 'id' | 'name' | 'email' | 'role' | 'avatarUrl'> | null;
}

@Injectable()
export class BookingsService {
  constructor(@Inject(PRISMA) private readonly db: Database) {}

  async create(dto: CreateBookingDto, user: AuthUser): Promise<BookingRow> {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    this.assertValidWindow(startTime, endTime);

    const room = await this.db.orm.public.Room.where({ id: dto.roomId }).first();
    if (!room) {
      throw new NotFoundException('会议室不存在');
    }
    if (room.status !== RoomStatus.AVAILABLE) {
      throw new ConflictException('会议室正在维护，暂不可预订');
    }

    if (await this.hasConflict(dto.roomId, startTime, endTime)) {
      throw new ConflictException('该时间段与已有预订冲突，请选择其他时间');
    }

    return this.db.orm.public.Booking.create({
      userId: user.id,
      roomId: dto.roomId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: BookingStatus.PENDING,
      remark: dto.remark ?? null,
    });
  }

  /**
   * 时间冲突判定：半开区间 [start, end)。
   * 两个区间重叠 ⇔ existing.start < new.end && existing.end > new.start。
   * 相邻预订（10:00-11:00 与 11:00-12:00）不算冲突。
   */
  async hasConflict(
    roomId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string,
  ): Promise<boolean> {
    const booking = await this.db.orm.public.Booking.where((row, { fns }) =>
      fns.and(
        row.roomId.eq(roomId),
        row.status.in(OCCUPYING_STATUSES),
        row.startTime.lt(endTime.toISOString()),
        row.endTime.gt(startTime.toISOString()),
        excludeBookingId ? row.id.neq(excludeBookingId) : all(),
      ),
    ).first();

    return booking !== null;
  }

  async findAll(
    query: QueryBookingsDto,
    user: AuthUser,
  ): Promise<PaginatedResult<BookingDetailRow>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const from = query.from ? new Date(query.from).toISOString() : null;
    const to = query.to ? new Date(query.to).toISOString() : null;

    // 普通用户只能看自己的预订，忽略 userId 过滤参数。
    const filtered = this.db.orm.public.Booking.where((row, { fns }) =>
      fns.and(
        user.role === Role.ADMIN
          ? query.userId
            ? row.userId.eq(query.userId)
            : all()
          : row.userId.eq(user.id),
        query.status ? row.status.eq(query.status) : all(),
        query.roomId ? row.roomId.eq(query.roomId) : all(),
        from ? row.startTime.gte(from) : all(),
        to ? row.startTime.lte(to) : all(),
      ),
    );

    const [items, totals] = await Promise.all([
      filtered
        .include('room')
        .include('user', (relation) => relation.select(...BOOKING_USER_FIELDS))
        .orderBy((row) => row.createdAt.desc())
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .all(),
      filtered.aggregate((aggregate) => ({ total: aggregate.count() })),
    ]);

    return paginate(items, totals.total, page, pageSize);
  }

  async findOne(id: string, user: AuthUser): Promise<BookingDetailRow> {
    const booking = await this.db.orm.public.Booking.where({ id })
      .include('room')
      .include('user', (relation) => relation.select(...BOOKING_USER_FIELDS))
      .first();

    if (!booking) {
      throw new NotFoundException('预订不存在');
    }
    if (user.role !== Role.ADMIN && booking.userId !== user.id) {
      throw new ForbiddenException('无权查看他人的预订');
    }
    return booking;
  }

  async approve(id: string): Promise<BookingRow> {
    const booking = await this.getBookingOrFail(id);
    if (booking.status !== BookingStatus.PENDING) {
      throw new ConflictException('只有待审批的预订可以通过');
    }

    // 审批时再查一次：等待审批期间可能有其他预订被通过。
    const conflict = await this.hasConflict(
      booking.roomId,
      new Date(booking.startTime),
      new Date(booking.endTime),
      booking.id,
    );
    if (conflict) {
      throw new ConflictException('该时间段已有其他已通过的预订，无法审批');
    }

    const updated = await this.db.orm.public.Booking.where({ id }).update({
      status: BookingStatus.APPROVED,
    });
    if (!updated) {
      throw new NotFoundException('预订不存在');
    }
    return updated;
  }

  async reject(id: string, dto: RejectBookingDto): Promise<BookingRow> {
    const booking = await this.getBookingOrFail(id);
    if (booking.status !== BookingStatus.PENDING) {
      throw new ConflictException('只有待审批的预订可以驳回');
    }

    const updated = await this.db.orm.public.Booking.where({ id }).update({
      status: BookingStatus.REJECTED,
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
    });
    if (!updated) {
      throw new NotFoundException('预订不存在');
    }
    return updated;
  }

  async cancel(id: string, user: AuthUser): Promise<BookingRow> {
    const booking = await this.getBookingOrFail(id);
    if (user.role !== Role.ADMIN && booking.userId !== user.id) {
      throw new ForbiddenException('无权取消他人的预订');
    }
    if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.APPROVED) {
      throw new ConflictException('当前状态的预订不能取消');
    }

    const updated = await this.db.orm.public.Booking.where({ id }).update({
      status: BookingStatus.CANCELLED,
    });
    if (!updated) {
      throw new NotFoundException('预订不存在');
    }
    return updated;
  }

  private async getBookingOrFail(id: string): Promise<BookingRow> {
    const booking = await this.db.orm.public.Booking.where({ id }).first();
    if (!booking) {
      throw new NotFoundException('预订不存在');
    }
    return booking;
  }

  private assertValidWindow(startTime: Date, endTime: Date): void {
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      throw new BadRequestException('时间格式不正确');
    }
    if (endTime.getTime() <= startTime.getTime()) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }
    if (startTime.getTime() <= Date.now()) {
      throw new BadRequestException('开始时间必须晚于当前时间');
    }
    if (endTime.getTime() - startTime.getTime() > MAX_DURATION_MS) {
      throw new BadRequestException('单次预订时长不能超过 8 小时');
    }
  }
}
