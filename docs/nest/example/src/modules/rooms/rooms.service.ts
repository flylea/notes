import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { all } from '@prisma/orm-postgres/orm-client';
import { paginate, type PaginatedResult } from '../../common/dto/pagination.schema.js';
import { RoomStatus } from '../../common/enums.js';
import { PRISMA } from '../../database/database.constants.js';
import type { Database } from '../../database/prisma.js';
import type { CreateRoomInput } from './dto/create-room.schema.js';
import type { QueryRoomsInput } from './dto/query-rooms.schema.js';
import type { UpdateRoomInput } from './dto/update-room.schema.js';

export interface RoomRow {
  id: string;
  name: string;
  capacity: number;
  location: string;
  equipment: readonly string[];
  status: RoomStatus;
  createdAt: string;
  updatedAt: string;
}

const ROOM_FIELDS = [
  'id',
  'name',
  'capacity',
  'location',
  'equipment',
  'status',
  'createdAt',
  'updatedAt',
] as const;

@Injectable()
export class RoomsService {
  constructor(@Inject(PRISMA) private readonly db: Database) {}

  async findAll(query: QueryRoomsInput): Promise<PaginatedResult<RoomRow>> {
    const { page, pageSize } = query;
    const keyword = query.keyword?.trim();

    const filtered = this.db.orm.public.Room.where((room, { fns }) =>
      fns.and(
        keyword
          ? fns.or(room.name.ilike(`%${keyword}%`), room.location.ilike(`%${keyword}%`))
          : all(),
        query.status ? room.status.eq(query.status) : all(),
        query.minCapacity ? room.capacity.gte(query.minCapacity) : all(),
      ),
    );

    const [items, totals] = await Promise.all([
      filtered
        .select(...ROOM_FIELDS)
        .orderBy((room) => room.name.asc())
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .all(),
      filtered.aggregate((aggregate) => ({ total: aggregate.count() })),
    ]);

    return paginate(items, totals.total, page, pageSize);
  }

  async findById(id: string): Promise<RoomRow> {
    const room = await this.db.orm.public.Room.where({ id }).select(...ROOM_FIELDS).first();
    if (!room) {
      throw new NotFoundException('会议室不存在');
    }
    return room;
  }

  async create(dto: CreateRoomInput): Promise<RoomRow> {
    return this.db.orm.public.Room.select(...ROOM_FIELDS).create({
      name: dto.name,
      capacity: dto.capacity,
      location: dto.location,
      equipment: dto.equipment ?? [],
      status: dto.status ?? RoomStatus.AVAILABLE,
    });
  }

  async update(id: string, dto: UpdateRoomInput): Promise<RoomRow> {
    await this.findById(id);

    const payload: {
      name?: string;
      capacity?: number;
      location?: string;
      equipment?: string[];
      status?: RoomStatus;
    } = {};
    if (dto.name !== undefined) payload.name = dto.name;
    if (dto.capacity !== undefined) payload.capacity = dto.capacity;
    if (dto.location !== undefined) payload.location = dto.location;
    if (dto.equipment !== undefined) payload.equipment = dto.equipment;
    if (dto.status !== undefined) payload.status = dto.status;

    if (Object.keys(payload).length === 0) {
      return this.findById(id);
    }

    const updated = await this.db.orm.public.Room.where({ id }).select(...ROOM_FIELDS).update(payload);
    if (!updated) {
      throw new NotFoundException('会议室不存在');
    }
    return updated;
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    await this.findById(id);

    const { total } = await this.db.orm.public.Booking.where({ roomId: id }).aggregate(
      (aggregate) => ({ total: aggregate.count() }),
    );
    if (total > 0) {
      throw new ConflictException('该会议室已有预订记录，不能删除，可将状态改为 MAINTENANCE');
    }

    await this.db.orm.public.Room.where({ id }).delete();
    return { id, deleted: true };
  }
}
