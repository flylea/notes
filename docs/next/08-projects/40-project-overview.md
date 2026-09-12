# 40 · 实战总览与技术选型

> **一句话结论**：三个项目不是三个独立 demo，是一条**能力递进线**——Notes App 把 App Router 的读写闭环走通，Blog 把「内容管线 + 缓存隔离」走通，SaaS 把「多租户 + 多区域」走通。选型上只有一条原则：**优先选和 React Server Components 同一套心智模型的库**，凡是要求「数据必须经过客户端 store」的方案，在这个架构里都是逆风的。

## 三个项目与它们的递进关系

| | Notes App | Blog | SaaS |
|---|---|---|---|
| 一句话定位 | 单人/小团队的笔记应用 | 内容站，读多写少 | 多租户平台，一码多客 |
| 核心能力 | 读写闭环、乐观更新、认证授权 | 内容管线、SEO、草稿隔离 | 租户隔离、缓存分片、多区域 |
| 章节 | 41–46 | 47–49 | 50–51 |
| 数据形态 | 关系型，写多 | 文件系统 + 少量关系型 | 关系型，强隔离 |
| 缓存策略 | 按用户失效 | 按标签失效 + 草稿旁路 | 按租户分片 |
| 新引入的难点 | Server Actions 鉴权、乐观 UI | MDX 编译、Draft Mode 与缓存互斥 | 缓存键不能串 |

递进关系是刻意的：

- **Notes App 建立「服务端为真」的直觉**。数据从 DAL 出来、经过 Server Component、由 Server Action 写回，客户端只负责交互态。这个模型一旦建立，后面两章只是加约束。
- **Blog 引入「内容不是数据」的第二种来源**。MDX 走构建期编译，评论走运行时数据库，两种东西的缓存寿命差三个数量级——把它们放在同一页里，才逼你真正理解 `cacheLife` 和 Draft Mode 的旁路机制。
- **SaaS 引入「同一份代码服务多个主体」**。多租户本身不难，难的是缓存。前两个项目里「缓存命中」永远是好事，到了 SaaS，缓存命中到别人的数据上是 P0 事故。

先做 Notes App。它是唯一一个你可以在一个下午从零跑通全部功能的项目。

## 选型对照表

| 维度 | 本笔记的选择 | 主要备选 | 决策依据 |
|---|---|---|---|
| ORM | **Prisma** | Drizzle | 迁移工具链成熟，schema 可读性高 |
| 校验 | **Zod** | Valibot | 生态位事实标准，表单库/ORM 集成齐全 |
| 认证 | **Better Auth** | Auth.js (NextAuth) | 默认数据库会话，Server Action 里取会话更直接 |
| UI 组件 | **shadcn/ui** | 自建 / MUI | 复制进仓库的源码，改样式不需要和库对抗 |
| 样式 | **Tailwind CSS v4** | CSS Modules | `create-next-app` 默认，服务端零运行时 |
| 表单 | **原生 `<form>` + Server Actions** | React Hook Form | 渐进增强白送，少一层客户端状态 |
| 类型安全 API | **不用 tRPC**（Route Handlers + Server Actions） | tRPC | 单仓全栈时 Server Action 已覆盖大部分场景 |
| 内容 | **`@next/mdx` 原生方案** | Contentlayer | Contentlayer 已停止维护 |
| 测试 | **Vitest + Playwright** | Jest + Cypress | 与 ESM/Turbopack 兼容性更好 |
| 部署 | **平台托管为主，自托管对照** | 二选一 | 两条路的缓存语义不同，都要知道 |

下面逐项讲为什么。

## ORM：Prisma 还是 Drizzle

**结论：本项目选 Prisma。理由不是「更好」，而是「迁移成本和心智成本更低」。**

两者的核心差异在抽象层次：

```ts
// lib/db/queries.ts —— Prisma 的写法
const notes = await prisma.note.findMany({
  where: { authorId: userId, archived: false },
  orderBy: { updatedAt: 'desc' },
  include: { tags: true },
})
```

```ts
// lib/db/queries.ts —— Drizzle 的写法
const notes = await db
  .select()
  .from(notes)
  .where(and(eq(notes.authorId, userId), eq(notes.archived, false)))
  .orderBy(desc(notes.updatedAt))
```

Prisma 的 schema 是**独立的 DSL 文件**，Drizzle 的 schema 是 **TypeScript 文件**。这个差异带来三个连带后果：

