# 重构 UserService：JSON 读写 → Prisma API

## 迁移前：Day 12 的 UserService

```typescript
// src/user/user.service.ts（旧版）
import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { randomBytes } from 'crypto';

@Injectable()
export class UserService {
  constructor(private dbService: DbService) {}

  async register(dto: { username: string; password: string }) {
    const users = await this.dbService.read<User>('users');

    // 内存查重
    const existing = users.find(u => u.username === dto.username);
    if (existing) {
      throw new BadRequestException('用户名已存在');
    }

    // 生成 ID（随机字符串）
    const newUser: User = {
      id: randomBytes(8).toString('hex'),  // ❌ 字符串 ID
      username: dto.username,
      password: dto.password,               // ❌ 明文存储
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    await this.dbService.write('users', users);
    return newUser;
  }

  async login(dto: { username: string; password: string }) {
    const users = await this.dbService.read<User>('users');
    const user = users.find(u => u.username === dto.username);

    if (!user || user.password !== dto.password) {  // ❌ 明文比较
      throw new BadRequestException('用户名或密码错误');
    }

    return user;
  }
}
```

## 迁移后：Day 19 的 UserService

```typescript
// src/user/user.service.ts（新版）
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async register(dto: Prisma.UserCreateInput) {
    // 1. 检查用户名是否已存在
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (existing) {
      throw new BadRequestException('用户名已存在');
    }

    // 2. 密码加密
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 3. 创建用户（数据库唯一约束兜底）
    try {
      return await this.prisma.user.create({
        data: {
          ...dto,
          password: hashedPassword,
        },
        select: {
          id: true,
          username: true,
          nickname: true,
          avatar: true,
          role: true,
          createdAt: true,
          // 不返回 password
        },
      });
    } catch (error) {
      // 处理并发场景下的唯一约束冲突
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('用户名已存在');
      }
      throw error;
    }
  }

  async login(dto: { username: string; password: string }) {
    // 1. 查找用户
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (!user) {
      throw new BadRequestException('用户名或密码错误');
    }

    // 2. 验证密码（bcrypt）
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('用户名或密码错误');
    }

    // 3. 返回用户信息（不含密码）
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async findById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        nickname: true,
        avatar: true,
        role: true,
        borrowCount: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    return user;
  }
}
```

## 关键变化对比

| 维度 | 迁移前（JSON） | 迁移后（Prisma） |
|------|-------------|---------------|
| 数据源 | `this.dbService.read('users')` | `this.prisma.user.findUnique(...)` |
| 查重方式 | 内存 `find()` 遍历 | DB `WHERE username = ?` |
| 密码存储 | 明文 | `bcrypt.hash(10)` 加密 |
| ID 生成 | `randomBytes(8)` 字符串 | 数据库 `AUTO_INCREMENT` 整数 |
| 并发安全 | ❌ 无保护 | ✅ 唯一约束 + P2002 处理 |
| 安全性 | ❌ 返回 password | ✅ `select` 排除 password |

## 错误提示统一处理

```typescript
// src/common/utils/prisma-error.ts（Day 17 的工具函数）
import { Prisma } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

export function handlePrismaError(
  error: unknown,
  customMessages?: Record<string, string>,
): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const messages = {
      P2002: '该记录已存在',
      P2025: '记录不存在',
      P2003: '关联数据不存在',
      ...customMessages,
    };

    const message = messages[error.code] || '数据库操作失败';
    const status = error.code === 'P2025' ? 404 : 400;

    if (status === 404) throw new NotFoundException(message);
    throw new BadRequestException(message);
  }
  throw error;
}
```

> 至此，UserService 的代码从"手动遍历 JSON 数组"变成了"声明式数据库查询"。代码更短、更安全、性能更好。下一节重构 BookService。

---

## 参考链接

- [Prisma — CRUD](https://www.prisma.io/docs/concepts/components/prisma-client/crud)
- [Prisma — Select Fields](https://www.prisma.io/docs/concepts/components/prisma-client/select-fields)
- [bcrypt — npm](https://www.npmjs.com/package/bcrypt)
