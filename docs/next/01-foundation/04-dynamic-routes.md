# 04 · 动态路由

> **一句话结论**：`[slug]` 匹配一层、`[...slug]` 匹配一层或更多、`[[...slug]]` 连"零层"都匹配；三者都把值塞进 `params`——16 里 `params` 是 **Promise**，`page` / `layout` / `route` 都必须 `await`，只是类型来源不同（`PageProps` / `LayoutProps` / `RouteContext`）；想让动态段在构建时就变成静态页面，用 `generateStaticParams`，再用 `dynamicParams` 决定没生成的路径是"首次访问时生成"还是"直接 404"。

## 最小可运行示例

```tsx
// app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation'

type Post = { slug: string; title: string; content: string }

async function getPost(slug: string): Promise<Post | null> {
  const posts: Post[] = [
    { slug: 'hello', title: 'Hello', content: '第一篇' },
    { slug: 'world', title: 'World', content: '第二篇' },
  ]
  return posts.find((p) => p.slug === slug) ?? null
}

export async function generateStaticParams() {
  // 返回值决定构建时预渲染哪些 slug
  return [{ slug: 'hello' }, { slug: 'world' }]
}

export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  const post = await getPost(slug)
  if (!post) notFound()

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  )
}
```

访问 `/blog/hello`、`/blog/world` 走构建时生成的静态页面。

## 三种动态段

| 约定 | 名字 | 匹配 |
|---|---|---|
| `[folder]` | 动态段 | 只匹配**一层** |
| `[...folder]` | catch-all 段 | 匹配**一层或更多层** |
| `[[folder]]` | 可选 catch-all 段 | 匹配**零层、一层或更多层** |

`app/shop/[...slug]` 能匹配 `/shop/a`、`/shop/a/b`、`/shop/a/b/c`；`app/shop/[[...slug]]` 除此之外还匹配 `/shop` 本身。

`params` 的形状随之不同：

| 路由 | URL | `params` |
|---|---|---|
| `app/blog/[slug]/page.tsx` | `/blog/a` | `{ slug: 'a' }` |
| `app/shop/[...slug]/page.tsx` | `/shop/a` | `{ slug: ['a'] }` |
| `app/shop/[...slug]/page.tsx` | `/shop/a/b` | `{ slug: ['a', 'b'] }` |
| `app/shop/[[...slug]]/page.tsx` | `/shop` | `{ slug: undefined }` |
| `app/shop/[[...slug]]/page.tsx` | `/shop/a/b` | `{ slug: ['a', 'b'] }` |

TypeScript 侧的类型：

| 路由 | `params` 类型 |
|---|---|
| `app/blog/[slug]/page.tsx` | `{ slug: string }` |
| `app/shop/[...slug]/page.tsx` | `{ slug: string[] }` |
| `app/shop/[[...slug]]/page.tsx` | `{ slug?: string[] }` |
| `app/[categoryId]/[itemId]/page.tsx` | `{ categoryId: string; itemId: string }` |

注意可选 catch-all 的类型是 **`slug?: string[]`**，访问时一定要判空：

```tsx
// app/docs/[[...slug]]/page.tsx
export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const { slug } = await props.params
  const segments = slug ?? [] // /docs 时 slug 是 undefined
  return <h1>{segments.length === 0 ? '文档首页' : segments.join(' / ')}</h1>
}
```

**为什么要有可选 catch-all**：`[...slug]` 匹配不了"父路径本身"。文档站的 `/docs` 和 `/docs/getting-started/routing` 想用同一套布局和渲染逻辑，就必须用 `[[...slug]]` 把零层的情况也吃进来，否则得额外写一个 `app/docs/page.tsx`。

## `generateStaticParams`

在构建时把动态段展开成具体的静态页面。

### 基本用法与返回类型

```tsx
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await fetch('https://api.example.com/posts').then((res) => res.json())
  return posts.map((post: { slug: string }) => ({ slug: post.slug }))
}
```