1. **迁移工作流**。Prisma 的 `prisma migrate dev` 会生成可审阅的 SQL 迁移文件，`prisma db push` 用于原型。Drizzle 的 `drizzle-kit generate` 同样成熟，但生态里围绕 Prisma 的迁移工具（Studio、Data Proxy、迁移部署检查）更厚。
2. **关系查询的表达力**。Prisma 的 `include` / `select` 对多对多和嵌套关系更省事——本项目的笔记带标签，正是这种场景。Drizzle 的关系查询需要显式写 join 或配置 `relations`。
3. **类型推导路径**。Prisma 生成的类型来自 schema 文件，Drizzle 的类型直接来自 TS 推导。后者更「原生」，前者更「约定」。

**反过来，什么时候该选 Drizzle**：

- 你写的是**边缘函数或轻量 serverless**，Prisma 的引擎体积（哪怕用 driver adapter）仍然是负担。
- 你需要**手写复杂 SQL**（窗口函数、CTE、`ON CONFLICT DO UPDATE`）。Drizzle 更接近 SQL，不需要「先看 Prisma 支持不支持」。
- 你的团队**排斥代码生成**。Prisma 的 `generate` 步骤在 CI 和 monorepo 里经常需要额外配置。

两者的关系不是「新替代旧」。Prisma 在这个项目里赢在「少写 join」和「迁移可读」。

## 校验：Zod 还是 Valibot

**结论：本项目选 Zod。Valibot 在包体积敏感的场景下更优，但 Server Actions 场景下体积不是瓶颈。**

Zod 与 Valibot 的能力几乎重叠，真正的差异是**打包体积和 API 风格**。

Zod 的每个校验器是一个类实例，链式调用返回新实例：

```ts
// lib/validations/note.ts
import { z } from 'zod'

export const noteSchema = z.object({
  title: z.string().min(1, { error: '标题不能为空' }).max(200),
  content: z.string().max(50_000).default(''),
  tagIds: z.array(z.string().uuid()).max(10).default([]),
})
```

Valibot 的每个校验器是一个纯函数，链式组合靠 `pipe`：

```ts
// lib/validations/note.ts —— 同一份校验的 Valibot 写法
import * as v from 'valibot'

export const NoteSchema = v.object({
  title: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  content: v.optional(v.pipe(v.string(), v.maxLength(50_000)), ''),
  tagIds: v.optional(v.pipe(v.array(v.string()), v.maxLength(10)), []),
})
```

关键差异点：

| 维度 | Zod | Valibot |
|---|---|---|
| 体积 | 较大（每个校验器一个对象） | 极小，未使用的校验器可被 tree-shake |
| API 风格 | 链式方法，`.min()` `.max()` | 函数组合，`pipe()` |
| 错误信息配置 | 参数对象 `{ error }` | 校验器参数 |
| 生态集成 | 表单库、ORM、OpenAPI 生成器几乎都优先支持 | 集成在补齐，覆盖率低于 Zod |
| 类型推导 | `z.infer<typeof Schema>` | `v.InferOutput<typeof Schema>` |

**体积到底差多少**：Valibot 的核心包在 tree-shake 后通常比 Zod 小一个数量级。但这个优势只在你**把校验器打进客户端 bundle** 时才体现。本项目的校验只发生在 Server Action 和 Route Handler 里——`import 'server-only'` 之后，体积差异归零。

**该选 Valibot 的场景**：客户端实时校验、边缘函数、对首屏 JS 体积有硬指标的站点。

**B站短链接迁移 02 用的是 Valibot**（见 [`SOURCES.md`](../../SOURCES.md) 分集表第 23 集），那是个小工具项目，对体积敏感，选 Valibot 合理。本项目体量大、集成点多，选 Zod。

> Zod 4 起，错误信息的配置键从 `message` / `invalid_type_error` 统一为 `error`。看到旧教程里写 `z.string({ required_error: '必填' })` 的，那是 v3 写法。

## 认证：Auth.js 还是 Better Auth

**结论：本项目选 Better Auth。理由是「默认数据库会话」，它在 Server Action 里取会话的路径最短。**

先看两者在架构上的分野：

