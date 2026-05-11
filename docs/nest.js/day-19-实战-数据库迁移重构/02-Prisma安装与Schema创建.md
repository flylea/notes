# 在项目中安装和配置 Prisma

## 安装 Prisma 相关依赖

```bash
# 在图书管理系统项目根目录执行
cd book-management-system-backend

# 安装 Prisma CLI 和 Client
npm install prisma @prisma/client

# 安装开发依赖（密码加密）
npm install bcrypt
npm install -D @types/bcrypt
```

## 初始化 Prisma

```bash
# 初始化 Prisma（MySQL）
npx prisma init --datasource-provider mysql

# 或使用 PostgreSQL
npx prisma init --datasource-provider postgresql
```

初始化后生成的目录结构：

```
project-root/
├── prisma/
│   └── schema.prisma      ← 数据模型定义（下面要修改）
├── .env                    ← DATABASE_URL（修改连接信息）
└── package.json
```

## 配置 .env

```bash
# .env — MySQL
DATABASE_URL="mysql://root:your_password@localhost:3306/book_management?charset=utf8mb4"

# .env — PostgreSQL
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/book_management?schema=public"
```

> ⚠️ 在正式项目中 `.env` 不应提交到 Git（已在 `.gitignore` 中）。团队协作使用 `.env.example` 提供骨架：
> ```
> # .env.example
> DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DB_NAME?charset=utf8mb4"
> ```

## 创建图书管理系统的 Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"        // 或 "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== 枚举 ====================
enum UserRole {
  USER
  ADMIN
}

enum BookStatus {
  AVAILABLE
  BORROWED
  MAINTENANCE   // 维护中
}

// ==================== 用户表 ====================
model User {
  id          Int       @id @default(autoincrement())
  username    String    @unique @db.VarChar(50)
  password    String    @db.VarChar(255)
  nickname    String?   @db.VarChar(50)
  avatar      String?   @db.VarChar(500)
  role        UserRole  @default(USER)
  borrowCount Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  borrows     BorrowRecord[]

  @@map("users")
}

// ==================== 图书表 ====================
model Book {
  id          Int        @id @default(autoincrement())
  title       String     @db.VarChar(200)
  author      String     @db.VarChar(100)
  isbn        String?    @unique @db.VarChar(20)
  description String?    @db.Text
  cover       String?    @db.VarChar(500)
  price       Decimal?   @db.Decimal(10, 2)
  status      BookStatus @default(AVAILABLE)
  categoryId  Int?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  category    Category?        @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  borrows     BorrowRecord[]
  tags        BookTag[]

  @@index([title])
  @@index([author])
  @@index([categoryId])
  @@map("books")
}

// ==================== 借阅记录表 ====================
model BorrowRecord {
  id         Int       @id @default(autoincrement())
  userId     Int
  bookId     Int
  borrowedAt DateTime  @default(now())
  returnedAt DateTime?

  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  book       Book      @relation(fields: [bookId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([bookId])
  @@index([userId, bookId])
  @@map("borrow_records")
}

// ==================== 分类表 ====================
model Category {
  id       Int       @id @default(autoincrement())
  name     String    @unique @db.VarChar(50)
  parentId Int?

  parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id], onDelete: SetNull)
  children Category[] @relation("CategoryTree")
  books    Book[]

  @@map("categories")
}

// ==================== 标签表（多对多） ====================
model Tag {
  id    Int       @id @default(autoincrement())
  name  String    @unique @db.VarChar(30)

  books BookTag[]

  @@map("tags")
}

model BookTag {
  bookId Int
  tagId  Int

  book   Book @relation(fields: [bookId], references: [id], onDelete: Cascade)
  tag    Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @id([bookId, tagId])
  @@map("book_tags")
}
```

## Schema 设计说明

```
User ──┬── BorrowRecord ──┬── Book ──┬── BookTag ──┬── Tag
       │ (1:N)            │ (1:N)    │ (N:M)       │ (N:M)
       │                  │          │
       │                  │          └── Category
       │                  │              (N:1, 自引用树形)
       │                  │
       └──────────────────┘

关键设计决策：
1. borrowCount 字段：冗余字段，减少 COUNT 查询
2. onDelete: Cascade：删除用户时级联删除其借阅记录
3. onDelete: SetNull：删除分类时书的 categoryId 置为 null
4. @@index：为高频查询字段建索引（title, author, userId）
```

## 执行首次 Migration

```bash
# 1. 确保数据库已创建（MySQL）
# mysql -u root -p -e "CREATE DATABASE book_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# PostgreSQL
# createdb book_management

# 2. 运行 migration（创建表 + 生成 Prisma Client）
npx prisma migrate dev --name init

# 输出：
# Applying migration `20240101000000_init`
# The following migration(s) have been created and applied from new schema changes:
#   migrations/
#     └── 20240101000000_init/
#         └── migration.sql
# Your database is now in sync with your schema.
# ✔ Generated Prisma Client (5.x.x) to ./node_modules/@prisma/client
```

## 验证

```bash
# 查看数据库表
npx prisma studio
# 浏览器打开 http://localhost:5555 ，应该能看到空的 users、books 等表

# 或用 SQL 查看
# MySQL:
# mysql -u root -p book_management -e "SHOW TABLES;"

# PostgreSQL:
# psql -d book_management -c "\dt"
```

## 目录结构变化

```
book-management-system-backend/
├── prisma/
│   ├── schema.prisma            ← 数据模型
│   └── migrations/
│       └── 20240101000000_init/
│           └── migration.sql    ← 自动生成的建表 SQL
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── user/
│   ├── book/
│   ├── db/                      ← 即将被删除（Day 19 第 7 节）
│   │   ├── db.module.ts
│   │   └── db.service.ts
│   └── prisma/                  ← 即将创建（Day 19 第 3 节）
│       ├── prisma.service.ts
│       └── prisma.module.ts
├── .env
├── package.json
└── tsconfig.json
```

---

## 参考链接

- [Prisma — Quickstart](https://www.prisma.io/docs/getting-started/quickstart)
- [Prisma — Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma — Relations Guide](https://www.prisma.io/docs/concepts/components/prisma-schema/relations)
