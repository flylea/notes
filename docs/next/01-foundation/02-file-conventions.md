# 02 · 文件约定全解

> **一句话结论**：`app/` 下只有 9 个文件名是框架约定——`page` / `layout` / `loading` / `error` / `global-error` / `not-found` / `template` / `route` / `default`，其余文件都是普通模块；这 9 个文件**渲染在哪一层由嵌套位置决定**，而 `params`、`searchParams` 从 16 起是 Promise，**必须 `await`**。

## 最小可运行示例

一个把所有约定文件都摆上、能直接跑的项目树：

```
app/
├─ layout.tsx           # 根布局（必需）
├─ template.tsx         # 每次导航重挂载
├─ loading.tsx          # 整站级 Suspense fallback
├─ error.tsx            # 整站级错误边界
├─ global-error.tsx     # 根布局自身抛错时的兜底
├─ not-found.tsx        # 404 UI
├─ page.tsx             # /
├─ dashboard/
│  ├─ layout.tsx
│  ├─ loading.tsx
│  ├─ error.tsx
│  ├─ not-found.tsx
│  └─ page.tsx          # /dashboard
└─ api/
   └─ health/
      └─ route.ts       # GET /api/health
```

```tsx
// app/layout.tsx
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
```

```tsx
// app/page.tsx
export default function Page() {
  return <h1>Home</h1>
}
```

```tsx
// app/loading.tsx
export default function Loading() {
  // loading 组件不接收任何 props
  return <p>Loading…</p>
}
```

```tsx
// app/error.tsx
'use client' // 错误边界必须是客户端组件

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <div>
      <h2>出错了</h2>
      <button onClick={() => retry()}>重试</button>
    </div>
  )
}
```

```tsx
// app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div>
      <h2>Not Found</h2>
      <Link href="/">回首页</Link>
    </div>
  )
}
```

```tsx
// app/dashboard/page.tsx
import { notFound } from 'next/navigation'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { tab } = await searchParams
  if (tab === 'unknown') notFound() // 触发同级的 not-found.tsx
  return <h1>Dashboard · {tab ?? 'overview'}</h1>
}
```

```ts
// app/api/health/route.ts
export async function GET() {
  return Response.json({ ok: true })
}
```

## 渲染层级：谁包谁

这 9 个文件不是并列关系，而是**层层嵌套**。同一个路由段里，从外到内的顺序是固定的：

```
layout.tsx              ← 最外层，跨导航保持
└─ template.tsx         ← 每次进入该段都重新挂载
   └─ error.tsx         ← React error boundary
      └─ loading.tsx    ← React Suspense boundary
         └─ not-found.tsx
            └─ page.tsx ← 最内层
```

三条容易记错的边界：

- `loading.tsx` **不**包裹同一层级的 `layout.tsx` / `template.tsx` / `error.tsx`。
- `error.tsx` **不**包裹它上面的 `layout.tsx` / `template.tsx`——所以布局自己抛错时，同级的 `error.tsx` 抓不到，得靠父级或 `global-error.tsx`。
- `template.tsx` 包住 `error.tsx`，但**不**包住同一段的 `layout.tsx`。

## 9 个约定文件各自什么时候触发

| 文件 | 渲染位置 | 触发条件 |
|---|---|---|
| `layout` | 段内最外层 | 该段被匹配时渲染一次，**跨导航不重新渲染** |
| `page` | 段内最内层 | 该段被匹配；`page` 存在该段才对外可访问 |
| `template` | `layout` 与 `error` 之间 | 每次该段（含其动态参数）变化时**重新挂载** |
| `loading` | Suspense 边界 | 该段内容在流式渲染中挂起时，立即显示 fallback |
| `error` | 错误边界 | 边界内的渲染抛错时；**必须是客户端组件** |
| `global-error` | 根布局的替代品 | 根布局/模板自身抛错时；需自带 `<html>` `<body>` |
| `not-found` | `loading` 与 `page` 之间 | 该段内调用 `notFound()`，或根级的 `app/not-found.tsx` 兜住所有未匹配 URL |
| `route` | — | 直接提供 HTTP 端点，**不参与 UI 渲染**，与 `page` 不能同段共存 |
| `default` | 平行路由槽位的 fallback | 硬导航（整页刷新）时槽位无法恢复活动状态 |

`route` 与 `page` 不能放在同一个文件夹：两者都会占用该段的 URL，属于路径冲突。

## `params` 与 `searchParams` 必须 `await`

16 起这两个 prop 都是 Promise。同步访问在 16 已经不可用（15 是"可用但已弃用"的过渡期）。

```tsx
// app/blog/[slug]/page.tsx
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { slug } = await params
  const { page = '1' } = await searchParams
  return <h1>{slug} · 第 {page} 页</h1>
}
```

客户端组件不能用 `async`，用 React 的 `use()` 解包：