| | Auth.js (NextAuth) | Better Auth |
|---|---|---|
| 默认会话策略 | JWT（数据库会话需额外 adapter） | 数据库会话 |
| 配置位置 | `auth.ts` 里配置 providers 数组 | 单独的实例文件 + CLI 生成 schema |
| 会话读取 | `await auth()` | `await auth.api.getSession({ headers })` |
| 自带 UI | 无（`@auth/core` 只有逻辑） | 有 `better-auth-ui` 之类的社区组件 |
| 生态 | 极广，OAuth provider 覆盖最全 | 较新，核心 provider 齐全 |
| 与 Cache Components 的配合 | 会话读取需注意缓存边界 | 同 |

**为什么数据库会话在这个架构里更顺**：Server Action 是「可以被外部直接 POST 调用」的入口（见 [13 Server Actions](../02-rendering/13-server-actions.md)），每个 action 都要自己鉴权。数据库会话意味着 `session.user.id` 每次都是从数据库读出来的**当前事实**，而不是一个可能已经失效的 JWT。用户被禁用、角色被改、会话被吊销，下一次 action 调用立刻生效——不需要等 token 过期。

代价是**每个需要鉴权的请求多一次数据库往返**。这个代价可以用 `React.cache` 摊掉：同一次渲染里多次调用 `verifySession()` 只打一次库。

**该选 Auth.js 的场景**：

- 你需要一个**冷门 OAuth provider**。Auth.js 的 provider 覆盖是它的护城河。
- 你已经有一套 JWT 基础设施，想在 Next.js 里复用。
- 你的会话必须能**跨服务校验**（比如 Node 后端也要验同一个 token）。

**与 Cache Components 的冲突点（两个方案都有）**：会话读取依赖 `cookies()`，而 `'use cache'` 作用域里**不能**访问 `cookies()`。所以「把用户信息缓存起来」这条路是走不通的——必须在缓存边界外读出来，把具体的 `userId` 当参数传进去。详见 [44 Notes App D：认证与权限](./44-notes-app-auth.md)。

## UI：shadcn/ui 与其他

**结论：选 shadcn/ui。它的本质不是组件库，是「用 CLI 把组件源码复制进你的仓库」。**

这个定位差异决定了一切：

```bash
# 装一个组件
pnpm dlx shadcn@latest add button dialog input
```

跑完之后，`components/ui/button.tsx` 是**你项目里的一个普通文件**。你可以直接改它，不需要 `!important`、不需要主题变量覆盖、不需要等上游发版。

对比其他方案：

| 方案 | 定制方式 | 代价 |
|---|---|---|
| **shadcn/ui** | 直接改源码 | 上游修 bug 要手动同步 |
| MUI / Ant Design | 主题配置 + `sx` prop | 定制到一定程度必然和库的样式体系对抗 |
| Headless UI / Radix 裸用 | 自己写全部样式 | 工作量大 |
| 纯手写 | 无约束 | 无障碍、键盘导航要自己实现 |

shadcn/ui 底层就是 Radix（无障碍原语）+ Tailwind（样式），所以「无障碍 + 键盘导航」这些难做的部分已经解决了，剩下的是样式，而样式就在你的文件里。

**代价要说清楚**：组件源码进仓库意味着它**不会**跟着上游升级。上游修了一个焦点陷阱的 bug，你得自己去看 diff。这是有意的取舍——换来了「改样式不打架」。

**什么时候不该用它**：

- 项目需要**几十个复杂组件**（数据网格、富文本、甘特图）。这类组件的维护成本远超「复制源码」模式能承受的范围，用成熟库更划算。
- 团队完全不用 Tailwind。shadcn/ui 的样式全部是 Tailwind class，换 CSS 方案等于重写。

## 表单：React Hook Form 还是 Server Actions

**结论：默认用 Server Actions，React Hook Form 只在「高频交互表单」里用。**

这个决策的核心是**表单的状态归谁**。

Server Actions 的表单模型：

```tsx
// app/notes/new/form.tsx
'use client'

import { useActionState } from 'react'
import { createNote } from '@/app/actions/notes'

export function NoteForm() {
  const [state, formAction, pending] = useActionState(createNote, {})

  return (
    <form action={formAction}>
      <input name="title" required />
      {state.errors?.title && <p>{state.errors.title[0]}</p>}
      <button disabled={pending}>保存</button>
    </form>
  )
}
```

状态在**服务端**，客户端只持有最近一次的返回值。这带来两个白送的能力：JS 未加载时表单**仍然能提交**（渐进增强），以及校验逻辑只有一份（服务端）。

