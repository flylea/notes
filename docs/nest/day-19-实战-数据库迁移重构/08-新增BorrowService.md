# 新增 BorrowService：借书 / 还书 / 查询

## 概述

Day 12 的 JSON 版本没有实现借阅功能（因为 JSON 不支持事务，实现起来不安全）。有了 Prisma + 数据库事务，现在可以安全地实现完整的借阅流程。

## 完整的 BorrowService

```typescript
// src/borrow/borrow.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class BorrowService {
  constructor(private prisma: PrismaService) {}

  // ==================== 借书 ====================
  async borrowBook(userId: number, bookId: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. 检查图书是否存在且可借
      const book = await tx.book.findUnique({
        where: { id: bookId },
      });

      if (!book) {
        throw new BadRequestException('图书不存在');
      }
      if (book.status === 'BORROWED') {
        throw new BadRequestException('该书已被借出');
      }
      if (book.status === 'MAINTENANCE') {
        throw new BadRequestException('该书正在维护中');
      }

      // 2. 检查用户是否已借过这本书（未归还）
      const existingBorrow = await tx.borrowRecord.findFirst({
        where: {
          userId,
          bookId,
          returnedAt: null,
        },
      });

      if (existingBorrow) {
        throw new BadRequestException('您已借过该书，请先归还');
      }

      // 3. 检查用户借阅数量上限
      const borrowCount = await tx.borrowRecord.count({
        where: {
          userId,
          returnedAt: null,
        },
      });

      if (borrowCount >= 3) {
        throw new BadRequestException('每人最多同时借阅 3 本书');
      }

      // 4. 创建借阅记录
      const record = await tx.borrowRecord.create({
        data: {
          userId,
          bookId,
          borrowedAt: new Date(),
        },
        include: {
          book: { select: { id: true, title: true } },
          user: { select: { id: true, username: true } },
        },
      });

      // 5. 更新图书状态
      await tx.book.update({
        where: { id: bookId },
        data: { status: 'BORROWED' },
      });

      // 6. 更新用户借阅计数
      await tx.user.update({
        where: { id: userId },
        data: { borrowCount: { increment: 1 } },
      });

      return record;
    }, {
      maxWait: 5000,
      timeout: 10000,
    });
  }

  // ==================== 还书 ====================
  async returnBook(userId: number, bookId: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. 查找未归还的借阅记录
      const record = await tx.borrowRecord.findFirst({
        where: {
          userId,
          bookId,
          returnedAt: null,
        },
      });

      if (!record) {
        throw new BadRequestException('未找到该借阅记录');
      }

      // 2. 更新借阅记录
      const updated = await tx.borrowRecord.update({
        where: { id: record.id },
        data: { returnedAt: new Date() },
        include: {
          book: { select: { id: true, title: true } },
        },
      });

      // 3. 恢复图书状态
      await tx.book.update({
        where: { id: bookId },
        data: { status: 'AVAILABLE' },
      });

      // 4. 减少用户借阅计数
      await tx.user.update({
        where: { id: userId },
        data: { borrowCount: { decrement: 1 } },
      });

      return updated;
    });
  }

  // ==================== 查询当前借阅 ====================
  async getMyBorrows(userId: number) {
    return this.prisma.borrowRecord.findMany({
      where: {
        userId,
        returnedAt: null,  // 只查未归还的
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            cover: true,
          },
        },
      },
      orderBy: { borrowedAt: 'desc' },
    });
  }

  // ==================== 查询借阅历史 ====================
  async getBorrowHistory(
    userId: number,
    query: { page: number; size: number },
  ) {
    const { page, size } = query;

    const where: Prisma.BorrowRecordWhereInput = {
      userId,
      returnedAt: { not: null },  // 只查已归还的
    };

    const [list, total] = await Promise.all([
      this.prisma.borrowRecord.findMany({
        where,
        skip: (page - 1) * size,
        take: size,
        include: {
          book: {
            select: { id: true, title: true, author: true },
          },
        },
        orderBy: { returnedAt: 'desc' },
      }),
      this.prisma.borrowRecord.count({ where }),
    ]);

    return { list, total, page, size };
  }

  // ==================== 检查图书是否可借 ====================
  async checkAvailability(bookId: number) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        title: true,
        status: true,
        _count: {
          select: { borrows: true },
        },
      },
    });

    if (!book) {
      throw new BadRequestException('图书不存在');
    }

    return {
      bookId: book.id,
      title: book.title,
      status: book.status,
      canBorrow: book.status === 'AVAILABLE',
      totalBorrows: book._count.borrows,
    };
  }
}
```

## 借书流程图解

```
POST /borrow
    │
    ▼
borrowBook(userId=1, bookId=5)
    │
    ▼
$transaction ──────────────────────────────────────────────┐
│                                                           │
│  1. SELECT * FROM books WHERE id = 5                      │
│     └─ status = 'BORROWED'? → 抛异常                      │
│                                                           │
│  2. SELECT COUNT(*) FROM borrow_records                   │
│     WHERE userId=1 AND returnedAt IS NULL                 │
│     └─ >= 3? → 抛异常                                     │
│                                                           │
│  3. INSERT INTO borrow_records (userId, bookId, ...)      │
│                                                           │
│  4. UPDATE books SET status='BORROWED' WHERE id=5         │
│                                                           │
│  5. UPDATE users SET borrowCount=borrowCount+1 WHERE id=1 │
│                                                           │
│  ✅ 全部成功 → COMMIT                                     │
│  ❌ 任一步失败 → ROLLBACK                                  │
└───────────────────────────────────────────────────────────┘
```

## 并发借阅保护

```typescript
// 场景：两用户同时借同一本书
// 用户 A 和用户 B 同时调用 borrowBook(1, 5)

// 没有事务保护：
// A: SELECT status → AVAILABLE ✓
// B: SELECT status → AVAILABLE ✓ (A 还没更新！)
// A: INSERT borrow_record ✓
// B: INSERT borrow_record ✓
// 结果：一本书被两个人借走 ❌

// 有事务保护（Repeatable Read 或 Serializable）：
// A: SELECT status → AVAILABLE ✓
// B: SELECT status → 等待 A 的事务完成
// A: INSERT → UPDATE → COMMIT
// B: SELECT status → BORROWED → 抛异常
// 结果：只有一人借到 ✅
```

> MySQL 默认隔离级别 `REPEATABLE READ` 就能保护这个场景。如果并发量极高，可以升级到 `SERIALIZABLE`。

---

## 参考链接

- [Prisma — Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- [Prisma — Interactive Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions#interactive-transactions)
