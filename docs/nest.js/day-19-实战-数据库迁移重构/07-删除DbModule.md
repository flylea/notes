# 移除 DbModule 和 DbService

## 清理步骤

### Step 1：从 UserModule 移除 DbModule 依赖

```typescript
// src/user/user.module.ts
import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';

@Module({
  // imports: [DbModule.register('users')],  ← 删除这行
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],  // 新增：导出 UserService 供其他模块使用
})
export class UserModule {}
```

### Step 2：从 BookModule 移除 DbModule 依赖

```typescript
// src/book/book.module.ts
import { Module } from '@nestjs/common';
import { BookService } from './book.service';
import { BookController } from './book.controller';

@Module({
  // imports: [DbModule.register('books')],  ← 删除这行
  controllers: [BookController],
  providers: [BookService],
})
export class BookModule {}
```

### Step 3：删除 DbModule 和 DbService 文件

```bash
# 删除整个 db 目录
rm -rf src/db/

# 或逐个删除
rm src/db/db.module.ts
rm src/db/db.service.ts
rmdir src/db
```

### Step 4：清理 AppModule

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { BookModule } from './book/book.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    PrismaModule,   // 全局 Prisma 模块
    UserModule,
    BookModule,
    // 删除 DbModule 相关 import
  ],
  controllers: [AppController],
})
export class AppModule {}
```

### Step 5：删除不再需要的依赖和文件

```bash
# 1. 删除 users.json 和 books.json 等旧数据文件
rm data/users.json data/books.json

# 2. 如果项目中还有旧的 data 目录，可以删除（数据已在数据库中）
rm -rf data/

# 3. 检查是否有其他地方引用了 DbService
# 在 VS Code 中全局搜索 "DbService" 和 "DbModule"，确保无残留引用
```

## 迁移前后 AppModule 对比

```typescript
// 迁移前
@Module({
  imports: [
    DbModule.register('users'),       // ❌ JSON 文件
    UserModule,
    BookModule,
  ],
})

// 迁移后
@Module({
  imports: [
    PrismaModule,                     // ✅ 数据库
    UserModule,
    BookModule,
  ],
})
```

## 目录结构变化

```
迁移前：                          迁移后：
src/                             src/
├── app.module.ts                ├── app.module.ts
├── main.ts                      ├── main.ts
├── db/           ← 删除         ├── prisma/        ← 新增
│   ├── db.module.ts             │   ├── prisma.service.ts
│   └── db.service.ts            │   └── prisma.module.ts
├── user/                        ├── user/
│   ├── user.module.ts           │   ├── user.module.ts
│   ├── user.controller.ts       │   ├── user.controller.ts
│   ├── user.service.ts          │   ├── user.service.ts
│   └── dto/                     │   └── dto/
└── book/                        └── book/
    ├── book.module.ts               ├── book.module.ts
    ├── book.controller.ts           ├── book.controller.ts
    ├── book.service.ts              ├── book.service.ts
    └── dto/                         └── dto/
```

## 编译验证

```bash
# 确保删除后项目能正常编译
npm run build

# 如果没有报错，说明清理干净
# 如果有报错，根据错误信息修复（通常是残留的 import）
```

## 数据迁移注意事项

如果之前的 JSON 文件中有重要的测试数据，可以先写一个迁移脚本导入到数据库：

```typescript
// scripts/migrate-json-to-db.ts（一次性脚本）
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function migrate() {
  // 读取旧数据
  const users = JSON.parse(fs.readFileSync('data/users.json', 'utf-8'));
  const books = JSON.parse(fs.readFileSync('data/books.json', 'utf-8'));

  // 迁移用户
  for (const user of users) {
    await prisma.user.create({
      data: {
        username: user.username,
        password: await bcrypt.hash(user.password, 10),
        role: 'USER',
      },
    });
  }

  // 迁移图书
  for (const book of books) {
    await prisma.book.create({
      data: {
        title: book.title,
        author: book.author,
        isbn: book.isbn || null,
        status: book.status === 'borrowed' ? 'BORROWED' : 'AVAILABLE',
        price: book.price || null,
      },
    });
  }

  console.log(`迁移完成：${users.length} 用户，${books.length} 图书`);
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

> 通常开发阶段的数据不需要迁移——直接删掉 JSON 文件，运行 seed 脚本生成新的测试数据即可。

---

## 参考链接

- [NestJS — Modules](https://docs.nestjs.com/modules)
