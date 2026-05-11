# where 过滤条件全解

## 基础条件

```typescript
// 精确匹配
prisma.user.findMany({ where: { username: 'john' } });

// 不等
prisma.book.findMany({ where: { price: { not: 0 } } });

// 比较
prisma.book.findMany({ where: { price: { gt: 50, lte: 100 } } });
// gt >, gte >=, lt <, lte <=
```

## 字符串过滤

```typescript
prisma.book.findMany({
  where: {
    title: {
      contains: 'Nest',      // 包含（大小写敏感）
      startsWith: 'NestJS',  // 以...开头
      endsWith: '指南',      // 以...结尾
    },
    // 大小写不敏感（仅 PostgreSQL ILIKE）
    // title: { contains: 'nest', mode: 'insensitive' },
  },
});
```

## 数组过滤（in / notIn）

```typescript
prisma.book.findMany({
  where: {
    status: { in: ['available', 'reserved'] },     // 在列表中
    id: { notIn: [1, 2, 3] },                     // 不在列表中
  },
});
```

## NULL 过滤

```typescript
prisma.book.findMany({
  where: {
    isbn: { not: null },  // isbn 不为空
    description: null,    // description 为空
  },
});
```

## AND / OR / NOT 组合

```typescript
// OR：满足任一即可
prisma.book.findMany({
  where: {
    OR: [
      { title: { contains: 'Nest' } },
      { author: { contains: 'Nest' } },
    ],
  },
});

// AND：全部满足
prisma.book.findMany({
  where: {
    AND: [
      { status: 'available' },
      { price: { gte: 50 } },
    ],
  },
});

// NOT：取反
prisma.book.findMany({
  where: {
    NOT: { status: 'borrowed' },
  },
});

// 组合使用
prisma.book.findMany({
  where: {
    AND: [
      { status: 'available' },
      {
        OR: [
          { price: { gte: 100 } },
          { title: { contains: '高级' } },
        ],
      },
    ],
  },
});
```

## 关联过滤（过滤父记录时带子条件）

```typescript
// 查"被借过的书"
prisma.book.findMany({
  where: {
    borrows: { some: {} },  // 至少有一条借阅记录
  },
});

// 查"从未被借过的书"
prisma.book.findMany({
  where: {
    borrows: { none: {} },
  },
});

// 查"被用户 1 借过的书"
prisma.book.findMany({
  where: {
    borrows: {
      some: { userId: 1 },
    },
  },
});

// 查"所有借阅都已归还的书"
prisma.book.findMany({
  where: {
    borrows: {
      every: { returnedAt: { not: null } },
    },
  },
});
```

## 日期过滤

```typescript
// 最近 7 天创建的书
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
prisma.book.findMany({
  where: { createdAt: { gte: sevenDaysAgo } },
});
```

---

## 参考链接

- [Prisma — Filtering](https://www.prisma.io/docs/concepts/components/prisma-client/filtering-and-sorting)