```tsx
// app/blog/[slug]/post-header.tsx
'use client'

import { use } from 'react'

export default function PostHeader({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  return <h2>{slug}</h2>
}
```

**为什么改成 Promise**：服务端渲染要支持流式输出，框架希望"请求信息"能在组件树任意深度被异步读取，而不是在渲染前一次性解析好塞给每个组件。Promise 让 `params` 可以被传递、被 `use()` 挂起，从而只阻塞真正需要它的那棵子树。

`searchParams` 是 **Request-time API**：读它会把页面拖入动态渲染（请求时渲染）。`searchParams` 是普通对象，**不是** `URLSearchParams` 实例。

## 用生成的类型，别手写泛型

官方推荐 `PageProps` / `LayoutProps` / `RouteContext` 三个全局助手类型，它们由 `next dev`、`next build` 或 `next typegen` 生成，**不需要 import**：

```tsx
// app/blog/[slug]/page.tsx
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  return <h1>Blog post: {slug}</h1>
}
```

```tsx
// app/dashboard/layout.tsx
export default function Layout(props: LayoutProps<'/dashboard'>) {
  return (
    <section>
      {props.children}
      {/* 若存在 app/dashboard/@analytics，这里会多出类型化的 props.analytics */}
    </section>
  )
}
```

```ts
// app/api/posts/[id]/route.ts
export async function GET(request: Request, ctx: RouteContext<'/api/posts/[id]'>) {
  const { id } = await ctx.params
  return Response.json({ id })
}
```

```bash
# 终端：只生成类型，不跑完整构建
next typegen && tsc --noEmit
```

`next typegen` 从 v15.5.0 起提供，输出写到 `<distDir>/types`（开发环境是 `.next/dev/types`）。它解决的问题是：以前路由类型只在 `next dev` / `next build` 时生成，所以单独跑 `tsc --noEmit` 校验不了路由类型，CI 里想只做类型检查就必须先完整构建一次。

传字面量路由（如 `'/blog/[slug]'`）才有 `params` 的键名补全和严格校验；静态路由的 `params` 会解析成 `{}`。

## 命名与嵌套规则

- **文件夹定义 URL 段**，嵌套文件夹就是嵌套段。`app/blog/authors/page.tsx` → `/blog/authors`。
- **段只有存在 `page` 或 `route` 才对外可访问**。只有 `layout.tsx` 没有 `page.tsx` 的文件夹不会产生路由。
- **`page` 一定是路由子树的叶子**，不能有子路由。
- 动态段命名：`[slug]` 单段、`[...slug]` catch-all、`[[...slug]]` 可选 catch-all（见第 04 章）。
- 扩展名支持 `.js` `.jsx` `.tsx`（`route` 用 `.js` `.ts`）。**默认** Next.js 接受 `.tsx` `.ts` `.jsx` `.js`。