返回值必须是**对象数组**，每个对象代表一组要填充的动态段。返回类型对照：

| 路由 | 返回类型 |
|---|---|
| `/product/[id]` | `{ id: string }[]` |
| `/products/[category]/[product]` | `{ category: string; product: string }[]` |
| `/products/[...slug]` | `{ slug: string[] }[]` |

**必须返回数组，即使是空数组。** 函数返回 `undefined` 会让该路由退回动态渲染。

`generateStaticParams` 里的 `fetch` 会被**自动去重**，同一份数据不会重复请求，这也是它能在构建阶段跑得快的原因。

### 作用范围：只能为"当前段及以上"生成

以 `app/products/[category]/[product]/` 为例：

- `app/products/[category]/[product]/page.tsx` 的 `generateStaticParams` 可以同时生成 `[category]` 和 `[product]`。
- `app/products/[category]/layout.tsx` 的 `generateStaticParams` **只能**生成 `[category]`——它看不到下面的段。

于是有两种写法。**自底向上**一次生成两层：

```tsx
// app/products/[category]/[product]/page.tsx
export async function generateStaticParams() {
  const products = await fetch('https://api.example.com/products').then((res) => res.json())
  return products.map((p: { category: { slug: string }; id: string }) => ({
    category: p.category.slug,
    product: p.id,
  }))
}
```

**自顶向下**由父级先定 category，子级再按 category 展开：

```tsx
// app/products/[category]/layout.tsx
export async function generateStaticParams() {
  const products = await fetch('https://api.example.com/products').then((res) => res.json())
  return products.map((p: { category: { slug: string } }) => ({ category: p.category.slug }))
}
```

```tsx
// app/products/[category]/[product]/page.tsx
export async function generateStaticParams({
  params: { category },
}: {
  params: Awaited<LayoutProps<'/products/[category]'>['params']>
}) {
  const products = await fetch(`https://api.example.com/products?category=${category}`).then(
    (res) => res.json()
  )
  return products.map((p: { id: string }) => ({ product: p.id }))
}
```

**关键点**：`generateStaticParams` 自己的 `params` 参数是**同步**的，只包含父级段的参数——**不要 `await` 它**。子级的 `generateStaticParams` 会针对父级生成的**每一组 params 各执行一次**。

### 构建 / 开发 / ISR 时的行为

| 时机 | 行为 |
|---|---|
| `next build` | 在对应的 layout / page 生成**之前**运行 |
| `next dev` | 导航到该路由时调用 |
| 重新验证（ISR） | **不会再次调用** |

想让"运行时渲染全部路径"，返回空数组，或者用 `export const dynamic = 'force-static'`：

```tsx
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  return [] // 构建时不预渲染任何路径
}
```

### 与 Cache Components 的冲突点

开启 Cache Components 后，动态路由的 `generateStaticParams` **必须返回至少一个 param**，返回空数组会导致**构建错误**。这是有意的：框架需要至少一个具体的 param 来验证这条路由不会在运行时非法访问 `cookies()`、`headers()` 或 `searchParams`。

构建时确实拿不到真实值时，可以返回占位 param 再在页面里 `notFound()`：

```tsx
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  return [{ slug: '__placeholder__' }]
}
```

代价是构建期校验的效果被削弱，且可能引入运行时错误——能拿到真实数据就别这么写。

## `dynamicParams`：没生成的路径怎么办

`dynamicParams` 是路由段配置项，**默认 `true`**：访问未被 `generateStaticParams` 覆盖的动态段时，在**首次请求时**渲染，并把结果存下来供后续请求复用。

设成 `false` 就变成严格白名单：只有 `generateStaticParams` 返回的路径能被服务，其余返回 404。

```tsx
// app/blog/[slug]/page.tsx
export const dynamicParams = false

