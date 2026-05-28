# Prisma ORM 从入门到进阶全面指南

> 基于 Prisma 官方文档最新版本 (v7.x)，2026年5月
> 关注实际应用场景、前后端数据流、查询优化

---

## 目录

1. [快速开始](#1-快速开始)
2. [Schema 核心概念速览](#2-schema-核心概念速览)
3. [属性速查表](#3-属性速查表)
4. [ID 生成策略对比与选择](#4-id-生成策略对比与选择)
5. [关系设计：什么时候用什么？](#5-关系设计什么时候用什么)
6. [关系实现完整示例](#6-关系实现完整示例)
7. [Prisma Client 增删改查](#7-prisma-client-增删改查)
8. [关联查询：include vs select](#8-关联查询include-vs-select)
9. [前端数据返回格式大全](#9-前端数据返回格式大全)
10. [高级过滤与查询条件](#10-高级过滤与查询条件)
11. [分页：skip/take vs cursor](#11-分页skiptake-vs-cursor)
12. [嵌套写入：一请求写多表](#12-嵌套写入一请求写多表)
13. [查询优化策略](#13-查询优化策略)
14. [事务处理](#14-事务处理)
15. [聚合与统计](#15-聚合与统计)
16. [实际 API 场景示例](#16-实际-api-场景示例)
17. [Prisma Migrate](#17-prisma-migrate)
18. [最佳实践清单](#18-最佳实践清单)

---

## 1. 快速开始

```bash
npm install prisma @prisma/client
npx prisma init
```

产生两个文件：
- `prisma/schema.prisma` — 数据模型定义
- `.env` — `DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"`

```bash
npx prisma migrate dev --name init   # 生成迁移并应用到数据库
npx prisma generate                   # 生成类型安全的客户端
```

在代码中使用：

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const users = await prisma.user.findMany();
```

---

## 2. Schema 核心概念速览

```prisma
datasource db {
  provider = "postgresql"
}

generator client {
  provider = "prisma-client"
  output   = "./generated/client"
}

// model = 数据库表
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique                       // 唯一
  name      String?                                // 可选
  role      Role     @default(USER)                // 默认值
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt                    // 自动更新

  posts     Post[]                                 // 一对多
  profile   Profile?                               // 一对一

  @@index([email])                                 // 索引
}

model Profile {
  id     Int  @id @default(autoincrement())
  bio    String?
  user   User @relation(fields: [userId], references: [id])
  userId Int  @unique      // 一对一必须加 @unique
}

model Post {
  id        Int        @id @default(autoincrement())
  title     String
  content   String?
  published Boolean    @default(false)

  author    User       @relation(fields: [authorId], references: [id])
  authorId  Int        // 外键列

  categories Category[] // 多对多（隐式）

  @@index([authorId])   // 外键索引，加速关联查询
  @@index([published])  // 常用条件索引
}

model Category {
  id    Int    @id @default(autoincrement())
  name  String @unique
  posts Post[]  // 多对多
}

enum Role {
  USER
  ADMIN
}
```

---

## 3. 属性速查表

### 字段属性（@前缀，作用于字段）

| 属性 | 用途 | 示例 |
|------|------|------|
| `@id` | 单字段主键 | `id Int @id` |
| `@default(value)` | 默认值 | `@default(false)`, `@default(uuid())` |
| `@unique` | 唯一约束 | `email String @unique` |
| `@map("col")` | 映射数据库列名 | `@map("user_id")` |
| `@updatedAt` | 自动更新时间 | `updatedAt DateTime @updatedAt` |
| `@ignore` | 不映射到数据库 | - |
| `@db.Xxx` | 原生数据库类型 | `@db.VarChar(255)`, `@db.ObjectId` |
| `@relation(...)` | 定义关系 | 见下文详解 |

### 块属性（@@前缀，作用于模型）

| 属性 | 用途 | 示例 |
|------|------|------|
| `@@id([...])` | 复合主键 | `@@id([firstName, lastName])` |
| `@@id(name: "n", fields: [...])` | 命名复合主键 | 同上 |
| `@@unique([...])` | 复合唯一 | `@@unique([authorId, title])` |
| `@@index([...])` | 定义索引 | `@@index([createdAt])` |
| `@@map("table")` | 映射表名 | `@@map("users")` |
| `@@ignore` | 忽略整个模型 | - |

---

## 4. ID 生成策略对比与选择

| 策略 | Schema | 优点 | 缺点 | 推荐场景 |
|------|--------|------|------|----------|
| **自增整数** | `Int @id @default(autoincrement())` | 简短、有序、占空间小 | 暴露数据规模、不分布式友好 | 内部系统、小项目 |
| **UUID** | `String @id @default(uuid())` | 全局唯一、不暴露信息 | 36 字符较长、索引稍慢 | 分布式系统、对外 API |
| **CUID** | `String @id @default(cuid())` | 抗碰撞、适合分布式 | 比 UUID 稍短 | 微服务、浏览器端生成 |
| **复合主键** | `@@id([a, b])` | 利用业务键、无需额外字段 | 查询较繁琐 | 连接表、多租户 |

**实际建议**：大多数项目推荐 `@default(uuid())`——前端可安全暴露 ID，分布式友好，URL 中不会暴露数据量。

```prisma
// 推荐方案
model User {
  id String @id @default(uuid())
}

// 返回前端时的 JSON
// { "id": "550e8400-e29b-41d4-a716-446655440000", "name": "Alice" }
```

---

## 5. 关系设计：什么时候用什么？

### 决策流程图

```
两个实体之间的关系 →
├─ A 最多关联 1 个 B，B 最多关联 1 个 A？ → 一对一
│   例子：User ↔ Profile（每个用户一个资料）
│
├─ A 关联多个 B，B 只关联 1 个 A？ → 一对多
│   例子：User ↔ Post（一个用户多个帖子）
│
├─ A 关联多个 B，B 也关联多个 A？ → 多对多
│   例子：Post ↔ Category（帖子多个分类，分类多个帖子）
│
└─ A 关联 A 自己？ → 自引用
    例子：Category 父子级联、User 关注关系
```

### 5.1 一对一：什么时候用？

**判断标准**：一个实体最多对应另一个实体的 1 条记录。

**典型场景**：

| 场景 | 主表 | 从表 | 原因 |
|------|------|------|------|
| 用户扩展信息 | `User` | `Profile` | 用户基本信息少而固定，扩展信息多而可选 |
| 订单发票 | `Order` | `Invoice` | 一个订单只开一张发票 |
| 设备详情 | `Device` | `DeviceSpec` | 一台设备对应一份规格参数 |
| 敏感信息分离 | `User` | `UserCredential` | 密码哈希等敏感字段从主表中抽离 |

**为什么用一对一而不是直接加字段？**
- **关注点分离**：Profile 字段很多且大多可选，拆出来让 User 表保持精简
- **按需加载**：不查 Profile 时不加载，减少 I/O
- **安全隔离**：敏感字段放另一张表可单独做权限控制

### 5.2 一对多：什么时候用？

**判断标准**：A 拥有多个 B，B 只属于一个 A。

**典型场景**：

| 父实体 | 子实体 | 示例 |
|--------|--------|------|
| User | Post | 用户写了多篇文章 |
| Post | Comment | 文章有多个评论 |
| Category | Product | 一个分类下多个商品 |
| Order | OrderItem | 一个订单包含多个商品行 |
| Department | Employee | 一个部门有多个员工 |

### 5.3 多对多：什么时候用？

**判断标准**：A 有多个 B，B 也有多个 A。

**典型场景**：

| 实体 A | 实体 B | 示例 |
|--------|--------|------|
| Post | Category | 文章有多个分类，分类有多个文章 |
| Student | Course | 学生选多门课，课被多个学生选 |
| User | Group | 用户在多个群，群有多个用户 |
| Product | Tag | 商品有多个标签，标签对应多个商品 |

### 5.4 隐式 vs 显式多对多如何选择？

| | 隐式 m-n | 显式 m-n |
|------|----------|----------|
| **Schema 复杂度** | 简单，只需两行 `Post[]` / `Category[]` | 需要额外定义连接表模型 |
| **连接表数据** | 自动管理，不可自定义 | 可以添加额外字段（如 `assignedAt`） |
| **何时使用** | 连接表不需要存储额外信息 | 需要在关联中存储元数据 |

```
隐式 m-n：只需要"帖子和分类的对应关系"
显式 m-n：还需要记录"谁什么时候把这个帖子归到这个分类"
```

### 5.5 什么时候用自引用？

| 场景 | 示例 |
|------|------|
| 树形结构 | 分类的父子层级 `Category → parent/children` |
| 社交关系 | 用户关注/粉丝 `User → followedBy/following` |
| 组织架构 | 员工汇报关系 `Employee → manager/subordinates` |

---

## 6. 关系实现完整示例

### 6.1 一对一：User ↔ Profile

**Schema：**

```prisma
model User {
  id       String   @id @default(uuid())    // 推荐 UUID 作为主键
  email    String   @unique
  name     String
  profile  Profile?                         // User 这边是可选的
}

model Profile {
  id      String @id @default(uuid())
  bio     String?
  avatar  String?
  userId  String @unique    // 一对一：外键必须加 @unique
  user    User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**创建带 Profile 的用户：**

```ts
const user = await prisma.user.create({
  data: {
    email: "alice@example.com",
    name: "Alice",
    profile: {
      create: {
        bio: "Full-stack developer",
        avatar: "https://cdn.example.com/alice.jpg",
      },
    },
  },
  include: { profile: true },
});
```

**API 返回给前端的数据：**

```json
// GET /api/users/550e8400-e29b-41d4-a716-446655440000
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "alice@example.com",
  "name": "Alice",
  "profile": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "bio": "Full-stack developer",
    "avatar": "https://cdn.example.com/alice.jpg"
  }
}
```

### 6.2 一对多：User ↔ Post

**Schema：**

```prisma
model User {
  id    String @id @default(uuid())
  email String @unique
  name  String
  posts Post[]               // 一个用户有多个帖子
}

model Post {
  id        String   @id @default(uuid())
  title     String
  content   String?
  published Boolean  @default(false)
  createdAt DateTime @default(now())
  authorId  String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
                     // fields: 当前模型中存储外键的字段
                     // references: 指向目标模型的哪个字段
}
```

**查询用户的帖子列表（前端列表页）：**

```ts
const posts = await prisma.post.findMany({
  where: { authorId: userId, published: true },
  select: {
    id: true,
    title: true,
    createdAt: true,
    author: { select: { name: true } },
  },
  orderBy: { createdAt: "desc" },
  take: 10,
});
```

**API 返回给前端：**

```json
// GET /api/posts?authorId=550e8400-...
{
  "data": [
    {
      "id": "post-uuid-1",
      "title": "Getting Started with Prisma",
      "createdAt": "2024-06-15T10:30:00.000Z",
      "author": { "name": "Alice" }
    },
    {
      "id": "post-uuid-2",
      "title": "Advanced Prisma Patterns",
      "createdAt": "2024-06-14T08:00:00.000Z",
      "author": { "name": "Alice" }
    }
  ],
  "total": 15,
  "page": 1,
  "pageSize": 10
}
```

### 6.3 多对多（隐式）：Post ↔ Category

**Schema：**

```prisma
model Post {
  id         String     @id @default(uuid())
  title      String
  categories Category[]  // 不需要 @relation
}

model Category {
  id    String @id @default(uuid())
  name  String @unique
  posts Post[] // 不需要 @relation
}
// Prisma 自动生成 _CategoryToPost 关联表
```

**查询帖子及其分类：**

```ts
const post = await prisma.post.findUnique({
  where: { id: postId },
  include: { categories: true },
});
```

**API 返回给前端：**

```json
// GET /api/posts/post-uuid-1
{
  "id": "post-uuid-1",
  "title": "Getting Started with Prisma",
  "categories": [
    { "id": "cat-uuid-1", "name": "TypeScript" },
    { "id": "cat-uuid-2", "name": "Database" },
    { "id": "cat-uuid-3", "name": "Backend" }
  ]
}
```

**按分类筛选帖子：**

```ts
const posts = await prisma.post.findMany({
  where: {
    categories: { some: { name: "TypeScript" } },  // 至少有一个分类是 TypeScript
  },
  include: { categories: true },
});
```

### 6.4 多对多（显式）：Post ↔ Category（带附加信息）

当需要记录"谁在什么时候把文章归类"时：

**Schema：**

```prisma
model Post {
  id         String              @id @default(uuid())
  title      String
  categories PostCategory[]       // 通过连接表关联
}

model Category {
  id    String         @id @default(uuid())
  name  String
  posts PostCategory[]
}

model PostCategory {
  postId    String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  categoryId String
  category  Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  assignedAt DateTime @default(now())
  assignedBy String

  @@id([postId, categoryId])  // 复合主键
}
```

**查询显式多对多（带附加字段）：**

```ts
const post = await prisma.post.findUnique({
  where: { id: postId },
  include: {
    categories: {
      include: { category: true },  // 两次 include 获取 category 信息
    },
  },
});
```

**API 返回给前端：**

```json
{
  "id": "post-uuid-1",
  "title": "Getting Started with Prisma",
  "categories": [
    {
      "category": { "id": "cat-1", "name": "TypeScript" },
      "assignedAt": "2024-06-15T10:30:00.000Z",
      "assignedBy": "Alice"
    },
    {
      "category": { "id": "cat-2", "name": "Database" },
      "assignedAt": "2024-06-15T10:31:00.000Z",
      "assignedBy": "Admin"
    }
  ]
}
```

### 6.5 自引用：分类树

```prisma
model Category {
  id       String     @id @default(uuid())
  name     String
  parentId String?     // 父分类 ID
  parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id], onDelete: SetNull)
  children Category[] @relation("CategoryTree")
}
```

```ts
// 查一级分类 + 子分类
const categories = await prisma.category.findMany({
  where: { parentId: null },
  include: {
    children: {
      include: {
        children: true,  // 可选：三级分类
      },
    },
  },
});
```

**API 返回给前端：**

```json
[
  {
    "id": "cat-1",
    "name": "电子产品",
    "parentId": null,
    "children": [
      {
        "id": "cat-2",
        "name": "手机",
        "parentId": "cat-1",
        "children": [
          { "id": "cat-3", "name": "智能手机", "parentId": "cat-2", "children": [] }
        ]
      }
    ]
  }
]
```

---

## 7. Prisma Client 增删改查

### 7.1 Create 创建

```ts
// 单条
const user = await prisma.user.create({
  data: { email: "a@b.com", name: "Alice" },
});

// 批量（返回 count，不返回每条记录）
const result = await prisma.user.createMany({
  data: [
    { email: "bob@b.com", name: "Bob" },
    { email: "carol@b.com", name: "Carol" },
  ],
  skipDuplicates: true, // 跳过重复（PostgreSQL/MySQL 支持）
});
// result: { count: 2 }

// 批量并返回（PostgreSQL、CockroachDB、SQLite）
const users = await prisma.user.createManyAndReturn({
  data: [
    { email: "bob@b.com", name: "Bob" },
    { email: "carol@b.com", name: "Carol" },
  ],
});
```

### 7.2 Read 读取

```ts
// 通过主键查唯一记录
const user = await prisma.user.findUnique({
  where: { id: userId },
});

// 通过唯一字段查
const user = await prisma.user.findUnique({
  where: { email: "alice@b.com" },
});

// 查全部
const users = await prisma.user.findMany();

// 查第一条匹配的
const user = await prisma.user.findFirst({
  where: { name: { startsWith: "A" } },
  orderBy: { createdAt: "desc" },
});

// 总数
const count = await prisma.user.count({
  where: { role: "ADMIN" },
});
```

**`findUnique` vs `findFirst`**：

| | findUnique | findFirst |
|------|-----------|----------|
| 支持 where | 只支持 `@id` / `@unique` 字段 | 任意字段 |
| 性能 | 使用唯一索引，极快 | 扫描匹配，可能较慢 |
| 没有匹配 | 返回 `null` | 返回 `null` |

### 7.3 Update 更新

```ts
// 单条
const user = await prisma.user.update({
  where: { id: userId },
  data: { name: "New Name" },
});

// 批量（返回 count）
const result = await prisma.user.updateMany({
  where: { role: "USER" },
  data: { role: "ADMIN" },
});
// result: { count: 42 }

// 批量并返回
const users = await prisma.user.updateManyAndReturn({
  where: { role: "USER" },
  data: { role: "ADMIN" },
});
```

### 7.4 Delete 删除

```ts
// 单条
await prisma.user.delete({ where: { id: userId } });

// 批量条件
await prisma.user.deleteMany({ where: { role: "BANNED" } });

// 删除所有
await prisma.user.deleteMany({}); // 小心！
```

### 7.5 Upsert 创建或更新

```ts
const user = await prisma.user.upsert({
  where: { email: "alice@b.com" },  // 用唯一字段查找
  update: { name: "Alice Updated" }, // 存在就更新
  create: { email: "alice@b.com", name: "Alice" }, // 不存在就创建
});
```

**实际场景**：OAuth 登录时，不管用户是否已存在，都保证有一条记录。

### 7.6 原子操作

```ts
// 点赞数 +1
await prisma.post.update({
  where: { id: postId },
  data: { likes: { increment: 1 } },
});

// 库存减 5
await prisma.product.update({
  where: { id: productId },
  data: { stock: { decrement: 5 } },
});

// 设为某值
await prisma.post.update({
  where: { id: postId },
  data: { views: { set: 0 } },
});
```

---

## 8. 关联查询：include vs select

### 8.1 核心区别

```ts
// include：在已有字段的基础上增加关联对象
const user = await prisma.user.findUnique({
  where: { id },
  include: { posts: true },
});
// 返回 User 所有列 + posts 数组的全部字段

// select：只选择指定的字段，精确控制返回结构
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    name: true,
    posts: { select: { title: true } },
  },
});
// 返回: { name: "Alice", posts: [{ title: "..." }] }
```

**选择策略**：

| 场景 | 用 include | 用 select |
|------|-----------|----------|
| API 列表页（需要精简返回） | ✗ | ✓ |
| 详情页（需要大部分字段） | ✓ | ✗ |
| 排除敏感字段（密码等） | ✗ | ✓ |
| 带宽敏感（移动端） | ✗ | ✓ |

### 8.2 cannot use both include and select

```ts
// ❌ 错误
const user = await prisma.user.findUnique({
  where: { id },
  select: { email: true },   // 选了 select
  include: { posts: true },  // 又用 include
});
// Error: Please either use `include` or `select`, but not both at the same time.

// ✅ 正确：把 include 改写成嵌套 select
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    email: true,
    posts: { select: { title: true } },  // 嵌套 select
  },
});
```

### 8.3 select 中排除字段

Prisma 没有 `exclude` 语法，需要用 `select` 显式列出所有需要的字段。这很繁琐但类型安全：

```ts
// 想排除 password，需要列出所有其他字段
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    name: true,
    createdAt: true,
    profile: { select: { bio: true, avatar: true } },
    // 故意不选 password
  },
});
```

### 8.4 深层嵌套

```ts
// User → Post[] → Category[] → ？
const user = await prisma.user.findUnique({
  where: { id },
  include: {
    posts: {
      include: {
        categories: {
          include: {
            // 可以继续深层嵌套 ...
          },
        },
      },
    },
  },
});
```

**注意**：深层嵌套会产生大量数据，默认用 `select` 约束字段。

---

## 9. 前端数据返回格式大全

以下展示各种实际查询返回给前端的确切 JSON 形状。

### 9.1 单实体查询

```ts
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, name: true, email: true, createdAt: true },
});
```

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Alice",
  "email": "alice@example.com",
  "createdAt": "2024-01-15T08:30:00.000Z"
}
```

### 9.2 一对一包含关联

```ts
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true, name: true,
    profile: { select: { bio: true, avatar: true } },
  },
});
```

```json
{
  "id": "...",
  "name": "Alice",
  "profile": {
    "bio": "Full-stack dev",
    "avatar": "https://cdn.example.com/alice.jpg"
  }
}
```

### 9.3 一对多列表（帖子列表页）

```ts
const posts = await prisma.post.findMany({
  where: { published: true },
  select: {
    id: true,
    title: true,
    createdAt: true,
    author: { select: { id: true, name: true } },
    _count: { select: { comments: true } },
  },
  orderBy: { createdAt: "desc" },
  take: 20,
});
```

```json
[
  {
    "id": "post-uuid-1",
    "title": "Prisma Tips",
    "createdAt": "2024-06-15T10:00:00.000Z",
    "author": { "id": "user-uuid-1", "name": "Alice" },
    "_count": { "comments": 7 }
  },
  {
    "id": "post-uuid-2",
    "title": "TypeScript Deep Dive",
    "createdAt": "2024-06-14T08:00:00.000Z",
    "author": { "id": "user-uuid-2", "name": "Bob" },
    "_count": { "comments": 3 }
  }
]
```

### 9.4 一对多详情（帖子详情页）

```ts
const post = await prisma.post.findUnique({
  where: { id: postId },
  include: {
    author: { select: { id: true, name: true, email: true } },
    categories: { select: { id: true, name: true } },
    comments: {
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    },
  },
});
```

```json
{
  "id": "post-uuid-1",
  "title": "Prisma Tips",
  "content": "Here are some tips for using Prisma...",
  "published": true,
  "createdAt": "2024-06-15T10:00:00.000Z",
  "updatedAt": "2024-06-16T14:00:00.000Z",
  "author": {
    "id": "user-uuid-1",
    "name": "Alice",
    "email": "alice@example.com"
  },
  "categories": [
    { "id": "cat-1", "name": "TypeScript" },
    { "id": "cat-2", "name": "Database" }
  ],
  "comments": [
    {
      "id": "comment-uuid-1",
      "content": "Great article!",
      "createdAt": "2024-06-15T12:00:00.000Z",
      "author": { "name": "Bob" }
    },
    {
      "id": "comment-uuid-2",
      "content": "Very helpful, thanks!",
      "createdAt": "2024-06-15T13:00:00.000Z",
      "author": { "name": "Carol" }
    }
  ]
}
```

### 9.5 多对多（文章 + 分类）

```ts
const posts = await prisma.post.findMany({
  where: {
    categories: { some: { name: "TypeScript" } },  // 筛选 TypeScript 分类
  },
  select: {
    id: true,
    title: true,
    categories: { select: { id: true, name: true } },
  },
});
```

```json
[
  {
    "id": "post-uuid-1",
    "title": "Prisma Tips",
    "categories": [
      { "id": "cat-1", "name": "TypeScript" },
      { "id": "cat-2", "name": "Database" }
    ]
  },
  {
    "id": "post-uuid-3",
    "title": "Advanced TypeScript",
    "categories": [
      { "id": "cat-1", "name": "TypeScript" }
    ]
  }
]
```

### 9.6 分页返回标准格式

```ts
async function getPostsPage(page: number, pageSize: number) {
  const [posts, total] = await prisma.$transaction([
    prisma.post.findMany({
      where: { published: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    }),
    prisma.post.count({ where: { published: true } }),
  ]);

  return {
    data: posts,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
```

```json
{
  "data": [
    { "id": "...", "title": "Prisma Tips", "createdAt": "...", "author": { "name": "Alice" } }
  ],
  "total": 42,
  "page": 2,
  "pageSize": 20,
  "totalPages": 3
}
```

### 9.7 聚合统计返回

```ts
const stats = await prisma.post.groupBy({
  by: ["published"],
  _count: { id: true },
  _avg: { views: true },
});
```

```json
[
  { "published": true, "_count": { "id": 35 }, "_avg": { "views": 1240.5 } },
  { "published": false, "_count": { "id": 7 }, "_avg": { "views": 0 } }
]
```

---

## 10. 高级过滤与查询条件

### 10.1 字符串操作

```ts
where: {
  name: { contains: "Ali" },        // LIKE '%Ali%'
  name: { startsWith: "A" },        // LIKE 'A%'
  name: { endsWith: "e" },          // LIKE '%e'
  name: { equals: "Alice" },        // = 'Alice'
  name: { not: "Bob" },             // != 'Bob'
  name: { in: ["A", "B"] },         // IN ('A','B')
  name: { notIn: ["A", "B"] },      // NOT IN
  name: { mode: 'insensitive' },    // ILIKE (大小写不敏感)
}
```

### 10.2 数字比较

```ts
where: {
  age:  { lt: 18  },   // <
  age:  { lte: 18 },   // <=
  age:  { gt: 18  },   // >
  age:  { gte: 18 },   // >=
  age:  { not: 18 },   // !=
  views: { gt: 1000 },
}
```

### 10.3 日期范围

```ts
where: {
  createdAt: {
    gte: new Date("2024-01-01"),
    lte: new Date("2024-12-31"),
  },
}
```

### 10.4 布尔 + 空值

```ts
where: {
  published: true,
  deletedAt: null,       // IS NULL  (软删除)
  deletedAt: { not: null }, // IS NOT NULL
}
```

### 10.5 OR / AND / NOT 组合

```ts
where: {
  OR: [
    { name: { contains: "Alice" } },
    { email: { contains: "alice" } },
  ],
  AND: [
    { published: true },
    { createdAt: { gte: lastWeek } },
  ],
  NOT: {
    deletedAt: { not: null },
  },
}
```

### 10.6 按关联条件过滤

```ts
// 查找帖子含有至少一个未发布评论的用户
const users = await prisma.user.findMany({
  where: {
    posts: {
      some: {
        comments: {
          some: { published: false },  // 帖子的评论中有未发布的
        },
      },
    },
  },
});
```

`some`、`every`、`none` 的语义：

| 条件 | 含义 | SQL 类比 |
|------|------|----------|
| `some` | 关联中至少一条满足 | `EXISTS` |
| `every` | 关联中全部满足 | `NOT EXISTS (...NOT)` |
| `none` | 关联中全不满足 | `NOT EXISTS` |

```ts
// 找出所有帖子都已发布的用户
const prolificUsers = await prisma.user.findMany({
  where: {
    posts: {
      every: { published: true },
    },
  },
});

// 找出没有任何帖子的用户
const noPosts = await prisma.user.findMany({
  where: {
    posts: { none: {} },
  },
});
```

---

## 11. 分页：skip/take vs cursor

### 11.1 Offset 分页 (skip/take)

```ts
const getPage = async (page: number, pageSize: number) => {
  const [items, total] = await prisma.$transaction([
    prisma.post.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.post.count(),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
};
```

**优点**：实现简单，支持跳转到任意页
**缺点**：skip 大量数据时性能差（数据库要扫描跳过的所有行），并发写入时可能重复或遗漏

### 11.2 Cursor 游标分页（推荐大数据场景）

```ts
// 首页
const firstPage = await prisma.post.findMany({
  take: 20,
  orderBy: { id: "asc" },
});
const cursor = firstPage[firstPage.length - 1].id;

// 下一页（使用 cursor）
const nextPage = await prisma.post.findMany({
  take: 20,
  skip: 1,          // 跳过 cursor 本身
  cursor: { id: cursor },
  orderBy: { id: "asc" },
});

// 通用封装
async function cursorPaginate<T>(
  model: any,
  cursor?: string,
  take: number = 20
) {
  const items = await model.findMany({
    take: take + 1,  // 多取 1 条判断是否有下一页
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { id: "asc" },
  });

  const hasMore = items.length > take;
  if (hasMore) items.pop();

  return {
    data: items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
    hasMore,
  };
}
```

**前端请求示例：**

```
GET /api/posts?cursor=550e8400-e29b-41d4-a716-446655440000&take=20
```

**API 返回格式：**

```json
{
  "data": [ /* 20 条记录 */ ],
  "nextCursor": "550e8400-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "hasMore": true
}
```

**Cursor vs Offset 对比：**

| | Offset (skip/take) | Cursor |
|------|----------|--------|
| 跳转任意页 | ✓ | ✗ |
| 大数据性能 | ✗ (OFFSET N 慢) | ✓ (利用索引) |
| 实时数据一致性 | ✗ (插入/删除导致偏移) | ✓ |
| 实现复杂度 | 简单 | 略复杂 |
| 适用场景 | 管理后台 | 信息流、移动端 |

### 11.3 混合方案

前端管理后台用 offset 分页，前端用户端（信息流）用 cursor 分页。

---

## 12. 嵌套写入：一请求写多表

嵌套写入在一个 Prisma 请求中操作多个表，具有事务性——全部成功或全部失败。

### 12.1 create：创建父记录 + 子记录

```ts
// 创建用户同时创建资料和文章
const user = await prisma.user.create({
  data: {
    email: "alice@example.com",
    name: "Alice",
    profile: {
      create: { bio: "dev" },               // 同时创建 profile
    },
    posts: {
      create: [
        { title: "Post 1" },
        { title: "Post 2" },
      ],
    },
  },
  include: { profile: true, posts: true },
});
```

### 12.2 connect：连接已存在记录

```ts
// 给已有文章添加已有分类
await prisma.post.update({
  where: { id: postId },
  data: {
    categories: {
      connect: [{ id: catId1 }, { id: catId2 }],
    },
  },
});
```

### 12.3 disconnect：断开关联

```ts
await prisma.post.update({
  where: { id: postId },
  data: {
    categories: { disconnect: [{ id: catId }] },
  },
});
```

### 12.4 set：替换整个关联列表

```ts
// 把文章的分类完全替换为新的
await prisma.post.update({
  where: { id: postId },
  data: {
    categories: {
      set: [{ id: catId1 }, { id: catId2 }],  // 覆盖所有分类
    },
  },
});
```

### 12.5 connectOrCreate

```ts
await prisma.post.update({
  where: { id: postId },
  data: {
    categories: {
      connectOrCreate: {
        where: { name: "TypeScript" },
        create: { name: "TypeScript" },
      },
    },
  },
});
```

### 12.6 delete / deleteMany：关联中删除

```ts
await prisma.user.update({
  where: { id: userId },
  data: {
    posts: {
      delete: { id: somePostId },
      // 或 deleteMany: { published: false }
    },
  },
});
```

### 12.7 嵌套写入操作汇总

| 操作 | 含义 |
|------|------|
| `create` | 创建新子记录 |
| `createMany` | 批量创建子记录 |
| `connect` | 关联已有记录 |
| `connectOrCreate` | 查找或创建后关联 |
| `set` | 用新列表完全替换关联 |
| `disconnect` | 取消关联 |
| `update` | 更新关联记录 |
| `upsert` | 更新或创建关联 |
| `delete` | 删除关联记录 |
| `deleteMany` | 批量删除关联 |
| `updateMany` | 批量更新关联 |

---

## 13. 查询优化策略

### 13.1 只选需要的字段

```ts
// ❌ 差：选择所有字段（100 列的表，返回 30 列用不到的）
const users = await prisma.user.findMany();

// ✅ 好：只选需要的字段
const users = await prisma.user.findMany({
  select: { id: true, name: true },
});
```

### 13.2 使用索引

```prisma
model Post {
  id        String   @id @default(uuid())
  authorId  String
  published Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([authorId])                  // 按作者查询
  @@index([published, createdAt])      // 按状态 + 时间排序
}
```

看到哪里 `where` 和 `orderBy` 中高频出现的字段，就加索引。

### 13.3 使用 findUnique 而非 findFirst

`findUnique` 基于索引查找，`findFirst` 会做全表扫描或部分扫描。

```ts
// ✅ 通过唯一字段查询 --- 使用索引
const user = await prisma.user.findUnique({ where: { email } });

// ❌ 非唯一字段 --- 可能扫描
const user = await prisma.user.findFirst({ where: { name: "Alice" } });
```

### 13.4 use cursor pagination for large datasets

```ts
// ❌ skip 100000 会很慢
const posts = await prisma.post.findMany({ skip: 100000, take: 20 });

// ✅ 游标分页
const posts = await prisma.post.findMany({
  take: 20,
  skip: 1,
  cursor: { id: lastId },
});
```

### 13.5 合理使用 include —— 避免 N+1

```ts
// ❌ N+1：先查用户列表，再循环查每个用户的帖子
const users = await prisma.user.findMany();
for (const u of users) {
  const posts = await prisma.post.findMany({ where: { authorId: u.id } });  // N 次查询！
}

// ✅ 一次查询用 include
const users = await prisma.user.findMany({
  include: { posts: true },
});
```

### 13.6 关系加载策略（PostgreSQL / MySQL）

```prisma
generator client {
  provider        = "prisma-client"
  previewFeatures = ["relationJoins"]
}
```

```ts
// join：数据库级别 JOIN + JSON 聚合，单次查询完成（默认，绝大多数场景更优）
const users = await prisma.user.findMany({
  relationLoadStrategy: "join",
  include: { posts: true },
});

// query：多个查询应用层合并（数据库计算压力大时用这个）
const users = await prisma.user.findMany({
  relationLoadStrategy: "query",
  include: { posts: true },
});
```

**join 策略**适合大多数场景，把 JSON 拼装工作交给数据库。**query 策略**适合数据库服务器资源紧张，希望把合并工作交给应用层的场景。

### 13.7 批量操作

```ts
// ❌ 循环创建 100 条
for (const item of items) {
  await prisma.user.create({ data: item });
} // 100 次网络往返

// ✅ 批量创建 1 次网络往返
await prisma.user.createMany({ data: items });
```

---

## 14. 事务处理

### 14.1 批量事务

```ts
// 多个独立查询，作为一个原子操作
const [newUser, profileCreated] = await prisma.$transaction([
  prisma.user.create({ data: { email, name } }),
  prisma.profile.create({ data: { bio, userId: someId } }),
]);
```

### 14.2 交互式事务（需要中间结果时）

```ts
const result = await prisma.$transaction(async (tx) => {
  // 1. 查库存
  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product || product.stock < quantity) {
    throw new Error("库存不足");
  }

  // 2. 减库存
  await tx.product.update({
    where: { id: productId },
    data: { stock: { decrement: quantity } },
  });

  // 3. 创建订单
  const order = await tx.order.create({
    data: {
      userId,
      totalPrice: product.price * quantity,
      items: { create: { productId, quantity } },
    },
  });

  return order; // 可以返回值给外部
});
// 任何一步抛异常，全部回滚
```

### 14.3 事务隔离级别（仅交互式事务）

```ts
await prisma.$transaction(
  async (tx) => {
    // ...
  },
  { isolationLevel: "Serializable" }
);
```

---

## 15. 聚合与统计

### 15.1 count

```ts
const total = await prisma.post.count({
  where: { published: true },
});

// 关联计数（帖子数 > 5 的用户）
const users = await prisma.user.findMany({
  where: { posts: { _count: { gt: 5 } } },
});
```

### 15.2 groupBy

```ts
const result = await prisma.post.groupBy({
  by: ["authorId"],
  _count: { id: true },
  _sum: { likes: true },
  _avg: { views: true },
  _min: { createdAt: true },
  _max: { createdAt: true },
  orderBy: { _count: { id: "desc" } },
  having: {
    id: { _count: { gt: 5 } },  // 只返回帖子数 > 5 的作者
  },
});
```

**返回格式：**

```json
[
  {
    "authorId": "user-uuid-1",
    "_count": { "id": 15 },
    "_sum": { "likes": 230 },
    "_avg": { "views": 1240.5 },
    "_min": { "createdAt": "2024-01-01T00:00:00.000Z" },
    "_max": { "createdAt": "2024-06-15T10:00:00.000Z" }
  }
]
```

### 15.3 aggregate（不分组，全表聚合）

```ts
const stats = await prisma.post.aggregate({
  _count: { id: true },
  _avg: { views: true },
  _max: { views: true },
  where: { published: true },
});
// { _count: { id: 42 }, _avg: { views: 1200 }, _max: { views: 15000 } }
```

---

## 16. 实际 API 场景示例

### 16.1 博客文章列表 API

```ts
// GET /api/posts?page=1&pageSize=10&category=typescript&search=prisma
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "10"), 50);
  const category = searchParams.get("category");
  const search = searchParams.get("search");

  const where: any = { published: true };

  if (category) {
    where.categories = { some: { name: category } };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
    ];
  }

  const [posts, total] = await prisma.$transaction([
    prisma.post.findMany({
      where,
      select: {
        id: true,
        title: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
        categories: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.post.count({ where }),
  ]);

  return Response.json({
    data: posts,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
```

### 16.2 创建文章（含分类关联）

```ts
// POST /api/posts
import { z } from "zod";

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().optional(),
  categoryIds: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const body = CreatePostSchema.parse(await req.json());
  const userId = getCurrentUserId(); // 从 session/middleware 获取

  const post = await prisma.post.create({
    data: {
      title: body.title,
      content: body.content,
      author: { connect: { id: userId } },
      ...(body.categoryIds?.length && {
        categories: { connect: body.categoryIds.map((id) => ({ id })) },
      }),
    },
    include: {
      author: { select: { id: true, name: true } },
      categories: { select: { id: true, name: true } },
    },
  });

  return Response.json(post, { status: 201 });
}
```

返回前端：

```json
{
  "id": "post-uuid-new",
  "title": "My New Post",
  "content": "Some content",
  "author": { "id": "user-uuid-1", "name": "Alice" },
  "categories": [
    { "id": "cat-1", "name": "TypeScript" }
  ]
}
```

### 16.3 社交关注/取消关注

```ts
// POST /api/users/:id/follow
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const currentUserId = getCurrentUserId();
  const targetId = params.id;

  await prisma.user.update({
    where: { id: currentUserId },
    data: {
      following: { connect: { id: targetId } },
    },
  });

  return new Response(null, { status: 204 });
}

// DELETE /api/users/:id/follow
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await prisma.user.update({
    where: { id: getCurrentUserId() },
    data: {
      following: { disconnect: { id: params.id } },
    },
  });

  return new Response(null, { status: 204 });
}
```

### 16.4 用户资料更新

```ts
// PUT /api/users/profile
export async function PUT(req: Request) {
  const { name, bio, avatar } = await req.json();
  const userId = getCurrentUserId();

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      profile: {
        upsert: {          // 不存在就创建，存在就更新
          create: { bio, avatar },
          update: { bio, avatar },
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      profile: { select: { bio: true, avatar: true } },
    },
  });

  return Response.json(user);
}
```

### 16.5 仪表盘统计

```ts
// GET /api/dashboard
export async function GET() {
  const userId = getCurrentUserId();

  const [postCount, totalViews, recentPosts] = await prisma.$transaction([
    prisma.post.count({ where: { authorId: userId } }),
    prisma.post.aggregate({
      where: { authorId: userId },
      _sum: { views: true },
    }),
    prisma.post.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, views: true, createdAt: true },
    }),
  ]);

  return Response.json({
    postCount,
    totalViews: totalViews._sum.views || 0,
    recentPosts,
  });
}
```

---

## 17. Prisma Migrate

```bash
# 创建新迁移（开发）
npx prisma migrate dev --name add_user_table

# 查看迁移状态
npx prisma migrate status

# 生产应用
npx prisma migrate deploy

# 重置开发数据库
npx prisma migrate reset

# 从已有数据库生成 schema
npx prisma db pull

# 推送 schema 变更（跳过迁移文件）
npx prisma db push

# 种子数据
npx prisma db seed
```

### 生产环境迁移注意事项

```bash
# 永远在生产使用这个，不是 migrate dev
npx prisma migrate deploy

# 先在 CI 中检查迁移是否可安全执行
npx prisma migrate status
```

---

## 18. 最佳实践清单

### Schema 设计

- [ ] 每个 model 至少有 `@id`/`@@id` 或 `@unique`/`@@unique`
- [ ] 对有外键关系的字段添加对应的 `@@index`（如 `authorId`）
- [ ] 对高频查询条件（`where` 中出现的列）添加 `@@index`
- [ ] 不需要中间表额外字段时用隐式 m-n，否则用显式 m-n
- [ ] 一对一关系的外键列加 `@unique`
- [ ] 对外暴露的 ID 推荐用 `@default(uuid())` 而非自增
- [ ] 考虑 `onDelete` 策略（`Cascade` / `SetNull` / `Restrict`）

### 查询

- [ ] 总是使用 `select` 指定返回字段，勿用默认 select all
- [ ] 不在循环中执行查询——用 `include` 或批量操作
- [ ] 通过 `@unique` 字段查询时用 `findUnique`，不用 `findFirst`
- [ ] 大数据量用 cursor 分页，管理后台可用 offset 分页
- [ ] 多表写操作放入 `$transaction` 保证一致性
- [ ] 利用 `relationLoadStrategy: "join"` 减少查询数

### 安全

- [ ] 不要在 `select` 中包含 `password` 等敏感字段
- [ ] 使用 TypeScript 的 `zod` 等库校验前端输入
- [ ] 禁止前端直接传 `where` 对象——始终在后端构建查询条件
- [ ] `$executeRawUnsafe` 仅用于无用户输入的场景
- [ ] `deleteMany({})` 需加二次确认逻辑

### 生产部署

- [ ] 使用 `migrate deploy` 而非 `migrate dev`
- [ ] `NODE_ENV=production` 时 Prisma 会禁用开发日志
- [ ] 合理配置 Prisma Client 连接池（通过 `connection_limit` 参数）

---

> 本文档基于 [Prisma 官方文档](https://www.prisma.io/docs) (v7.x) 编写，2026年5月。覆盖从 schema 设计到 API 返回前端的完整链路。
