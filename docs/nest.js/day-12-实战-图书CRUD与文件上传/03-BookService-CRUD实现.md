# BookService CRUD 完整实现

## 完整代码

```typescript
// src/book/book.service.ts
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { Book, BookStatus } from './entities/book.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { QueryBookDto } from './dto/query-book.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class BookService {
  @Inject(DbService)
  private dbService: DbService;

  // ========== 列表查询（分页 + 模糊搜索）==========
  async list(query: QueryBookDto) {
    const books: Book[] = await this.dbService.read<Book>();
    const { page = 1, size = 10, keyword } = query;

    // 1. 过滤
    let filtered = books;
    if (keyword) {
      const kw = keyword.toLowerCase();
      filtered = books.filter(
        b =>
          b.title.toLowerCase().includes(kw) ||
          b.author.toLowerCase().includes(kw),
      );
    }

    // 2. 分页
    const total = filtered.length;
    const start = (page - 1) * size;
    const list = filtered.slice(start, start + size);

    return { list, total, page, size };
  }

  // ========== 详情 ==========
  async findById(id: string) {
    const books: Book[] = await this.dbService.read<Book>();
    const book = books.find(b => b.id === id);

    if (!book) {
      throw new BadRequestException('图书不存在');
    }

    return book;
  }

  // ========== 新增 ==========
  async create(dto: CreateBookDto) {
    const books: Book[] = await this.dbService.read<Book>();

    const newBook: Book = {
      id: randomUUID(),
      ...dto,
      status: dto.status || BookStatus.AVAILABLE,  // 默认可借
      cover: '',                                    // 图片上传后更新
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    books.push(newBook);
    await this.dbService.write(books);

    return {
      id: newBook.id,
      title: newBook.title,
    };
  }

  // ========== 更新 ==========
  async update(id: string, dto: UpdateBookDto) {
    const books: Book[] = await this.dbService.read<Book>();
    const index = books.findIndex(b => b.id === id);

    if (index === -1) {
      throw new BadRequestException('图书不存在');
    }

    // 只更新传入的字段
    if (dto.title !== undefined) books[index].title = dto.title;
    if (dto.author !== undefined) books[index].author = dto.author;
    if (dto.isbn !== undefined) books[index].isbn = dto.isbn;
    if (dto.price !== undefined) books[index].price = dto.price;
    if (dto.description !== undefined) books[index].description = dto.description;
    if (dto.status !== undefined) books[index].status = dto.status;
    books[index].updatedAt = new Date().toISOString();

    await this.dbService.write(books);

    return {
      id: books[index].id,
      title: books[index].title,
    };
  }

  // ========== 删除 ==========
  async remove(id: string) {
    const books: Book[] = await this.dbService.read<Book>();
    const index = books.findIndex(b => b.id === id);

    if (index === -1) {
      throw new BadRequestException('图书不存在');
    }

    books.splice(index, 1);
    await this.dbService.write(books);

    return { message: '删除成功' };
  }

  // ========== 更新封面（文件上传后调用）==========
  async updateCover(id: string, coverUrl: string) {
    const books: Book[] = await this.dbService.read<Book>();
    const book = books.find(b => b.id === id);

    if (!book) {
      throw new BadRequestException('图书不存在');
    }

    book.cover = coverUrl;
    book.updatedAt = new Date().toISOString();
    await this.dbService.write(books);
  }
}
```

## 设计要点

### 1. 分页计算在内存中完成

```typescript
const start = (page - 1) * size;
const list = filtered.slice(start, start + size);
// page=1, size=10 → start=0 → slice(0, 10)
// page=2, size=10 → start=10 → slice(10, 20)
```

Day 19 换成 Prisma 后，分页会变成 `prisma.book.findMany({ skip: 10, take: 10 })`——SQL 层面分页，更高效。

### 2. 模糊搜索

```typescript
const kw = keyword.toLowerCase();
filtered = books.filter(
  b =>
    b.title.toLowerCase().includes(kw) ||
    b.author.toLowerCase().includes(kw),
);
```

这是全文扫描——数据量小时没问题。Day 19 会换为 SQL `LIKE`，Day 25 可能引入 Elasticsearch。

### 3. 更新时只改传入字段

```typescript
if (dto.title !== undefined) books[index].title = dto.title;
// 而不是 books[index] = { ...books[index], ...dto }
// 后者会把 undefined 也覆盖上去（如果 dto 中有明确传了 undefined 的字段）
```

### 4. 返回精简信息

```typescript
return { id: newBook.id, title: newBook.title };
// 不返回完整实体——前端创建成功后只需要 id 和 title
```

## JSON 文件存储的局限性

到 Day 12，`books.json` 可能已经有几十条记录。每次 `list` 操作都是：
1. 读取整个 `books.json` 文件
2. 在内存中过滤和分页
3. 不需要回写

当数据量达到几百条时，list 仍然很快（JSON 解析毫秒级）。但达到几千条时，每次解析整个文件的性能就不可接受了——这是我们从 Day 14 开始引入数据库的原因。

> 这个 BookService 已经是"完全可用"的图书管理后端——支持分页搜索、增删改查。Day 19 的迁移纯粹是换底层存储（JSON → MySQL/PostgreSQL），接口和返回格式完全不变。

---

## 参考链接

- [NestJS — Providers](https://docs.nestjs.com/providers)
- 开源笔记：《Nest 通关秘籍》.doc/28.图书管理系统：用户模块后端开发.md