React Hook Form 的表单模型把状态放在**客户端**，用非受控输入 + 订阅来避免重渲染。它强在：

- **字段级即时校验**，不需要往返服务端。
- **复杂字段数组**（`useFieldArray`）的动态增删。
- **跨字段依赖校验**，比如「结束日期必须晚于开始日期」。

**判断标准**：

| 场景 | 选择 |
|---|---|
| 3–5 个字段的增删改 | Server Actions |
| 需要离线/极低延迟的字段级反馈 | React Hook Form |
| 字段数量动态、结构复杂 | React Hook Form |
| 需要渐进增强 | Server Actions |

两者也能叠加：用 React Hook Form 管客户端交互，提交时把 `FormData` 交给 Server Action 做**权威校验**。注意是「叠加」不是「二选一」——服务端校验永远不能省。

## 类型安全 API：为什么本项目不用 tRPC

**结论：单仓全栈的 Next.js 应用里，Server Actions 已经覆盖了 tRPC 的主要价值；tRPC 的适用边界在「客户端需要主动拉取」和「跨仓库共享类型」两处。**

tRPC 解决的核心问题是：**在没有代码生成的前提下，让客户端调用服务端函数时拥有端到端类型**。在 Next.js 里，Server Actions 原生就做到了这件事：

```ts
// app/actions/notes.ts
'use server'

export async function createNote(input: CreateNoteInput): Promise<Note> {
  // ...
}
```

```tsx
// 客户端组件里
const note = await createNote({ title: 'x' }) // 返回值类型是 Note
```

不需要 router、不需要 `useQuery`、不需要 provider。tRPC 多出来的那层「客户端缓存 + 失效管理」在 RSC 架构里被**服务端渲染和 `updateTag`** 替代了。

**该用 tRPC 的场景**：

1. **客户端需要主动、按需拉取**。比如一个搜索框，每次输入都要发请求；或者一个轮询刷新的面板。这类「不是由渲染触发的取数」用 Server Action 很别扭（Server Action 是 POST，且客户端一次只派发一个），Route Handler + tRPC 的查询语义更自然。
2. **多个客户端共享同一套 API**。同一份后端要被 Web、React Native、桌面端共用时，tRPC 的类型共享价值立刻体现——Server Actions 只服务于自己的 Next.js 应用。
3. **需要中间件式的横切逻辑**（日志、限流、鉴权）统一挂在 router 上。

**不该用的场景**：所有调用方都是你自己的 Next.js 页面和组件。这时 tRPC 引入的 router 定义、client provider、query key 管理都是纯开销。

详见 [52 工具箱](./52-toolbox-zod-rhf-shadcn-trpc.md)。

## 内容管线：为什么不用 Contentlayer

**结论：Contentlayer 已停止维护，本项目改用 `@next/mdx` 原生方案。**

Contentlayer 的思路是：写一个 `contentlayer.config.ts`，它扫描内容目录，为每种文档类型生成一个**类型化的 JSON 数据源**。用起来很舒服：

```ts
// 旧写法（Contentlayer）
import { allPosts } from 'contentlayer/generated'
```

但它的问题在于**它是一个夹在构建流程中间的第三方层**：它要 patch Next.js 的 webpack 配置、生成 `.contentlayer` 目录、和 Next.js 版本强耦合。Next.js 16 换用 Turbopack 作为默认打包器之后，这类深度介入构建的第三方方案需要重写自己的集成层——而项目已经停止维护，没有人来做这件事。

`@next/mdx` 是官方方案，走的是完全不同的路径：**MDX 文件在编译期被转成 React 组件**，frontmatter 用 MDX 的 `export` 语法（或 `gray-matter` 解析），文章列表用 `fs` 读目录。

```ts
// lib/posts.ts
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

export function getAllPosts() {
  const dir = path.join(process.cwd(), 'content')
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mdx'))
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8')
      const { data } = matter(raw)
      return { slug: file.replace(/\.mdx$/, ''), ...data }
    })
}
```

代价是你要自己写这几十行代码；收益是它**不介入构建配置**，Turbopack 换 webpack 都不影响它。详见 [47 Blog A：MDX 内容管线](./47-blog-mdx-pipeline.md)。

## 常见坑

