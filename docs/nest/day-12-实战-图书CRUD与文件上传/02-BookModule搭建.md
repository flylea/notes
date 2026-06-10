# 用 nest g resource 生成 Book 模块

## `nest g resource` 是什么

Nest CLI 提供了 `resource` schematic，一键生成一个完整的 CRUD 模块：

```bash
nest g resource book
```

会生成以下文件：

```
src/book/
├── dto/
│   ├── create-book.dto.ts
│   └── update-book.dto.ts
├── entities/
│   └── book.entity.ts
├── book.controller.ts
├── book.service.ts
├── book.module.ts
```

同时自动更新 `app.module.ts` 中的 imports。

## Interactive 选项

```bash
nest g resource book

? What transport layer do you use?
  ❯ REST API
    GraphQL (code first)
    GraphQL (schema first)
    Microservice (non-HTTP)
    WebSockets

? Would you like to generate CRUD entry points? (Y/n)
  Y → 生成 findAll/findOne/create/update/remove 五个方法骨架
  n → 只生成空的 Controller 和 Service
```

## 生成后的骨架代码

```typescript
// book.controller.ts (自动生成)
@Controller('book')
export class BookController {
  constructor(private readonly bookService: BookService) {}

  @Post()
  create(@Body() createBookDto: CreateBookDto) {}

  @Get()
  findAll() {}

  @Get(':id')
  findOne(@Param('id') id: string) {}

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBookDto: UpdateBookDto) {}

  @Delete(':id')
  remove(@Param('id') id: string) {}
}
```

## 调整骨架为务实风格（GET/POST）

根据本项目设计规范，我们将默认的 RESTful 接口调整为 GET/POST 为主：

```typescript
// 删除 RESTful 风格的方法，改为：
@Post('create')    // 代替 @Post()
@Post('update')    // 代替 @Patch(':id')
@Post('delete')    // 代替 @Delete(':id')
@Get('list')       // 代替 @Get()
@Get('detail')     // 代替 @Get(':id')
```

> ⚠️ `nest g resource` 是模板——不是最终答案。根据项目规范调整骨架代码是正常的。

## BookModule 配置

```typescript
// src/book/book.module.ts
import { Module } from '@nestjs/common';
import { BookController } from './book.controller';
import { BookService } from './book.service';
import { DbModule } from '../db/db.module';

@Module({
  imports: [
    DbModule.register({ path: 'books.json' }),  // ← 复用 DbModule，读 books.json
  ],
  controllers: [BookController],
  providers: [BookService],
})
export class BookModule {}
```

## AppModule 更新

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { BookModule } from './book/book.module';

@Module({
  imports: [UserModule, BookModule],  // ← BookModule 是自动加的
})
export class AppModule {}
```

## 此时的项目结构

```
src/
├── user/
│   ├── dto/
│   ├── entities/
│   ├── user.controller.ts
│   ├── user.service.ts
│   └── user.module.ts
├── book/
│   ├── dto/
│   ├── entities/
│   ├── book.controller.ts
│   ├── book.service.ts
│   └── book.module.ts
├── db/
│   ├── db.service.ts
│   └── db.module.ts      ← 动态模块，User 和 Book 都复用
└── app.module.ts
```

> `DbModule` 的设计威力在这里完全显现——UserModule 传 `{ path: 'users.json' }`，BookModule 传 `{ path: 'books.json' }`，同一个 `DbService` 读写不同的文件。如果当时 DbModule 不是动态模块，每个模块都要自己写一遍读写逻辑。

---

## 参考链接

- [NestJS — CLI Resource](https://docs.nestjs.com/recipes/crud-generator)
- [NestJS — Dynamic Modules](https://docs.nestjs.com/fundamentals/dynamic-modules)
- 开源笔记：《Nest 通关秘籍》.doc/28.图书管理系统：用户模块后端开发.md
