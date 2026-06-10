# 在业务 Service 中注入 PrismaService

## 构造器注入

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookService {
  constructor(private prisma: PrismaService) {}

  async list(query: { page: number; size: number }) {
    const { page, size } = query;
    const [list, total] = await Promise.all([
      this.prisma.book.findMany({
        skip: (page - 1) * size,
        take: size,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.book.count(),
    ]);

    return { list, total, page, size };
  }
}
```

## JSON 存储 vs Prisma 存储对比

```typescript
// Day 6-12：JSON 文件版本
@Injectable()
export class BookService {
  @Inject(DbService)
  private dbService: DbService;

  async findById(id: string) {
    const books = await this.dbService.read<Book>();
    return books.find(b => b.id === id);
  }
}

// Day 17：Prisma 版本
@Injectable()
export class BookService {
  constructor(private prisma: PrismaService) {}

  async findById(id: number) {
    return this.prisma.book.findUnique({ where: { id } });
  }
}
```

接口调用方式不变（Controller 无感），但底层从全量 JSON 读取变成了 SQL 精确查询——性能提升巨大。

## 类型安全的查询

```typescript
// Prisma 自动生成精确类型
async findById(id: number) {
  const book = await this.prisma.book.findUnique({
    where: { id },
    include: { borrows: true },
  });

  // book 的类型：Book & { borrows: BorrowRecord[] } | null
  // 智能提示：book?.title, book?.borrows[0].returnedAt
  return book;
}
```

## 关联查询示例

```typescript
// 查一本书及其借阅记录和借阅者
async findDetail(id: number) {
  return this.prisma.book.findUnique({
    where: { id },
    include: {
      borrows: {
        where: { returnedAt: null },  // 只加载当前借阅
        include: {
          user: {
            select: { id: true, username: true },  // 只返回用户名
          },
        },
      },
      categories: { select: { name: true } },
    },
  });
}
```

> 注入 PrismaService 后，Service 层的代码从"JSON 数组操作"变成了"SQL 查询构建"。Day 19 会完成整个项目的迁移。

---

## 参考链接

- [NestJS — Providers](https://docs.nestjs.com/providers)
- [Prisma — Type-safe API](https://www.prisma.io/docs/concepts/components/prisma-client)