改扩展名白名单用 `pageExtensions`：

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
}
export default nextConfig
```

配上 MDX 时，`md`/`mdx` 就成了合法的约定文件扩展名——`app/about/page.mdx` 也是一条合法路由。

## 私有文件夹 `_folder` 与路由组 `(group)`

两者都**不进 URL**，但目的完全不同：

| | `_folder` | `(group)` |
|---|---|---|
| 作用 | 把文件**排除出路由**，当普通模块目录用 | 组织路由结构，**不影响 URL**，但会影响布局嵌套 |
| 典型场景 | `app/blog/_components/Post.tsx`、`app/blog/_lib/data.ts` | `app/(marketing)/`、`app/(shop)/` |
| 能否产生路由 | 不能，任何子文件都不参与路由 | 能，子目录照常产生路由 |
| 布局影响 | 无 | 可以在同一层级放多个不同的 `layout.tsx` |

`app/` 下的文件默认就是可以安全并置的，`_folder` 不是必需品。它的价值在于**避免和未来新增的文件约定撞名**，以及在编辑器里把"实现细节"和"路由"分开排序。

路由组的完整用法（多个根布局、把部分路由纳入共享布局、与平行/拦截路由的组合）见 [`05-route-groups-parallel-intercepting.md`](./05-route-groups-parallel-intercepting.md)。

> 想创建**以 `_` 开头**的 URL 段，用 URL 编码写法：`%5FfolderName`。

## 常见坑

- **现象**：页面里打印 `params` 得到 `Promise { <pending> }`，或 TS 报 `Property 'slug' does not exist on type 'Promise<...>'`。
  **原因**：16 起 `params` / `searchParams` 是 Promise，忘了 `await`（客户端组件忘了 `use()`）。
  **解法**：服务端 `const { slug } = await params`；客户端 `const { slug } = use(params)`。

- **现象**：`error.tsx` 报 "Error boundaries must be Client Components"。
  **原因**：错误边界本质是 React class 组件的能力，只能在客户端运行。
  **解法**：文件第一行加 `'use client'`。

- **现象**：`app/dashboard/layout.tsx` 里抛错，同级的 `app/dashboard/error.tsx` 没有任何反应。
  **原因**：`error.tsx` 包不住同级的 `layout.tsx`，它只包住 `loading` / `not-found` / `page` 和更深的嵌套布局。
  **解法**：把 `error.tsx` 上移一层，或加 `app/global-error.tsx` 兜住根布局的异常。

- **现象**：在 `layout.tsx` 里写 `searchParams`，永远是 `undefined`。
  **原因**：布局跨导航不重新渲染，拿到 `searchParams` 会立刻过期，所以框架**不给布局这个 prop**。
  **解法**：在 `page.tsx` 里读 `searchParams` 再往下传，或在客户端组件里用 `useSearchParams()`。

- **现象**：`PageProps<'/blog/[slug]'>` 报 "Cannot find name 'PageProps'"。
  **原因**：这些助手类型是**生成物**，`next dev` / `next build` / `next typegen` 没跑过就不存在。
  **解法**：先跑一次 `next typegen`（或 `next dev`），并确认 `next-env.d.ts` 被 `tsconfig.json` 包含、没被手动删掉。

- **现象**：改了 `pageExtensions` 加了 `mdx` 之后，原来的路由突然少了几条。
  **原因**：`pageExtensions` 是**白名单覆盖**而不是追加，没列进去的扩展名会被整体排除。
  **解法**：把默认的 `js` / `jsx` / `ts` / `tsx` 一起写全。

- **现象**：`app/foo/page.tsx` 和 `app/foo/route.ts` 同时存在，报路径冲突。
  **原因**：`page` 和 `route` 都会占用 `/foo` 这个 URL 段，语义冲突。
  **解法**：拆成两个段，比如 `app/foo/page.tsx` 与 `app/api/foo/route.ts`。

## 旧写法 vs 新写法

| 场景 | 旧（13/14） | 新（16.3） |
|---|---|---|
| 读 `params` | `params.slug` 同步访问 | **`await params`**，类型为 `Promise<...>` |
| 读 `searchParams` | `searchParams.page` 同步访问 | **`await searchParams`** |
| props 类型 | 手写 `{ params: { slug: string } }` | **`PageProps<'/blog/[slug]'>`** 等生成类型 |
| 类型生成时机 | 只能靠 `next dev` / `next build` | 可单独跑 **`next typegen`** |
| 平行路由槽位 | `default.js` 可省略 | **必须显式提供**（见第 05 章） |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7、11 条。

## API / 配置速查

| 文件 | 必需 | Props | 关键约束 |
|---|---|---|---|
| `layout` | 根布局必需 | `children`、`params`(Promise)、命名槽位 | 根布局必须含 `<html>`、`<body>` |
| `page` | — | `params`、`searchParams`（均 Promise） | 路由子树的叶子 |
| `template` | — | `children` | 每次导航重新挂载 |
| `loading` | — | **无** | 只是 Suspense fallback，不接收参数 |
| `error` | — | `error`、`retry`、`reset` | 必须 `'use client'` |
| `global-error` | — | `error`、`retry`、`reset` | 必须 `'use client'`，自带 `<html>` `<body>` |
| `not-found` | — | **无** | 默认是服务端组件，可 `async` |
| `route` | — | `(request, ctx)` | 支持 `GET`/`POST`/`PUT`/`PATCH`/`DELETE`/`HEAD`/`OPTIONS` |
| `default` | — | `params`(Promise) | 平行路由槽位的 fallback |

| 配置 / 命令 | 值 | 说明 |
|---|---|---|
| `pageExtensions` | `['tsx','ts','jsx','js']` | 覆盖式白名单，不是追加 |
| `next typegen [directory]` | — | 只生成路由类型，不构建 |
| 类型输出目录 | `<distDir>/types` | dev 下是 `.next/dev/types` |

## 延伸阅读

- [官方文档：Project Structure](https://nextjs.org/docs/app/getting-started/project-structure)
- [官方文档：page.js](https://nextjs.org/docs/app/api-reference/file-conventions/page)
- [官方文档：layout.js](https://nextjs.org/docs/app/api-reference/file-conventions/layout)
- [官方文档：loading.js](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
- [官方文档：error.js](https://nextjs.org/docs/app/api-reference/file-conventions/error)
- [官方文档：not-found.js](https://nextjs.org/docs/app/api-reference/file-conventions/not-found)
- [官方文档：template.js](https://nextjs.org/docs/app/api-reference/file-conventions/template)
- [官方文档：route.js](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [官方文档：default.js](https://nextjs.org/docs/app/api-reference/file-conventions/default)
- [官方文档：pageExtensions](https://nextjs.org/docs/app/api-reference/config/next-config-js/pageExtensions)
- [官方文档：next CLI（next typegen）](https://nextjs.org/docs/app/api-reference/cli/next)