export async function generateStaticParams() {
  const posts = await fetch('https://api.example.com/posts').then((res) => res.json())
  // 只预渲染前 10 篇，其余全部 404
  return posts.slice(0, 10).map((post: { slug: string }) => ({ slug: post.slug }))
}
```

这组配置的典型用法是"已知的内容集合 + 内容变更需要重新部署"：比如官网的文档页，发布流程本身就带构建，那 `dynamicParams = false` 能把"拼错的 URL"直接挡成 404，而不是白白触发一次渲染。

> **16 的注意点**：启用 Cache Components 后，`dynamic`、`dynamicParams`、`revalidate`、`fetchCache` 这几个段配置项**会被移除**，缓存语义统一交给 `"use cache"` 与 `cacheLife` 控制。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 3 条。

## 异步 `params` 在 page / layout / route 里的写法差异

三处都要 `await`，区别只在**类型从哪来**：

```tsx
// app/blog/[slug]/page.tsx
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params // Promise<{ slug: string }>
  return <h1>{slug}</h1>
}
```

```tsx
// app/dashboard/[team]/layout.tsx
export default async function Layout(props: LayoutProps<'/dashboard/[team]'>) {
  const { team } = await props.params // Promise<{ team: string }>
  return (
    <section>
      <h2>{team}</h2>
      {props.children}
    </section>
  )
}
```

```ts
// app/api/posts/[id]/route.ts
export async function GET(request: Request, ctx: RouteContext<'/api/posts/[id]'>) {
  const { id } = await ctx.params // Promise<{ id: string }>
  const post = await fetch(`https://api.example.com/posts/${id}`).then((res) => res.json())
  return Response.json(post)
}
```

| 位置 | 类型助手 | `params` 出现在 |
|---|---|---|
| `page.tsx` | `PageProps<'/route'>` | props 上，与 `searchParams` 同级 |
| `layout.tsx` | `LayoutProps<'/route'>` | props 上，与 `children` 同级 |
| `route.ts` | `RouteContext<'/route'>` | 第二个参数 `ctx` 上 |

`route.ts` 还支持 `generateStaticParams`，让某些 id 在构建时静态化：

```ts
// app/api/posts/[id]/route.ts
export async function generateStaticParams() {
  return [{ id: '1' }, { id: '2' }]
}
```

客户端组件不能 `async`，用 React 的 `use()` 解包；也可以在客户端组件树任意位置用 `useParams()`：

```tsx
// app/blog/[slug]/post-title.tsx
'use client'

import { use } from 'react'

