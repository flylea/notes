# 共享 DTO / Utils / PrismaService 库

## 为什么抽共享库

在没有 Monorepo 之前，多个 Nest 应用之间的"复用"往往靠复制粘贴：

```
user-api/src/dto/create-book.dto.ts    ← 同一份文件
admin-api/src/dto/create-book.dto.ts   ← 同一份文件（手动同步，迟早不一致）
```

有了 Monorepo 后：

```
libs/shared-dto/src/book.dto.ts        ← 唯一定义
  ↑                    ↑
user-api              admin-api         自动引用，永远一致
```

> 前端类比：这就像把通用组件抽到 `components/common/` 目录，而不是每个页面里都写一份 Button。

## 共享库 1：shared-dto（DTO / Entity / Enum）

```
libs/shared-dto/
└── src/
    ├── index.ts              # 统一导出
    ├── user.dto.ts
    ├── book.dto.ts
    ├── borrow.dto.ts
    ├── pagination.dto.ts     # 通用分页 DTO
    └── enums/
        └── book-status.enum.ts
```

```typescript
// libs/shared-dto/src/pagination.dto.ts
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页条数', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number = 10;
}

export class PaginatedResult<T> {
  list: T[];
  total: number;
  page: number;
  size: number;

  static of<T>(list: T[], total: number, page: number, size: number) {
    const result = new PaginatedResult<T>();
    result.list = list;
    result.total = total;
    result.page = page;
    result.size = size;
    return result;
  }
}
```

```typescript
// libs/shared-dto/src/book.dto.ts
import { IsNotEmpty, IsString, IsOptional, IsNumber, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookDto {
  @ApiProperty({ description: '书名' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: '作者' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  author: string;

  @ApiPropertyOptional({ description: 'ISBN' })
  @IsOptional()
  @IsString()
  isbn?: string;

  @ApiPropertyOptional({ description: '分类 ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  categoryId?: number;
}

export class QueryBookDto extends PaginationDto {
  @ApiPropertyOptional({ description: '搜索关键词' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '分类ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  categoryId?: number;
}
```

```typescript
// libs/shared-dto/src/index.ts —— 统一导出
export * from './pagination.dto';
export * from './user.dto';
export * from './book.dto';
export * from './borrow.dto';
export * from './enums/book-status.enum';
```

**在应用中引用**：

```typescript
// apps/user-api/src/book/book.controller.ts
import { CreateBookDto, QueryBookDto, PaginatedResult } from '@app/shared-dto';

@Controller('book')
export class BookController {
  @Post('create')
  create(@Body() dto: CreateBookDto) { /* ... */ }

  @Get('list')
  async list(@Query() dto: QueryBookDto): Promise<PaginatedResult<Book>> {
    // ...
  }
}
```

## 共享库 2：shared-utils（工具函数 / 常量）

```
libs/shared-utils/
└── src/
    ├── index.ts
    ├── password.util.ts      # bcrypt 加解密
    ├── id-generator.util.ts  # 雪花 ID / UUID
    ├── date.util.ts          # 日期格式化
    └── constants.ts          # 业务常量
```

```typescript
// libs/shared-utils/src/password.util.ts
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

```typescript
// libs/shared-utils/src/constants.ts
export const BOOK_STATUS = {
  AVAILABLE: 'AVAILABLE',
  BORROWED: 'BORROWED',
  MAINTENANCE: 'MAINTENANCE',
  LOST: 'LOST',
} as const;

export const MAX_BORROW_COUNT = 5;
export const BORROW_DURATION_DAYS = 30;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_SIZE: 10,
  MAX_SIZE: 100,
} as const;
```

```typescript
// libs/shared-utils/src/id-generator.util.ts
import { v4 as uuidv4 } from 'uuid';

/** 生成带前缀的短 ID：book_a1b2c3d4 */
export function generateId(prefix: string): string {
  return `${prefix}_${uuidv4().split('-')[0]}`;
}

