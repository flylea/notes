# BookController — 务实的 API 设计

## 完整代码

```typescript
// src/book/book.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { BookService } from './book.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { QueryBookDto } from './dto/query-book.dto';

@Controller('book')
export class BookController {
  constructor(private readonly bookService: BookService) {}

  // ========== 图书列表（分页 + 搜索）==========
  @Get('list')
  async list(@Query() query: QueryBookDto) {
    return this.bookService.list(query);
  }

  // ========== 图书详情 ==========
  @Get('detail')
  async detail(@Query('id') id: string) {
    return this.bookService.findById(id);
  }

  // ========== 新增图书 ==========
  @Post('create')
  async create(@Body() dto: CreateBookDto) {
    return this.bookService.create(dto);
  }

  // ========== 更新图书 ==========
  @Post('update')
  async update(
    @Query('id') id: string,
    @Body() dto: UpdateBookDto,
  ) {
    return this.bookService.update(id, dto);
  }

  // ========== 删除图书 ==========
  @Post('delete')
  async remove(@Query('id') id: string) {
    return this.bookService.remove(id);
  }
}
```

## 务实 API 设计原则

### 为什么不用 RESTful 标准动词？

标准 RESTful：
```
GET    /book          → 列表
GET    /book/:id      → 详情
POST   /book          → 新增
PATCH  /book/:id      → 更新
DELETE /book/:id      → 删除
```

本项目的设计：
```
GET  /book/list?id=xxx       → 列表
GET  /book/detail?id=xxx     → 详情
POST /book/create             → 新增
POST /book/update?id=xxx     → 更新
POST /book/delete?id=xxx     → 删除
```

### 为什么这样选择？

1. **前端调用更简单**：`POST /book/update?id=123` 不需要前端拼接 `/book/123` 路径，参数统一用 Query String 和 Body
2. **避免特殊字符问题**：ID 中可能包含 `/` 等特殊字符时，URL 路径参数需要 URL 编码，Query String 更安全
3. **网关/防火墙兼容性**：某些网关对 PUT/DELETE 有限制，GET/POST 普适性最好
4. **工具链统一**：Postman、curl、前端 SDK 测试时统一传参方式

### 什么时候应该用 RESTful？

- API 需要对外暴露给第三方开发者（公共 API）
- 团队有成熟的 RESTful 实践
- 使用自动生成 SDK 的工具（如 OpenAPI Generator）

对于企业内部的业务系统，GET/POST 为主 + 动词路径（`/create`, `/update`, `/delete`）是最务实的选择。

## 接口完整清单

| 接口 | 方法 | 参数 |
|------|------|------|
| `/book/list` | GET | `?page=1&size=10&keyword=Nest` |
| `/book/detail` | GET | `?id=xxx` |
| `/book/create` | POST | Body: CreateBookDto |
| `/book/update` | POST | `?id=xxx` + Body: UpdateBookDto |
| `/book/delete` | POST | `?id=xxx` |

> 本书贯穿始终贯彻 GET/POST 为主的务实风格。这不是"偷懒"，而是经过大量企业项目验证的工程实践。

---

## 参考链接

- [NestJS — Controllers](https://docs.nestjs.com/controllers)
- 开源笔记：《Nest 通关秘籍》.doc/5.HTTP数据传输.md、doc/28.图书管理系统：用户模块后端开发.md
