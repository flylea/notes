# 单表 CRUD 全部 API

## Create

```typescript
// 创建单条
const user = await prisma.user.create({
  data: { username: 'john', password: 'hashed' },
});

// 批量创建（MySQL 默认用事务包装）
const users = await prisma.user.createMany({
  data: [
    { username: 'john', password: 'h1' },
    { username: 'jane', password: 'h2' },
  ],
  skipDuplicates: true,  // 跳过唯一约束冲突的
});
```

## Read

```typescript
// 按主键查找
const user = await prisma.user.findUnique({
  where: { id: 1 },
});

// 查找第一条匹配的
const user = await prisma.user.findFirst({
  where: { username: { contains: 'jo' } },
});

// 查找所有
const users = await prisma.user.findMany({
  where: { isActive: true },
});

// 计数
const count = await prisma.user.count({
  where: { role: 'ADMIN' },
});
```

## Update

```typescript
// 更新单条
const user = await prisma.user.update({
  where: { id: 1 },
  data: { password: 'newpassword' },
});

// 批量更新
const result = await prisma.user.updateMany({
  where: { isActive: false },
  data: { isActive: true },
});
// result.count = 更新的行数

// Upsert（有则更新，无则创建）
const user = await prisma.user.upsert({
  where: { email: 'john@example.com' },
  update: { username: 'john_new' },
  create: { username: 'john', email: 'john@example.com', password: 'h' },
});
```

## Delete

```typescript
// 删除单条
await prisma.user.delete({
  where: { id: 1 },
});

// 批量删除
const result = await prisma.user.deleteMany({
  where: { isActive: false },
});
// result.count = 删除的行数

// 全部删除（⚠️ 危险操作）
await prisma.user.deleteMany({});
```

## API 方法速查

| 方法 | 作用 | 返回 |
|------|------|------|
| `create` | 创建一条 | 创建的记录 |
| `createMany` | 创建多条 | `{ count: number }` |
| `findUnique` | 按主键/唯一键查 | 一条记录或 null |
| `findFirst` | 查第一条匹配的 | 一条记录或 null |
| `findMany` | 查所有匹配的 | 数组 |
| `count` | 计数 | number |
| `update` | 更新一条 | 更新后的记录 |
| `updateMany` | 更新多条 | `{ count: number }` |
| `upsert` | 更新或创建 | 记录 |
| `delete` | 删除一条 | 删除的记录 |
| `deleteMany` | 删除多条 | `{ count: number }` |

> 每个 API 的返回值类型都是精确生成的——`prisma.user.findUnique()` 的返回类型是 `User | null`，TypeScript 编译时就能检查。

---

## 参考链接

- [Prisma — CRUD](https://www.prisma.io/docs/concepts/components/prisma-client/crud)
- [Prisma Client API Reference](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