// 用法：generateId('book') → "book_a1b2c3d4"
```

## 共享库 3：prisma-client（共享 PrismaService）

这是 Monorepo 最大的收益之一——多个 Nest 应用共用一个 PrismaService，避免"每个应用都配一套 Prisma"。

```
libs/prisma-client/
└── src/
    ├── index.ts
    ├── prisma.module.ts
    └── prisma.service.ts
```

```typescript
// libs/prisma-client/src/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

```typescript
// libs/prisma-client/src/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

```typescript
// libs/prisma-client/src/index.ts
export * from './prisma.module';
export * from './prisma.service';
```

**共享 Prisma 的注意事项**——schema.prisma 放哪里？

```
方案 A：放在 libs/prisma-client/prisma/     ← 推荐
方案 B：放在仓库根目录 /prisma/              ← 也可以
```

方案 A 的配置：

```
libs/prisma-client/
├── src/
│   ├── index.ts
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── prisma/
│   ├── schema.prisma       ← 统一的 Schema
│   └── migrations/
└── tsconfig.lib.json
```

```json
// libs/prisma-client/tsconfig.lib.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/libs/prisma-client"
  }
}
```

```prisma
// libs/prisma-client/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  // 指定输出到库的 node_modules
  output   = "../node_modules/.prisma/client"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// 所有 model 定义在这里，user-api 和 admin-api 共享
model User { /* ... */ }
model Book { /* ... */ }
model BorrowRecord { /* ... */ }
```

```bash
# 生成 Prisma Client
cd libs/prisma-client && npx prisma generate

# 运行迁移
cd libs/prisma-client && npx prisma migrate dev
```

## 完整引用示例

```typescript
// apps/admin-api/src/app.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma-client';        // ← 共享库
import { BooksController } from './books/books.controller';
import { BooksService } from './books/books.service';

@Module({
  imports: [PrismaModule],
  controllers: [BooksController],
  providers: [BooksService],
})
export class AppModule {}
```

```typescript
// apps/admin-api/src/books/books.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/prisma-client';
import { CreateBookDto, QueryBookDto, PaginatedResult } from '@app/shared-dto';
import { BOOK_STATUS } from '@app/shared-utils';

@Injectable()
export class BooksService {
  constructor(private prisma: PrismaService) {}

  async list(dto: QueryBookDto) {
    const { page, size, keyword } = dto;
    const where = keyword
      ? { OR: [
            { title: { contains: keyword } },
            { author: { contains: keyword } },
          ]}
      : {};

    const [list, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.book.count({ where }),
    ]);

    return PaginatedResult.of(list, total, page, size);
  }

  async create(dto: CreateBookDto) {
    return this.prisma.book.create({
      data: { ...dto, status: BOOK_STATUS.AVAILABLE },
    });
  }
}
```

## 共享库的设计原则

```
1. 单向依赖
   shared-dto (最底层，无依赖)
     ↑
   shared-utils (可能依赖 shared-dto 的类型)
     ↑
   prisma-client (可能依赖 shared-dto 的类型)
     ↑
   apps (依赖所有 libs)

2. 不要泛化过度
   只抽真正被多个应用使用的东西
   如果只有 user-api 用，就放在 user-api 内部

3. 版本一致性
   共享库不需要 npm publish / 版本号
   所有消费者用的就是当前仓库的代码——天然一致

4. 测试影响范围
   改一个共享库 → 所有引用它的应用都可能受影响
   所以共享库的变更需要更高的测试覆盖
```

---

## 参考链接

- [NestJS — Libraries](https://docs.nestjs.com/cli/libraries)
- [NestJS — Monorepo Mode](https://docs.nestjs.com/cli/monorepo)
- [Prisma — Monorepo Setup](https://www.prisma.io/docs/guides/other/multi-tenant-monorepo)
- [Turborepo — Shared Packages](https://turbo.build/repo/docs/handbook/sharing-code/internal-packages)
