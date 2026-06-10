# 更新 Controller 层

## Controller 层变化很小

得益于 DI 架构，Service 层的重构对 Controller **几乎无影响**。只需要处理几个类型变化：

1. ID 类型：`string` → `number`
2. 分页参数增加
3. DTO 参数增加

## 迁移后的 UserController

```typescript
// src/user/user.controller.ts
import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  async register(@Body() body: { username: string; password: string }) {
    return this.userService.register(body);
  }

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    return this.userService.login(body);
  }
}
```

> UserController 几乎没变化，只是 Service 的内部实现从 JSON 变成了 Prisma。

## 迁移后的 BookController

```typescript
// src/book/book.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BookService } from './book.service';
import { Prisma } from '@prisma/client';
import { bookCoverStorage } from '../common/storage/book-cover.storage';

@Controller('book')
export class BookController {
  constructor(private readonly bookService: BookService) {}

  // 列表查询（分页 + 模糊搜索）
  @Get('list')
  async list(
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.bookService.list({
      page: page ? parseInt(page, 10) : 1,
      size: size ? parseInt(size, 10) : 10,
      keyword,
    });
  }

  // 图书详情
  @Get('detail')
  async detail(@Query('id') id: string) {
    const bookId = parseInt(id, 10);
    if (isNaN(bookId)) {
      throw new BadRequestException('无效的图书 ID');
    }
    return this.bookService.findById(bookId);
  }

  // 新增图书
  @Post('create')
  async create(@Body() body: Prisma.BookCreateInput) {
    return this.bookService.create(body);
  }

  // 更新图书
  @Post('update')
  async update(
    @Body('id') id: string,
    @Body() body: Prisma.BookUpdateInput,
  ) {
    const bookId = parseInt(id, 10);
    if (isNaN(bookId)) {
      throw new BadRequestException('无效的图书 ID');
    }
    return this.bookService.update(bookId, body);
  }

  // 删除图书
  @Post('delete')
  async remove(@Body('id') id: string) {
    const bookId = parseInt(id, 10);
    if (isNaN(bookId)) {
      throw new BadRequestException('无效的图书 ID');
    }
    return this.bookService.remove(bookId);
  }

  // 上传封面（保持不变，仍用 multer）
  @Post('upload-cover')
  @UseInterceptors(FileInterceptor('cover', { storage: bookCoverStorage }))
  async uploadCover(
    @Body('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const bookId = parseInt(id, 10);
    const coverUrl = `/uploads/covers/${file.filename}`;
    return this.bookService.update(bookId, { cover: coverUrl } as Prisma.BookUpdateInput);
  }
}
```

## ID 类型变化处理

```typescript
// 迁移前：ID 是字符串
// GET /book/detail?id=abc123def
async detail(@Query('id') id: string) {
  return this.bookService.findById(id);  // string
}

// 迁移后：ID 是数字
// GET /book/detail?id=1
async detail(@Query('id') id: string) {
  const bookId = parseInt(id, 10);       // string → number
  if (isNaN(bookId)) {
    throw new BadRequestException('无效的图书 ID');
  }
  return this.bookService.findById(bookId);  // number
}
```

> Query 参数从 HTTP 请求过来始终是 string，所以 Controller 层负责 `parseInt` 转换和校验。这是 Controller 层的职责——协议转换。

## 务实 API 设计总结

```
全部接口使用 GET/POST：

GET  /book/list         ?page=1&size=10&keyword=NestJS
GET  /book/detail       ?id=1
POST /book/create        body: { title, author, ... }
POST /book/update        body: { id, title, ... }
POST /book/delete        body: { id }
POST /book/upload-cover  form-data: { id, cover }

用户接口：
POST /user/register      body: { username, password }
POST /user/login         body: { username, password }
```

---

## 参考链接

- [NestJS — Controllers](https://docs.nestjs.com/controllers)
- [NestJS — Request Payloads](https://docs.nestjs.com/controllers#request-payloads)
