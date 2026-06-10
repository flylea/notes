# 重构 BookService：分页 + 模糊搜索 + 关联查询

## 迁移前：Day 12 的 BookService

```typescript
// src/book/book.service.ts（旧版）
@Injectable()
export class BookService {
  constructor(private dbService: DbService) {}

  async list(query: { page: number; size: number; keyword?: string }) {
    const books = await this.dbService.read<Book>('books');  // 全量加载

    let filtered = books;
    if (query.keyword) {
      filtered = books.filter(
        b => b.title.includes(query.keyword) || b.author.includes(query.keyword),
      );
    }

    const total = filtered.length;
    const start = (query.page - 1) * query.size;
    const list = filtered.slice(start, start + query.size);

    return { list, total, page: query.page, size: query.size };
  }

  async findById(id: string) {
    const books = await this.dbService.read<Book>('books');
    return books.find(b => b.id === id) || null;
  }

  async create(dto: any) {
    const books = await this.dbService.read<Book>('books');
    const newBook = {
      id: randomBytes(8).toString('hex'),
      ...dto,
      createdAt: new Date().toISOString(),
      status: 'AVAILABLE',
    };
    books.push(newBook);
    await this.dbService.write('books', books);
    return newBook;
  }
}
```

## 迁移后：Day 19 的 BookService

```typescript
// src/book/book.service.ts（新版）
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class BookService {
  constructor(private prisma: PrismaService) {}

  async list(query: { page: number; size: number; keyword?: string }) {
    const { page, size, keyword } = query;

    // 构建查询条件
    const where: Prisma.BookWhereInput = {};

    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { author: { contains: keyword } },
        { isbn: { contains: keyword } },
      ];
    }

    // 并行查询：列表 + 总数
    const [list, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        skip: (page - 1) * size,
        take: size,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true } },
        },
      }),
      this.prisma.book.count({ where }),
    ]);

    return { list, total, page, size };
  }

  async findById(id: number) {
    const book = await this.prisma.book.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        tags: {
          include: { tag: { select: { id: true, name: true } } },
        },
      },
    });

    if (!book) {
      throw new BadRequestException('图书不存在');
    }

    // 转换 tags 格式：BookTag[] → Tag[]
    return {
      ...book,
      tags: book.tags.map(bt => bt.tag),
    };
  }

  async create(dto: Prisma.BookCreateInput) {
    try {
      return await this.prisma.book.create({
        data: dto,
        include: {
          category: { select: { id: true, name: true } },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('ISBN 已存在');
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException('关联的分类不存在');
      }
      throw error;
    }
  }

  async update(id: number, dto: Prisma.BookUpdateInput) {
    try {
      return await this.prisma.book.update({
        where: { id },
        data: dto,
        include: {
          category: { select: { id: true, name: true } },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new BadRequestException('图书不存在');
      }
      throw error;
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.book.delete({ where: { id } });
      return { success: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new BadRequestException('图书不存在');
      }
      throw error;
    }
  }

  // 按分类查询
  async findByCategory(categoryId: number, query: { page: number; size: number }) {
    const { page, size } = query;

    const where = { categoryId };

    const [list, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        skip: (page - 1) * size,
        take: size,
        include: { category: { select: { name: true } } },
      }),
      this.prisma.book.count({ where }),
    ]);

    return { list, total, page, size };
  }

  // 获取热门图书（借阅次数最多）
  async getHotBooks(limit: number = 10) {
    return this.prisma.book.findMany({
      orderBy: { borrows: { _count: 'desc' } },
      take: limit,
      include: {
        category: { select: { name: true } },
      },
    });
  }
}
```

## 分页查询性能对比

```typescript
// JSON 文件版本
async list(query) {
  const books = await this.dbService.read('books');  // 10000 本书 ≈ 50MB JSON
  // 每次请求：解析 50MB → 内存过滤 → slice
  // 100 并发 → 5GB 内存占用！
}

// Prisma 数据库版本
async list(query) {
  // MySQL: SELECT * FROM books WHERE ... LIMIT 20 OFFSET 0
  // 每次请求：只返回 20 条 → ~2KB 数据
  // 100 并发 → 200KB 内存占用！
}
```

## Decimal 价格类型处理

```typescript
// Prisma 的 Decimal 类型在 JS 中是 Prisma.Decimal 对象
import { Prisma } from '@prisma/client';

// 在 Service 中查询后转换
async list(query: any) {
  const books = await this.prisma.book.findMany(...);

  // 将 Decimal 转为数字以便 JSON 序列化
  return books.map(book => ({
    ...book,
    price: book.price ? book.price.toNumber() : null,
  }));
}

// 或使用 class-transformer 在响应拦截器中统一处理
// Day 10 的 TransformInterceptor 已处理此场景
```

## 关键变化总结

| 功能 | 迁移前（JSON） | 迁移后（Prisma） |
|------|-------------|---------------|
| 列表查询 | 全量加载 + 内存 filter + slice | `findMany({ skip, take })` |
| 模糊搜索 | `String.includes()` | SQL `WHERE ... LIKE '%keyword%'` |
| 总数 | `filtered.length` | `count({ where })` |
| 创建 | push + 写回全量 | `create({ data })` 单条插入 |
| 关联查询 | 多次读 + 手动 join | `include: { category: true }` |
| ID | 随机字符串 | 自增整数 |
| 错误处理 | 手动判断 | Prisma 错误码（P2002/P2025） |

---

## 参考链接

- [Prisma — Filtering and Sorting](https://www.prisma.io/docs/concepts/components/prisma-client/filtering-and-sorting)
- [Prisma — Pagination](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)
- [Prisma — Relation Queries](https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries)