- **现象**：照着一篇 2023 年的教程选型，装完发现 `middleware.ts` 不生效、`revalidateTag('posts')` 报类型错误。
  **原因**：绝大多数中文 Next.js 实战教程写于 13/14 时期，API 已经改名或改语义。
  **解法**：选型之前先过一遍 [`MIGRATION-16.md`](../../MIGRATION-16.md)，18 条对照里至少 5 条会命中实战项目。

- **现象**：给 Server Component 传了一个 ORM 返回的实体对象，构建时或运行时报序列化错误。
  **原因**：Prisma / Drizzle 返回的是**类实例**（或带方法的对象），不是纯对象。Cache Components 的序列化只接受普通对象、数组和几种内置类型。
  **解法**：在 DAL 里就把数据「拍平」成纯对象——这也正是 DTO 模式该做的事。见 [11 缓存模型](../02-rendering/11-cache-components.md) 的「序列化限制」一节。

- **现象**：把用户会话信息缓存起来，构建时超时，报 `Filling a cache during prerender timed out`。
  **原因**：`'use cache'` 作用域内不能访问 `cookies()` / `headers()`。会话本质上是请求期数据，天生不能进缓存。
  **解法**：在缓存边界**外面**读会话，把 `userId` 这类具体值当参数传进缓存函数。这个模式在 44 章会完整展开。

- **现象**：选了「体积最小」的校验库，结果发现表单库不兼容，只能自己写胶水层。
  **原因**：选型时只看了单一维度（体积），没看生态集成度。
  **解法**：Server 侧校验选集成最广的（Zod）；只有校验器真的要进客户端 bundle 时才为体积换 Valibot。

- **现象**：三个项目都想用同一套技术栈，结果 Blog 里为了评论系统引入了完整的 ORM + 认证，笔记里为了 SEO 引入了 MDX。
  **原因**：把「统一」当成了目标。三个项目的**技术栈应该统一，能力边界不应该统一**。
  **解法**：Blog 只需要一个轻量的评论表 + 匿名提交，不需要复刻 Notes App 的权限模型。SaaS 不需要 MDX。共用的是工具链（TS、Tailwind、校验库），不是业务模块。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 内容管线 | Contentlayer | **`@next/mdx` 原生方案** |
| 校验错误配置 | `z.string({ required_error: 'x' })` | **`z.string({ error: 'x' })`**（Zod 4） |
| 鉴权中间件 | `middleware.ts` | **`proxy.ts`** |
| 提交后失效 | `revalidateTag('notes')` | **`updateTag('notes')`** |
| 表单 hook | `useFormState`（react-dom） | **`useActionState`（react）** |
| 开启 PPR | `experimental.ppr: true` | **`cacheComponents: true`** |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 1、3、5 条。

## API / 配置速查

| 选型维度 | 本项目 | 一句话理由 |
|---|---|---|
| ORM | Prisma | 迁移工具链成熟，关系查询少写 join |
| 校验 | Zod | 生态集成最广，服务端场景体积不敏感 |
| 认证 | Better Auth | 默认数据库会话，吊销即时生效 |
| UI | shadcn/ui | 源码进仓库，改样式不对抗库 |
| 表单 | Server Actions | 渐进增强白送，校验只有一份 |
| API 层 | Route Handlers + Server Actions | 调用方只有自己的前端时不需要 tRPC |
| 内容 | `@next/mdx` | Contentlayer 已停止维护 |
| 测试 | Vitest + Playwright | 与 ESM 生态兼容 |

## 延伸阅读

- [官方文档：Data Security](https://nextjs.org/docs/app/guides/data-security)
- [官方文档：How to create forms with Server Actions](https://nextjs.org/docs/app/guides/forms)
- [官方文档：Authentication](https://nextjs.org/docs/app/guides/authentication)
- [官方文档：MDX](https://nextjs.org/docs/app/guides/mdx)
- [Prisma 官方文档](https://www.prisma.io/docs)
- [Drizzle ORM 官方文档](https://orm.drizzle.team/docs/overview)
- [Zod 官方文档](https://zod.dev/)
- [Valibot 官方文档](https://valibot.dev/)
- [Better Auth 官方文档](https://www.better-auth.com/docs/integrations/next)
- [Auth.js 官方文档](https://authjs.dev/getting-started/installation?framework=next.js)
- [shadcn/ui 官方文档](https://ui.shadcn.com/docs)
- [tRPC 官方文档](https://trpc.io/docs/)
