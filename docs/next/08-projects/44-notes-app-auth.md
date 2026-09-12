# 44 · Notes App D：认证与权限

> **一句话结论**：**Proxy 只做乐观重定向，真正的鉴权在 Server Action 和 DAL 里做**。Proxy 的检查是「给未登录用户一个好看的跳转」，不是安全边界——请求可以完全绕过你的 UI 直接打到 action 上。而授权（谁能改哪条笔记）必须写进数据库查询的 `where` 里，不能靠「先查出来再 if 判断」。

## 最小可运行示例

```ts
// lib/auth.ts
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { prisma } from '@/lib/db'

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  emailAndPassword: {
    enabled: true,
    // 开发期直接返回错误信息；生产环境接邮件服务
    requireEmailVerification: false,
  },

  session: {
    // 会话存在数据库里，吊销立刻生效
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },

  // nextCookies 必须是插件数组的最后一项
  plugins: [nextCookies()],
})

export type Session = typeof auth.$Infer.Session
```

```ts
// app/api/auth/[...all]/route.ts
import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth)
```

```ts
// lib/auth-client.ts
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient()
```

三行 route handler 就把注册、登录、登出、OAuth 回调、会话查询全部挂上了。这是选库而不是自己写的直接收益。

## 会话读取：一个只能服务端用的函数

会话读取要满足三个条件：**只能服务端调用、同一次渲染里只查一次、拿不到就跳登录**。

```ts
// lib/auth-server.ts
import 'server-only'

import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

// React.cache 保证同一次渲染里只调一次 auth.api.getSession。
// 页面组件、generateMetadata、DAL 里的调用会复用同一个结果
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})

/**
 * 拿不到会话就重定向到登录页。
 * 返回的 userId 是「可信来源」——它来自数据库会话，不来自任何客户端输入。
 */
export async function requireUserId(): Promise<string> {
  const session = await getSession()
  if (!session?.user) redirect('/sign-in')
  return session.user.id
}
```

`React.cache` 在这里不是优化，是**必需**：一个页面渲染里，`generateMetadata`、布局、页面组件、两三个 DAL 函数都会需要会话。没有 `cache`，每次都是「读 header → 查库」一轮往返。

> **注意 `cache` 的作用域**：它是**单次请求内**去重，不是跨请求缓存。会话本身绝不能跨请求缓存——那正是「用户 A 看到用户 B 的界面」这类事故的来源。

## 授权模型：谁能改哪条笔记

认证回答「你是谁」，授权回答「你能不能动这一条」。Notes App 的规则很简单：**笔记的 `authorId` 必须等于当前会话的 `userId`**。

规则简单，实现方式却有对错之分。

### 错误写法：先查再判断

```ts
// lib/dal/notes.ts —— 不要这样写
export async function updateNoteUnsafe(noteId: string, userId: string, data: NotePatch) {
  const note = await prisma.note.findUnique({ where: { id: noteId } })
  if (!note) return null

  // 这一行是唯一的防线。任何提前 return、任何异常捕获、
  // 任何后来加上的「管理员可以改」分支，都可能绕过它
  if (note.authorId !== userId) return null

  return prisma.note.update({ where: { id: noteId }, data })
}
```

这段代码**目前是对的**。它的问题在于防线是**一次运行时判断**，而不是一个不可绕过的结构。真实项目里它会怎么坏掉：

- 有人加了个「管理员可编辑」的旁路，条件写错。
- 有人为了加缓存，把 `findUnique` 的结果缓存了，判断用上了旧数据。
- 有人把 `return null` 改成了 `console.warn` 继续执行。

### 正确写法：归属写进 `where`

```ts
// lib/dal/notes.ts
import 'server-only'

import { prisma } from '@/lib/db'
import type { UpdateNoteInput } from '@/lib/validations/note'

export async function updateNote(
  noteId: string,
  authorId: string,
  data: UpdateNoteInput
) {
  // updateMany 支持复合 where，而且返回受影响行数。
  // 归属条件和不存在的判断合并成同一次数据库往返。
  const result = await prisma.note.updateMany({
    where: { id: noteId, authorId },
    data,
  })

  if (result.count === 0) return null

  return prisma.note.findFirst({
    where: { id: noteId, authorId },
    include: { tags: { include: { tag: true } } },
  })
}

export async function deleteNote(noteId: string, authorId: string) {
  const result = await prisma.note.deleteMany({
    where: { id: noteId, authorId },
  })
  return result.count > 0
}
```