export default function PostTitle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  return <h2>{slug}</h2>
}
```

## 常见坑

- **现象**：`app/docs/[[...slug]]/page.tsx` 里 `slug.map(...)` 报 "Cannot read properties of undefined"。
  **原因**：可选 catch-all 在"零层"时 `params.slug` 是 `undefined`，类型上也是可选的（`slug?: string[]`）。
  **解法**：先归一化：`const segments = slug ?? []`。

- **现象**：`generateStaticParams` 写了，但 `next build` 的输出里这条路由仍然是动态的（ƒ）。
  **原因**：函数没有 return 数组，或返回了 `undefined`；也可能被 `dynamicParams` / 段配置覆盖了。
  **解法**：确保每条路径都 return 数组；确认没有误加 `export const dynamic = 'force-dynamic'` 之类的配置。

- **现象**：设置 `dynamicParams = false` 后，新增的内容访问就 404。
  **原因**：这就是它的语义——白名单之外一律 404。
  **解法**：如果内容会动态增长，保持默认的 `true`（首次访问时生成），或改回 `true` 并靠缓存策略控制成本。

- **现象**：在 `app/dashboard/[team]/layout.tsx` 顶层 `await params`，导航变慢、布局无法被预渲染。
  **原因**：布局在顶层 `await params` 会阻塞整棵子树的预渲染。
  **解法**：把 `params` 这个 Promise **往下传**，只在真正需要它的子组件里 `await`（或 `use()`）。

- **现象**：`generateStaticParams({ params: { category } })` 里写了 `await params`，类型报错。
  **原因**：这个 `params` 参数是**同步对象**，只含父级段的值，不是 Promise。
  **解法**：直接解构：`{ params: { category } }`。

- **现象**：开启 Cache Components 后，某个动态路由的构建报错，提示 `generateStaticParams` 需要至少一个参数。
  **原因**：Cache Components 下空数组不被接受，框架需要具体 param 来做构建期校验。
  **解法**：返回真实的 param 列表；实在拿不到就返回占位 param（如 `[{ slug: '__placeholder__' }]`）并在页面里 `notFound()`，但要清楚这削弱了校验。

- **现象**：`/blog/[slug]` 里拼错的 slug 触发了 `notFound()`，但返回的 HTTP 状态码是 200。
  **原因**：响应体已经开始流式传输（`loading.tsx` 或某个 Suspense 边界先渲染了 fallback），响应头早已发出，状态码无法再改。
  **解法**：需要真实 404 状态码时，把 `notFound()` 放在**任何可能挂起的 `await` 和 Suspense 边界之前**；流式场景下框架会自动注入 `<meta name="robots" content="noindex">` 避免被索引。

## 旧写法 vs 新写法

| 场景 | 旧（13/14） | 新（16.3） |
|---|---|---|
| 读 `params` | `params.slug` 同步访问 | **`await params`** |
| props 类型 | 手写 `{ params: { slug: string } }` | **`PageProps<'/blog/[slug]'>`** 等生成类型 |
| Route Handler 的 `params` | 第二个参数上同步对象 | **`RouteContext<'/route'>`** + `await ctx.params` |
| 静态路径生成 | Pages Router 的 `getStaticPaths` | App Router 的 **`generateStaticParams`** |
| 动态渲染开关 | `dynamic = 'force-dynamic'` | 优先用 **`connection()`**；开 Cache Components 后段配置项被移除 |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 3、7 条。

## API / 配置速查

| 约定 | 匹配层数 | `params` 类型 |
|---|---|---|
| `[slug]` | 恰好 1 层 | `string` |
| `[...slug]` | ≥ 1 层 | `string[]` |
| `[[...slug]]` | ≥ 0 层 | `string[] \| undefined` |

| `generateStaticParams` | 说明 |
|---|---|
| 返回类型 | `Array<Record<string, string \| string[]>>` |
| `options.params` | **同步**对象，仅含父级段参数 |
| 执行时机 | `next build` 时先于 layout/page 生成；`next dev` 时按导航调用；ISR 时不调用 |
| 返回空数组 | 构建时不预渲染任何路径 |
| Cache Components 下 | 必须返回**至少一个** param，空数组报构建错误 |

| 路由段配置 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `dynamicParams` | `boolean` | **`true`** | `false` 时只服务 `generateStaticParams` 返回的路径，其余 404 |
| `dynamic` | `'auto' \| 'force-dynamic' \| 'force-static' \| 'error'` | `'auto'` | 启用 Cache Components 后**被移除** |
| `revalidate` | `false \| 0 \| number` | `false` | 启用 Cache Components 后**被移除** |
| `fetchCache` | 字符串 | `'auto'` | 启用 Cache Components 后**被移除** |

## 延伸阅读

- [官方文档：Dynamic Segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes)
- [官方文档：generateStaticParams](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)
- [官方文档：Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)
- [官方文档：page.js](https://nextjs.org/docs/app/api-reference/file-conventions/page)
- [官方文档：layout.js](https://nextjs.org/docs/app/api-reference/file-conventions/layout)
- [官方文档：route.js](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [官方文档：notFound 函数](https://nextjs.org/docs/app/api-reference/functions/not-found)
- [官方文档：useParams](https://nextjs.org/docs/app/api-reference/functions/use-params)
