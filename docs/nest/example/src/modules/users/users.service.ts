import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { all } from '@prisma/orm-postgres/orm-client';
import { paginate, type PaginatedResult } from '../../common/dto/paginated.dto.js';
import { Role } from '../../common/enums.js';
import { PRISMA } from '../../database/database.constants.js';
import type { Database } from '../../database/prisma.js';
import type { QueryUsersDto } from './dto/query-users.dto.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role?: Role;
  avatarUrl?: string | null;
}

/** 对外可见的用户字段。passwordHash 永远不在列表里 —— 登录时才单独查。 */
export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

const USER_PUBLIC_FIELDS = [
  'id',
  'name',
  'email',
  'role',
  'avatarUrl',
  'createdAt',
  'updatedAt',
] as const;

@Injectable()
export class UsersService {
  constructor(@Inject(PRISMA) private readonly db: Database) {}

  async findById(id: string): Promise<UserRow | null> {
    return this.db.orm.public.User.where({ id }).select(...USER_PUBLIC_FIELDS).first();
  }

  async findByIdOrFail(id: string): Promise<UserRow> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    return this.db.orm.public.User.where({ email }).select(...USER_PUBLIC_FIELDS).first();
  }

  /** 登录专用：显式带出 password_hash。 */
  async findByEmailWithPassword(email: string): Promise<(UserRow & { passwordHash: string }) | null> {
    return this.db.orm.public.User.where({ email })
      .select(...USER_PUBLIC_FIELDS, 'passwordHash')
      .first();
  }

  async create(data: CreateUserData): Promise<UserRow> {
    return this.db.orm.public.User.select(...USER_PUBLIC_FIELDS).create({
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role ?? Role.USER,
      avatarUrl: data.avatarUrl ?? null,
    });
  }

  async findAll(query: QueryUsersDto): Promise<PaginatedResult<UserRow>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const keyword = query.keyword?.trim();

    const filtered = this.db.orm.public.User.where((user, { fns }) =>
      fns.and(
        query.role ? user.role.eq(query.role) : all(),
        keyword
          ? fns.or(user.name.ilike(`%${keyword}%`), user.email.ilike(`%${keyword}%`))
          : all(),
      ),
    );

    const [items, totals] = await Promise.all([
      filtered
        .select(...USER_PUBLIC_FIELDS)
        .orderBy((user) => user.createdAt.desc())
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .all(),
      filtered.aggregate((aggregate) => ({ total: aggregate.count() })),
    ]);

    return paginate(items, totals.total, page, pageSize);
  }

  async update(id: string, dto: UpdateUserDto | UpdateProfileDto): Promise<UserRow> {
    await this.findByIdOrFail(id);

    const payload: { name?: string; avatarUrl?: string | null; role?: Role } = {};
    if (dto.name !== undefined) {
      payload.name = dto.name;
    }
    if (dto.avatarUrl !== undefined) {
      payload.avatarUrl = dto.avatarUrl;
    }
    if ('role' in dto && dto.role !== undefined) {
      payload.role = dto.role;
    }

    if (Object.keys(payload).length === 0) {
      return this.findByIdOrFail(id);
    }

    const updated = await this.db.orm.public.User.where({ id }).select(...USER_PUBLIC_FIELDS).update(payload);
    if (!updated) {
      throw new NotFoundException('用户不存在');
    }
    return updated;
  }
}
