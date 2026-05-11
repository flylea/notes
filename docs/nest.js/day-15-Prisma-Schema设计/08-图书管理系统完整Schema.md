# 图书管理系统完整 Schema

## 实体关系图

```
User (1) ───── (N) BorrowRecord (N) ───── (1) Book
                                    └── borrowedAt
                                    └── returnedAt

Book (N) ────── (N) Category       (隐式多对多)
Book (N) ────── (N) Tag            (隐式多对多)
```

## 完整 Schema

```prisma
// prisma/schema.prisma

datasource db {
  provider = "mysql"        // 或 "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ==============================
// 用户模块
// ==============================

model User {
  id        BigInt   @id @default(autoincrement())
  username  String   @unique @db.VarChar(50)
  password  String   @db.VarChar(255)

  // 可选：昵称、头像
  nickname  String?
  avatar    String?

  // 统计
  borrowCount Int    @default(0)

  // 关联
  borrows   BorrowRecord[]

  // 时间戳
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

// ==============================
// 图书模块
// ==============================

model Book {
  id          BigInt   @id @default(autoincrement())
  title       String   @db.VarChar(100)
  author      String   @db.VarChar(50)
  isbn        String?  @unique @db.VarChar(13)
  price       Decimal? @db.Decimal(10, 2)
  description String?  @db.Text
  cover       String?  @db.VarChar(255)   // 封面 URL
  status      BookStatus @default(AVAILABLE)

  // 关联
  borrows     BorrowRecord[]
  categories  Category[]
  tags        Tag[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([title, author])
  @@index([status])
  @@map("books")
}

enum BookStatus {
  AVAILABLE
  BORROWED
}

// ==============================
// 借阅模块
// ==============================

model BorrowRecord {
  id         BigInt    @id @default(autoincrement())

  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId     BigInt

  book       Book      @relation(fields: [bookId], references: [id], onDelete: Cascade)
  bookId     BigInt

  borrowedAt DateTime  @default(now())
  returnedAt DateTime?  // NULL = 未归还

  @@index([userId])
  @@index([bookId])
  @@index([userId, bookId])  // 防止重复借阅
  @@map("borrow_records")
}

// ==============================
// 分类模块（自引用多级分类）
// ==============================

model Category {
  id       BigInt      @id @default(autoincrement())
  name     String      @unique @db.VarChar(30)
  parentId BigInt?
  parent   Category?   @relation("CategoryTree", fields: [parentId], references: [id], onDelete: SetNull)
  children Category[]  @relation("CategoryTree")
  books    Book[]

  @@map("categories")
}

// ==============================
// 标签模块
// ==============================

model Tag {
  id    BigInt @id @default(autoincrement())
  name  String @unique @db.VarChar(30)
  books Book[]

  @@map("tags")
}
```

## Schema 设计原则

1. **表名统一用复数** (`users`, `books`) 比单数更符合 SQL 惯例
2. **时间字段规范**：`createdAt` + `updatedAt` 是 Prisma 社区标准
3. **外键级联**：关键数据用 `onDelete: Cascade`，防止孤儿记录
4. **索引用在查询频繁的字段上**：`title`、`author`、`status`
5. **String 长度用 @db.VarChar(n)**：避免默认的 191 字符浪费存储

## MySQL vs PostgreSQL 切换

唯一的改动：

```prisma
// MySQL:
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// PostgreSQL:
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

其余的 Model 定义完全一样——这就是 Prisma 跨数据库的优势。

> 这份 Schema 是图书管理系统的数据基石。Day 16 开始我们会在它上面构建 CRUD API。

---

## 参考链接

- [Prisma — Schema Examples](https://www.prisma.io/docs/concepts/components/prisma-schema)
- [NestJS — Prisma Integration](https://docs.nestjs.com/recipes/prisma)
- 开源笔记：《Nest 通关秘籍》.doc/36.Prisma入门.md
