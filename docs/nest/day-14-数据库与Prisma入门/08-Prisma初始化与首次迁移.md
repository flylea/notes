# Prisma 初始化与首次迁移

## 安装

```bash
npm install prisma --save-dev
npm install @prisma/client
npx prisma init
```

这三步之后会生成：

```
prisma/
└── schema.prisma     # Prisma Schema 文件
.env                  # 数据库连接串（如果不存在则创建）
```

## schema.prisma 初始结构

```prisma
// 1. 数据源配置
datasource db {
  provider = "mysql"  // 或 "postgresql"
  url      = env("DATABASE_URL")
}

// 2. 代码生成器配置
generator client {
  provider = "prisma-client-js"
}

// 3. 数据模型（目前为空）
```

## 配置数据库连接

```env
# .env — MySQL
DATABASE_URL="mysql://root:password@localhost:3306/book_management"

# .env — PostgreSQL
DATABASE_URL="postgresql://postgres:password@localhost:5432/book_management?schema=public"
```

URL 格式：`协议://用户名:密码@主机:端口/数据库名?参数`

## 第一个 Model

```prisma
// prisma/schema.prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        Int      @id @default(autoincrement())
  username  String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## 执行首次迁移

```bash
npx prisma migrate dev --name init
```

这个命令做了三件事：

1. **生成 SQL 迁移文件** → `prisma/migrations/20260510000000_init/migration.sql`
   ```sql
   -- 自动生成的 SQL：
   CREATE TABLE `User` (
     `id` INTEGER NOT NULL AUTO_INCREMENT,
     `username` VARCHAR(191) NOT NULL,
     `password` VARCHAR(191) NOT NULL,
     `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
     `updatedAt` DATETIME(3) NOT NULL,
     UNIQUE INDEX `User_username_key`(`username`),
     PRIMARY KEY (`id`)
   ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. **执行 SQL** → 在数据库中创建表

3. **生成 Prisma Client** → 类型安全的 JS/TS 客户端

## Prisma Client 的使用

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 之后就可以用类型安全的方式操作数据库
const user = await prisma.user.create({
  data: { username: 'john', password: '123456' },
});
```

## Prisma CLI 核心命令

| 命令 | 作用 |
|------|------|
| `prisma init` | 初始化项目，创建 schema.prisma |
| `prisma generate` | 根据 Schema 重新生成 Prisma Client |
| `prisma migrate dev --name xxx` | 创建并执行迁移（开发环境） |
| `prisma migrate deploy` | 应用所有未执行的迁移（生产环境） |
| `prisma migrate status` | 查看迁移状态 |
| `prisma db push` | 直接同步 Schema 到数据库（不用迁移文件，原型阶段用） |
| `prisma db seed` | 执行种子数据脚本 |
| `prisma studio` | 打开可视化数据库管理界面 |

## 前端视角类比

```
prisma/schema.prisma  ↔  TypeScript Interface 定义
prisma migrate        ↔  Vuex/Pinia Store 的 Schema 变更
prisma generate       ↔  tsc 编译（生成运行时代码）
Prisma Client         ↔  Axios 实例（封装了底层调用）
prisma studio         ↔  Vue DevTools / Redux DevTools（可视化查看数据）
```

> Day 14 完成后，你的项目应该已经具备了 Prisma 的基础环境。Day 15 会展开完整的 Schema 设计。

---

## 参考链接

- [Prisma — Quickstart](https://www.prisma.io/docs/getting-started/quickstart)
- [Prisma — Schema](https://www.prisma.io/docs/concepts/components/prisma-schema)
- [Prisma — Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- 开源笔记：《Nest 通关秘籍》.doc/36.Prisma入门.md、doc/37.Prisma命令速查.md
