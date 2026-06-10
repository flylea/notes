# ORM 概念与前端类比

## 没有 ORM 的世界

```typescript
// 在 Node.js 中手写 SQL
const result = await connection.execute(
  'SELECT b.*, u.username AS owner FROM books b LEFT JOIN users u ON b.owner_id = u.id WHERE b.price > ? ORDER BY b.created_at DESC LIMIT ? OFFSET ?',
  [50, 10, 0],
);

// 问题：
// 1. SQL 字符串——拼写错误要运行时才发现
// 2. 类型不安全——result 的类型是 any[]
// 3. 重复代码——每个查询都要写 connection.execute(...)
// 4. SQL 注入风险——拼接用户输入的字符串
// 5. 数据库迁移——从 MySQL 换 PostgreSQL，SQL 语法不完全兼容
```

## ORM (Object-Relational Mapping) 是什么

ORM 将数据库表映射为编程语言中的对象（class），将 SQL 操作映射为对象的方法调用：

```typescript
// 使用 ORM（Prisma）
const books = await prisma.book.findMany({
  where: { price: { gt: 50 } },
  include: { owner: true },
  orderBy: { createdAt: 'desc' },
  take: 10,
  skip: 0,
});

// books 的类型是 (Book & { owner: User })[] —— 完全类型安全
// books[0].owner.username ← IDE 有智能提示
```

## 前端类比：Axios vs fetch

| 后端 | 前端 |
|------|------|
| 手写 SQL (`connection.execute(SQL)`) | 手写 `fetch('/api/books')` + 手动 JSON.parse |
| ORM (`prisma.book.findMany()`) | Axios 封装 (`api.getBooks()`) |
| ORM 类型安全 | TypeScript 泛型 + Axios 响应拦截 |
| Prisma Schema → Migration | 前端不直接对应（类似 TypeScript → tsconfig.json） |

ORM 对你来说就像 Axios 对 fetch 的封装——屏蔽底层细节，提供更好的开发体验。

## ORM 的职责

```
ORM 的三层抽象：

┌──────────────────────────┐
│  业务代码 (Service)       │  ← this.prisma.book.findMany()
├──────────────────────────┤
│   ORM (Prisma)           │  ← 将方法调用转为 SQL
├──────────────────────────┤
│   数据库驱动 (mysql2/pg)  │  ← 将 SQL 发给数据库
├──────────────────────────┤
│   数据库 (MySQL/Postgres) │  ← 执行 SQL，返回结果
└──────────────────────────┘
```

## ORM 做的好事

1. **类型安全**：生成的 TypeScript 类型精确反映数据库结构
2. **自动迁移**：Schema 变更自动生成 SQL，无需手写 ALTER TABLE
3. **关联加载**：`include: { owner: true }` 比手写 JOIN 更直观
4. **防注入**：参数化查询自动处理
5. **数据库无关**：换数据库只需改连接串（大部分情况）

## ORM 的已知问题

1. **性能开销**：自动生成的 SQL 可能不是最优（复杂查询建议用 Raw SQL）
2. **学习曲线**：每个 ORM 有自己的 DSL 和 API
3. **N+1 查询**：循环中调 ORM，不知不觉发了几百条 SQL

## 图书管理系统从 JSON 到 ORM

```
Day 6-12：
  Service → DbService.read('/DbService.write') → users.json / books.json
  问题：并发写入不安全、无法复杂查询、数据量大了性能差

Day 14-19：
  Service → PrismaService → MySQL/PostgreSQL
  优势：类型安全、关联查询、事务保证、大数据量支持
```

> Prisma 是 Node.js 生态中类型安全最好的 ORM——它的 TypeScript 类型生成是同类工具中最成熟的。

---

## 参考链接

- [Prisma — Why Prisma?](https://www.prisma.io/docs/concepts/overview/why-prisma)
- [Prisma vs TypeORM](https://www.prisma.io/docs/concepts/more/comparisons/prisma-and-typeorm)
- 开源笔记：《Nest 通关秘籍》.doc/35.MySQL操作方法.md