关键点：

**用 `updateMany` / `deleteMany` 而不是 `update` / `delete`。** 后者的 `where` 只接受唯一标识，写不进 `authorId`。`updateMany` 接受任意 `where`，并且返回 `count`——`count === 0` 同时覆盖了「不存在」和「不属于你」两种情况。

**不要区分「不存在」和「无权访问」。** 页面层也返回同一个 404。区分这两者会把「这个 ID 是存在的，只是不属于你」这个信息泄露出去，攻击者可以用它枚举出系统里有多少条笔记。

### 多层资源的授权要往上追溯

笔记的标签是用户的，`tagIds` 也必须校验归属。直接信任表单里的 `tagIds` 会让用户把**别人的标签**挂到自己的笔记上：

```ts
// lib/dal/notes.ts
export async function createNote(authorId: string, data: CreateNoteData) {
  // 只保留确实属于这个用户的标签。客户端传了别的 ID 会被静默丢弃
  const ownedTags = await prisma.tag.findMany({
    where: { id: { in: data.tagIds }, ownerId: authorId },
    select: { id: true },
  })

  return prisma.note.create({
    data: {
      title: data.title,
      content: data.content,
      authorId,
      tags: { create: ownedTags.map((t) => ({ tagId: t.id })) },
    },
    include: { tags: { include: { tag: true } } },
  })
}
```

**这是最常见的越权漏洞形态**：主资源校验了归属，关联资源没有。schema 校验（Zod）检查的是 `tagIds` 是不是一组 cuid 字符串——它完全无法判断这些标签属不属于调用者。

## 双重校验：Proxy + Action

### Proxy：乐观重定向

```ts
// proxy.ts
import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

const PROTECTED = ['/notes']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )

  if (!isProtected) return NextResponse.next()

  // getSessionCookie 只检查 cookie 存不存在，不验证签名。
  // 它的价值是「未登录用户不用等页面渲染就能被弹走」，不是安全
  const sessionCookie = getSessionCookie(request)
  if (!sessionCookie) {
    const url = new URL('/sign-in', request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

`getSessionCookie` **不做任何验证**。任何人都能手动造一个同名 cookie 通过这一关。这是有意的——官方原文标注了 `THIS IS NOT SECURE!`，并推荐用它做「乐观重定向」。

**为什么 Proxy 里不查数据库。** Proxy 对**每一个匹配的请求**执行，包括 `Link` 的**预取请求**。用户把鼠标划过十个链接，就是十次 Proxy 调用。在里面查会话表，等于把数据库压力乘以预取次数。官方在 [16 Proxy](../03-routing-network/16-proxy.md) 里明确说了 Proxy 不应用于慢速数据获取，也不能作为完整的会话管理方案。

**Proxy 真正该做的事**：

| 该做 | 不该做 |
|---|---|
| 未登录用户快速跳转 | 完整会话验证 |
| 设置/透传请求头（如租户 ID） | 数据库查询 |
| A/B 分流、特性开关路由 | 授权判断 |

### Action：真正的鉴权

```ts
// app/actions/notes.ts
'use server'

import { requireUserId } from '@/lib/auth-server'
import { updateTag } from 'next/cache'
import * as notes from '@/lib/dal/notes'
import { updateNoteSchema } from '@/lib/validations/note'

export async function updateNote(
  noteId: string,
  _prev: { errors?: Record<string, string[]>; message?: string },
  formData: FormData
) {
  // 第一件事就是鉴权。不是「因为页面已经检查过了所以可以省」
  const userId = await requireUserId()

  const parsed = updateNoteSchema.safeParse({
    title: formData.get('title') ?? undefined,
    content: formData.get('content') ?? undefined,
  })
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  // 归属校验在 DAL 里，和写入是同一次数据库往返
  const updated = await notes.updateNote(noteId, userId, parsed.data)
  if (!updated) return { message: '笔记不存在或无权修改' }

  updateTag(`notes:${userId}`)
  updateTag(`note:${noteId}`)
  return {}
}
```

`noteId` 来自客户端（`bind` 或隐藏字段），**必须当作不可信输入**。但它「不可信」的方式和 `title` 不一样：

- `title` 不可信 → 要校验**形状**（长度、类型）→ Zod
- `noteId` 不可信 → 要校验**归属** → 写进 `where`

Zod 校验 `noteId` 是不是合法 cuid 只能拦住格式错误，拦不住「格式完全正确但不属于你」。

### 为什么两道都要

```
未登录用户点 /notes
  → Proxy 拦下，302 到 /sign-in        ← 用户体验，省一次页面渲染

