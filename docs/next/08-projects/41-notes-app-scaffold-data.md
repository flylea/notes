# 41 · Notes App A：脚手架与数据层

> **一句话结论**：数据层只需要做三件事——**定义 schema、提供一个只能在服务端 import 的连接、把校验和查询收进一个 Data Access Layer**。做完这三件事，后面所有页面和 action 都只依赖 DAL 的函数签名，换 ORM 都不影响 UI。

## 最小可运行示例

```bash
# 建项目
pnpm create next-app@latest notes-app --yes
cd notes-app

# 数据层依赖
pnpm add @prisma/client zod
pnpm add -D prisma tsx
```

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  notes     Note[]
  tags      Tag[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Note {
  id        String    @id @default(cuid())
  title     String
  content   String    @default("")
  archived  Boolean   @default(false)
  authorId  String
  author    User      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  tags      NoteTag[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  // 列表页的查询模式：按作者过滤 + 按更新时间倒序
  @@index([authorId, updatedAt(sort: Desc)])
}

model Tag {
  id      String    @id @default(cuid())
  name    String
  color   String    @default("#64748b")
  ownerId String
  owner   User      @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  notes   NoteTag[]

  // 同一个用户下标签名唯一；不同用户可以有同名标签
  @@unique([ownerId, name])
}

// 显式的联结表：多对多要能被查询、能被统计，所以不交给隐式约定
model NoteTag {
  noteId String
  tagId  String
  note   Note @relation(fields: [noteId], references: [id], onDelete: Cascade)
  tag    Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([noteId, tagId])
  @@index([tagId])
}
```

```bash
# .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/notes?schema=public"

# 建表 + 生成客户端
pnpm prisma migrate dev --name init
```

```ts
// lib/db.ts
import 'server-only'

import { PrismaClient } from '@prisma/client'

// 开发环境下 HMR 会反复执行模块顶层代码，每次都 new 一个客户端会耗尽连接池。
// 把实例挂到 globalThis 上，热更新时复用同一个。
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

`import 'server-only'` 这一行是整个数据层最重要的防线。它让任何客户端组件 import 这个文件时**构建直接失败**，而不是悄悄把 `DATABASE_URL` 打进客户端 bundle。

## 为什么 schema 要这么设计

### 为什么 NoteTag 是显式模型而不是隐式多对多

Prisma 支持隐式多对多——两个模型互相写 `Tag[]` 和 `Note[]`，Prisma 自动建一张联结表：

```prisma
// 隐式多对多的写法（本项目没采用）
model Note {
  tags Tag[]
}

model Tag {
  notes Note[]
}
```

它更短，但有两个代价：

1. **联结表不可见**。你想查「这个标签下有多少条笔记」时，得走 `_NoteToTag` 这种自动生成的名字，可读性差。
2. **不能加字段**。将来想给关联加 `addedAt`（什么时候打的标签）、`addedBy`（谁打的），隐式表改不了，只能迁移成显式表——那是一次数据迁移。

显式表多写 5 行，省掉一次未来的迁移。

### 为什么用 `cuid()` 而不是自增 ID

| 方案 | URL 形态 | 问题 |
|---|---|---|
| 自增整数 | `/notes/42` | 可枚举。用户能推断出系统里有多少条笔记、别人的 ID 是什么 |
| `uuid()` | `/notes/9f1c…` | 随机，但无序——索引插入时 B-tree 会频繁分裂 |
| `cuid()` | `/notes/clx8k2…` | 前缀含时间戳，单调递增，对索引友好 |

自增 ID 的「可枚举」不是理论问题：只要 action 里忘了做归属校验（见 [44 章](./44-notes-app-auth.md)），攻击者就能用 `/notes/1`、`/notes/2` 遍历整个库。用不可预测的 ID 是纵深防御的一层。

### 为什么索引是 `[authorId, updatedAt]`

列表页的查询是固定的：

```ts
// lib/dal/notes.ts —— 列表页的固定查询模式
prisma.note.findMany({
  where: { authorId: userId, archived: false },
  orderBy: { updatedAt: 'desc' },
  take: 20,
})
```

复合索引的**列顺序**由查询决定：等值条件在前，排序字段在后。`[authorId, updatedAt]` 让数据库先按 `authorId` 定位到一个连续区间，区间内已经按 `updatedAt` 排好序——不需要额外排序。

写成 `[updatedAt, authorId]` 就没用了：数据库得先扫时间轴，再过滤作者。

`updatedAt(sort: Desc)` 是给 PostgreSQL 的提示，让索引的物理顺序和查询顺序一致，省掉一次反向扫描。

## 校验层：Zod schema 与它的导出类型

校验器放在一个**不依赖数据库**的模块里。这样客户端组件也能 import 类型，而不会连带把 Prisma 拖进 bundle。

```ts
// lib/validations/note.ts
import { z } from 'zod'

export const MAX_TITLE = 200
export const MAX_CONTENT = 50_000
export const MAX_TAGS_PER_NOTE = 10

export const createNoteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: '标题不能为空' })
    .max(MAX_TITLE, { error: `标题不能超过 ${MAX_TITLE} 个字符` }),
  content: z
    .string()
    .max(MAX_CONTENT, { error: `内容不能超过 ${MAX_CONTENT} 个字符` })
    .default(''),
  tagIds: z.array(z.string().cuid()).max(MAX_TAGS_PER_NOTE).default([]),
})

// 更新时所有字段可选，但至少要传一个
export const updateNoteSchema = createNoteSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    error: '至少要修改一个字段',
  })

export const createTagSchema = z.object({
  name: z.string().trim().min(1, { error: '标签名不能为空' }).max(24),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { error: '颜色必须是 #RRGGBB 格式' })
    .default('#64748b'),
})

// 类型从 schema 推导，不手写第二遍
export type CreateNoteInput = z.input<typeof createNoteSchema>
export type CreateNoteData = z.output<typeof createNoteSchema>
export type UpdateNoteInput = z.input<typeof updateNoteSchema>
export type CreateTagInput = z.input<typeof createTagSchema>
```

三个容易忽略的点：

**`z.input` 和 `z.output` 是两个类型**。`default()` 让字段在**输入时可选、输出时必填**。`z.input` 是「调用方可以传什么」，`z.output` 是「校验后拿到什么」。`content: z.string().default('')` 的输入类型是 `string | undefined`，输出类型是 `string`。

**`.trim()` 的位置有语义**。它既是校验也是**变换**——校验后的值已经去过首尾空格。所以 action 里直接用 `validated.data.title` 就行，不要再 trim 一次。

**`.partial()` 之后再 `.refine()` 的顺序不能反**。`.partial()` 返回的是 ZodObject，有 `.refine()`；`.refine()` 返回的是 ZodEffects，没有 `.partial()`。

## Data Access Layer：查询和授权收在一处

DAL 是**唯一允许 `process.env` 和 Prisma 查询存在的地方**。它做三件事：鉴权、查询、把结果拍成纯对象。

```ts
// lib/dal/notes.ts
import 'server-only'

import { cache } from 'react'
import { prisma } from '@/lib/db'
import type { CreateNoteData } from '@/lib/validations/note'

// DTO：只有页面需要的字段，且都是原始类型
export type NoteListItem = {
  id: string
  title: string
  updatedAt: string
  tags: { id: string; name: string; color: string }[]
}

export type NoteDetail = NoteListItem & {
  content: string
  archived: boolean
}

// 为什么手动映射而不是直接返回 Prisma 的结果：
// 1. Date 不是缓存/序列化友好类型，转成 ISO 字符串
// 2. Prisma 返回的是类实例，缓存组件不能接收类实例做参数
// 3. 显式列出字段 = 显式列出「允许出服务端的东西」
function toListItem(note: {
  id: string
  title: string
  updatedAt: Date
  tags: { tag: { id: string; name: string; color: string } }[]
}): NoteListItem {
  return {
    id: note.id,
    title: note.title,
    updatedAt: note.updatedAt.toISOString(),
    tags: note.tags.map(({ tag }) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
    })),
  }
}

export async function listNotes(
  authorId: string,
  options: { cursor?: string; take?: number } = {}
): Promise<{ notes: NoteListItem[]; nextCursor: string | null }> {
  const take = options.take ?? 20

  const rows = await prisma.note.findMany({
    where: { authorId, archived: false },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    // 多取一条用来判断「还有没有下一页」，返回前丢掉
    take: take + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    include: { tags: { include: { tag: true } } },
  })

  const hasMore = rows.length > take
  const notes = (hasMore ? rows.slice(0, take) : rows).map(toListItem)

  return { notes, nextCursor: hasMore ? notes[notes.length - 1].id : null }
}

export const getNote = cache(
  async (id: string, authorId: string): Promise<NoteDetail | null> => {
    const note = await prisma.note.findFirst({
      // 注意 where 里带 authorId：归属校验和查询是同一次数据库往返，
      // 不存在「先查出来再判断归属」那个可以被绕过的窗口
      where: { id, authorId },
      include: { tags: { include: { tag: true } } },
    })

    if (!note) return null

    return { ...toListItem(note), content: note.content, archived: note.archived }
  }
)

export async function createNote(
  authorId: string,
  data: CreateNoteData
): Promise<NoteDetail> {
  const note = await prisma.note.create({
    data: {
      title: data.title,
      content: data.content,
      authorId,
      tags: {
        create: data.tagIds.map((tagId) => ({ tagId })),
      },
    },
    include: { tags: { include: { tag: true } } },
  })

  return { ...toListItem(note), content: note.content, archived: note.archived }
}
```

三个设计点值得展开：

**`where: { id, authorId }` 而不是 `where: { id }` 再判断。** 这不是风格问题。「先查再判断」的写法里，任何一条提前 `return` 的路径（比如后面加了日志、加了缓存、加了重试）都可能漏掉判断。把归属条件写进 `where`，**查不到就是没有权限**，不存在中间状态。

**`React.cache` 包住 `getNote`。** 同一次渲染里，页面组件和它的 `generateMetadata` 都会调 `getNote`。没有 `cache` 就是两次数据库往返；有了 `cache` 只打一次。注意 `React.cache` 的作用域是**单次请求**，不是跨请求缓存——它不是缓存层。

**多取一条做游标分页。** `take: take + 1` 然后判断长度，比 `count()` 再查一次便宜得多。游标分页本身比 offset 分页更适合「按更新时间倒序」的列表：offset 分页在数据插入时会出现**重复项或跳过项**，游标分页不会。

## 种子数据

```ts
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      tags: {
        create: [
          { name: '工作', color: '#3b82f6' },
          { name: '灵感', color: '#f59e0b' },
          { name: '待办', color: '#ef4444' },
        ],
      },
    },
    include: { tags: true },
  })

  const [work, idea, todo] = user.tags

  await prisma.note.createMany({
    data: [
      { title: '周一站会记录', content: '…', authorId: user.id },
      { title: '重构缓存层的想法', content: '…', authorId: user.id },
      { title: '给 onboarding 加个进度条', content: '…', authorId: user.id },
    ],
  })

  const notes = await prisma.note.findMany({ where: { authorId: user.id } })

  await prisma.noteTag.createMany({
    data: [
      { noteId: notes[0].id, tagId: work.id },
      { noteId: notes[1].id, tagId: idea.id },
      { noteId: notes[2].id, tagId: todo.id },
      { noteId: notes[2].id, tagId: work.id },
    ],
  })

  console.log(`Seeded ${notes.length} notes for ${user.email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
```

```json
// package.json（片段）
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

`upsert` 而不是 `create` 让种子脚本**可以重复执行**。`createMany` 而不是循环 `create` 是为了把 N 次往返压成 1 次。这两条在 CI 里重置数据库时很关键。

## 目录结构

```
notes-app/
├─ app/
│  ├─ actions/          # Server Actions（'use server'）
│  ├─ notes/            # 路由
│  └─ layout.tsx
├─ lib/
│  ├─ db.ts             # PrismaClient 单例，import 'server-only'
│  ├─ dal/              # Data Access Layer：查询 + 授权 + DTO
│  ├─ validations/      # Zod schema 与推导类型
│  └─ auth.ts           # 会话读取
├─ prisma/
│  ├─ schema.prisma
│  ├─ seed.ts
│  └─ migrations/
└─ next.config.ts
```

分层的依赖方向是单向的：

```
app/  ──→  lib/dal  ──→  lib/db
   └──→  lib/validations
```

`lib/dal` 不知道 `app/` 的存在，`lib/validations` 不知道数据库的存在。**反向依赖一旦出现，就说明你把业务逻辑放错了层。**

## 常见坑

- **现象**：`next dev` 跑一会儿报 `Too many clients already` 或连接池耗尽。
  **原因**：开发环境下模块热更新会重新执行顶层代码，每次 `new PrismaClient()` 都开一个新的连接池。
  **解法**：用 `globalThis` 缓存实例（本章 `lib/db.ts` 的写法）。生产环境每个进程只有一次初始化，可以不用，但加上无害。

- **现象**：客户端组件 import 了 DAL 里的类型，结果构建报错说不能用 `server-only`。
  **原因**：`import type` 会被编译期擦除，但**不带 `type` 的 import 不会**。写成 `import { NoteDetail } from '@/lib/dal/notes'` 就把整个模块拉进了依赖图。
  **解法**：类型从 DAL 里 `export type`，客户端用 `import type { NoteDetail } from '@/lib/dal/notes'`。更彻底的做法是把 DTO 类型放到一个独立的 `lib/types.ts` 里。

- **现象**：缓存组件接收笔记数据时构建超时或报序列化错误。
  **原因**：Prisma 返回的 `Date` 和模型实例不是「可安全序列化」的类型。
  **解法**：DAL 里就映射成纯对象（`toISOString()`、显式列字段）。不要指望在页面层再转换——页面层已经太晚了。

- **现象**：`prisma migrate dev` 在有未提交改动的环境里提示要重置数据库。
  **原因**：`migrate dev` 是**开发专用**命令，检测到 schema 与迁移历史不一致时会要求 reset。
  **解法**：生产环境只用 `prisma migrate deploy`，它只应用已有迁移，永不重置。

- **现象**：游标分页翻到第二页时，第一条和第一页的最后一条重复。
  **原因**：`cursor` + `skip: 1` 两个参数必须成对出现。只传 `cursor` 会把游标那条记录也返回。
  **解法**：`...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})`。另外排序字段要**包含唯一列**（这里补了 `id` 作为次级排序），否则 `updatedAt` 相同的记录顺序不稳定，游标会漂移。

- **现象**：Zod 校验后的 `content` 类型是 `string`，但传进去的时候 TS 说 `string | undefined` 不匹配。
  **原因**：`default()` 让输入类型可选。你用的是 `z.infer`（等于 `z.output`），但传的是未校验的输入。
  **解法**：函数签名接收 `z.input<typeof schema>`，内部校验后用 `validated.data`（`z.output`）。两个类型分开命名，编译期就暴露这类错误。

## API / 配置速查

| API | 签名 / 用法 | 说明 |
|---|---|---|
| `new PrismaClient()` | — | 单例，用 `globalThis` 缓存，避免 HMR 耗尽连接池 |
| `prisma.$disconnect()` | `() => Promise<void>` | 脚本结束时释放连接 |
| `findMany({ cursor, skip, take })` | — | 游标分页三件套，`skip: 1` 跳过游标本身 |
| `upsert({ where, update, create })` | — | 让种子脚本可重复执行 |
| `createMany({ data })` | — | 批量插入，N 次往返压成 1 次 |
| `React.cache(fn)` | `(fn) => fn` | 单次请求内去重，**不是跨请求缓存** |
| `z.input<T>` | 类型 | 校验**前**的输入类型（`default` 字段可选） |
| `z.output<T>` | 类型 | 校验**后**的类型（`default` 字段必填） |

| 命令 | 作用 |
|---|---|
| `prisma migrate dev --name <n>` | 开发：生成迁移并应用到本地库 |
| `prisma migrate deploy` | 生产：只应用已有迁移，不重置 |
| `prisma generate` | 重新生成客户端类型 |
| `prisma studio` | 可视化数据浏览器 |
| `prisma db seed` | 执行 `package.json` 里配的 seed 脚本 |

## 延伸阅读

- [Prisma 官方文档：Schema](https://www.prisma.io/docs/orm/prisma-schema/overview)
- [Prisma 官方文档：Client 单例模式](https://www.prisma.io/docs/orm/more/help-and-troubleshooting/nextjs-help)
- [Prisma 官方文档：分页](https://www.prisma.io/docs/orm/prisma-client/queries/pagination)
- [Zod 官方文档](https://zod.dev/)
- [官方文档：Data Security（DAL 与 DTO）](https://nextjs.org/docs/app/guides/data-security)
- [React 文档：`cache`](https://react.dev/reference/react/cache)
- [官方文档：`server-only`](https://www.npmjs.com/package/server-only)
