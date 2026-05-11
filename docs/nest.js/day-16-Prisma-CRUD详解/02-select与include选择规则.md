# select vs include

## 核心区别

- `select`：指定返回哪些字段（包括关联）
- `include`：加载关联数据（默认返回所有字段 + 加载关联）

## select — 精确控制返回字段

```typescript
const book = await prisma.book.findUnique({
  where: { id: 1 },
  select: {
    title: true,          // 只要 title
    author: true,         // 只要 author
    price: true,          // 只要 price
    // 不写 id/createdAt/description → 不返回
  },
});

// 返回值类型：{ title: string, author: string, price: Decimal | null }
// TypeScript 严格推断！不会多不会少
```

### 关联的 select

```typescript
const book = await prisma.book.findUnique({
  where: { id: 1 },
  select: {
    title: true,
    borrows: {
      select: {
        user: {
          select: {
            username: true,  // 只返回借阅者的用户名
          },
        },
        borrowedAt: true,
      },
    },
  },
});

// 返回值类型精确到嵌套层次
```

## include — 加载关联数据

```typescript
const book = await prisma.book.findUnique({
  where: { id: 1 },
  include: {
    borrows: {
      include: {
        user: true,  // 加载借阅者完整信息
      },
    },
    categories: true,  // 加载分类
    tags: true,        // 加载标签
  },
});
// 返回 Book + borrows + borrows.user + categories + tags 的全部字段
```

## select 和 include 不能同时使用

```typescript
// ❌ 错误：不能同时用 select 和 include
prisma.book.findMany({
  select: { title: true },
  include: { tags: true },
});

// ✅ 正确：在 select 中包含关联
prisma.book.findMany({
  select: {
    title: true,
    tags: { select: { name: true } },  // 关联也放在 select 中
  },
});
```

## 选型指南

| 场景 | 用 select 还是 include |
|------|----------------------|
| 列表页（只要摘要） | `select` — 减少数据传输 |
| 详情页（要完整信息） | `include` — 加载所有关联 |
| 性能敏感场景 | `select` — 只查需要的列 |
| 需要所有字段 + 关联 | `include` — 少写 true |

---

## 参考链接

- [Prisma — Select & Include](https://www.prisma.io/docs/concepts/components/prisma-client/select-fields)