攻击者直接 POST 到 action 端点
  → Proxy 拦下（没 cookie）             ← 拦得住这一种
  → 但如果他伪造了一个 cookie
    → Proxy 放行（它不验证签名）
    → requireUserId() 查数据库，拿到 null，redirect  ← 这里才真正拦住
```

两道防线的职责完全不同：Proxy 优化**性能与体验**，Action/DAL 保证**安全**。只做第一道 = 没有安全；只做第二道 = 未登录用户会看到一个渲染了一半才跳转的页面。

**还有一条**：页面组件里的检查（`if (!session) redirect('/login')`）也不是安全边界。它只决定渲染哪个 UI。layout 里的检查更不可靠——布局在客户端导航时不重渲染，而且布局**不能阻止子路由段渲染**，子路由会照常执行并出现在 RSC Payload 里。

## 授权模型速查

| 资源 | 规则 | 实现位置 |
|---|---|---|
| 笔记列表 | 只看自己的 | `where: { authorId }` |
| 笔记详情 | 只能看自己的 | `where: { id, authorId }` |
| 笔记更新/删除 | 只能改自己的 | `updateMany/deleteMany` + `count === 0` |
| 笔记的标签 | 只能挂自己的 | 先 `findMany({ where: { ownerId } })` 过滤 |
| 标签管理 | 只能改自己的 | `where: { id, ownerId }` |
| 全局统计 | 所有人可见 | 无需授权，但要确认不含敏感聚合 |

## 常见坑

- **现象**：在 Proxy 里 `await auth.api.getSession(...)` 查数据库，压测时数据库连接被打满。
  **原因**：Proxy 对每个请求（**包括 `Link` 的预取请求**）执行。用户划过十个链接 = 十次数据库查询。
  **解法**：Proxy 里只用 `getSessionCookie` 做存在性检查。完整会话验证放到页面、DAL 和 action 里。

- **现象**：`getSessionCookie` 通过了，但页面里 `getSession()` 返回 null，用户被反复重定向。
  **原因**：`getSessionCookie` 不验证签名，过期或伪造的 cookie 也能通过。或者自定义了 cookie 名/前缀，`getSessionCookie` 没配上。
  **解法**：这是预期行为——两道防线的结论本来就可能不同。如果 cookie 名被改过，给 `getSessionCookie(request, { cookieName, cookiePrefix })` 传对应配置。

- **现象**：用户能通过改表单里的 `tagIds`，把别人的标签挂到自己的笔记上。
  **原因**：主资源（笔记）校验了归属，**关联资源（标签）没校验**。Zod 只能验证格式。
  **解法**：所有来自客户端的 ID 都要经过「按当前用户过滤」这一步再使用。写一个通用的 `assertOwned(model, ids, userId)` 或直接在每个 DAL 函数里 `where: { ownerId }`。

- **现象**：在 layout 里做鉴权，结果未授权用户仍能看到部分内容。
  **原因**：布局**不能阻止子路由段渲染**。平行路由槽和子路由由路由器渲染，布局隐藏它们不影响它们执行，内容照样进 RSC Payload。
  **解法**：检查放在**离数据最近的地方**——DAL 里，或者需要条件渲染的那个组件里。

- **现象**：Better Auth 的 CLI 生成的 schema 和 41 章手写的 `User` 模型冲突，`prisma migrate` 想删掉已有字段。
  **原因**：Better Auth 需要 `User`、`Session`、`Account`、`Verification` 四张表，它会生成一套自己的 `User` 定义。
  **解法**：不要直接覆盖。把生成结果里的字段**合并进**已有的 `User` 模型（保留 `notes`、`tags` 关系），并给 `Session` / `Account` 加上指向现有 `User` 的外键。先在一个干净分支上跑迁移，确认生成的 SQL 里没有 `DROP COLUMN`。

- **现象**：在 Server Action 里调 `auth.api.signInEmail(...)`，登录成功但 cookie 没写进去。
  **原因**：Server Action 里不能用底层 API 直接写响应头，需要走 Next.js 的 `cookies()` 助手。
  **解法**：装 `nextCookies()` 插件并放在**插件数组最后一位**。它会在响应里有 `Set-Cookie` 时自动帮你写。

- **现象**：会话信息被 `'use cache'` 缓存后，A 用户看到了 B 用户的昵称。
  **原因**：`'use cache'` 是**服务端共享缓存**，缓存键里没有用户身份。缓存函数里也读不到 `cookies()`（会报 `next-request-in-use-cache`），所以有人把会话值「提」到了缓存边界外面当参数——但参数没进缓存键（比如传了对象、或漏传了）。
  **解法**：会话相关数据一律不缓存，或者用 `'use cache: private'`（只存浏览器）。见 [43 章](./43-notes-app-mutations-cache.md)。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 鉴权入口文件 | `middleware.ts`，导出 `middleware` | **`proxy.ts`，导出 `proxy`** |
| 鉴权判断位置 | 只在中间件里判断 | **Proxy 乐观重定向 + Action/DAL 真实鉴权** |
| 会话读取 | `getServerSession(authOptions)` | `auth.api.getSession({ headers: await headers() })` |
| 会话缓存 | 手动在模块作用域缓存 | **`React.cache`**（单请求内去重） |
| 越权防护 | 页面级 `if` 判断 | **`where` 里带 `authorId`** |
| 401/403 页面 | 手动 `redirect` | `unauthorized()` / `forbidden()`（**实验性**，需 `experimental.authInterrupts`） |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 1 条。

## API / 配置速查

| API | 签名 | 说明 |
|---|---|---|
| `betterAuth({ database, emailAndPassword, plugins })` | — | 创建实例；`nextCookies()` 必须放插件数组最后 |
| `toNextJsHandler(auth)` | `{ GET, POST }` | 挂到 `app/api/auth/[...all]/route.ts` |
| `auth.api.getSession({ headers })` | `Promise<Session \| null>` | 服务端读会话；`headers` 要 `await headers()` |
| `getSessionCookie(request)` | `string \| null` | **仅检查存在性，不验证**，用于 Proxy 乐观重定向 |
| `createAuthClient()` | client | 从 `better-auth/react` 导入 |
| `requireUserId()` | `Promise<string>` | 自定义：拿不到会话就 `redirect('/sign-in')` |
| `React.cache(fn)` | `(fn) => fn` | 单请求内去重，**不是跨请求缓存** |
| `updateMany({ where })` | `{ count: number }` | 归属校验写进 `where`，用 `count === 0` 判断失败 |
| `unauthorized()` / `forbidden()` | `() => never` | **实验性**，需 `experimental.authInterrupts: true` |

| 防线 | 位置 | 职责 | 能拦住什么 |
|---|---|---|---|
| 第一道 | `proxy.ts` | 乐观重定向 | 未登录用户的浏览器导航 |
| 第二道 | Server Action | 真实鉴权 | 所有直接调用（含伪造 cookie） |
| 第三道 | DAL 的 `where` | 归属校验 | 越权访问他人资源（IDOR） |

## 延伸阅读

- [官方文档：Authentication](https://nextjs.org/docs/app/guides/authentication)
- [官方文档：Data Security](https://nextjs.org/docs/app/guides/data-security)
- [官方文档：Authentication with Cache Components](https://nextjs.org/docs/app/guides/authentication-with-cache-components)
- [官方文档：Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [官方文档：`unauthorized`](https://nextjs.org/docs/app/api-reference/functions/unauthorized)
- [官方文档：`forbidden`](https://nextjs.org/docs/app/api-reference/functions/forbidden)
- [Better Auth：Next.js 集成](https://www.better-auth.com/docs/integrations/next)
- [Better Auth：会话管理](https://www.better-auth.com/docs/concepts/session-management)
- [Auth.js 官方文档](https://authjs.dev/getting-started/installation?framework=next.js)
- [React 文档：`cache`](https://react.dev/reference/react/cache)
