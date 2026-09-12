# 12 · 重新验证

> **一句话结论**：`revalidateTag(tag, profile)` 现在**需要第二个参数**，推荐 `'max'`；单参数形式已弃用，行为等同 `{ expire: 0 }`。选哪个 API 有个口诀：**自己写的自己立刻要看到 → `updateTag`；给所有人下次请求失效 → `revalidateTag`；只重跑动态数据 → `refresh`**。还有一条最容易误解的认知：失效的触发者是**请求**，不是 `revalidateTag` 那次调用。

## 最小可运行示例

```ts
// app/lib/actions.ts
'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  const post = await db.post.create({
    data: {
      title: String(formData.get('title')),
      content: String(formData.get('content')),
    },
  })

  // 当前用户立刻要看到自己刚写的内容
  updateTag('posts')
  updateTag(`post-${post.id}`)

  redirect(`/posts/${post.id}`)
}
```

```ts
// app/lib/data.ts
import { cacheLife, cacheTag } from 'next/cache'

export async function getPosts() {
  'use cache'
  cacheLife('hours')
  cacheTag('posts')

  return db.query('SELECT * FROM posts')
}
```

`cacheTag('posts')` 打标，`updateTag('posts')` 失效——两边用同一个字符串串起来。

## 两种失效策略

| 策略 | 触发方式 | 机制 |
|---|---|---|
| **基于时间** | `cacheLife(profile)` | stale-while-revalidate：先返回缓存内容，同时后台重建 |
| **按需** | `revalidateTag` / `updateTag` / `revalidatePath` | 显式标记失效，下次请求触发重建 |

两者不互斥，经常配合使用：一个只在作者编辑时变化的博客文章，用 `cacheLife('max')` + `cacheTag`，保存时按需失效；一个全天持续更新的最新文章列表，用 `cacheLife('hours')` 自己定时刷新，不需要手动失效。

## `revalidateTag`：给所有人下次请求失效

```ts
// app/lib/actions.ts
import { revalidateTag } from 'next/cache'

export async function updateUser(id: string) {
  // 变更数据
  revalidateTag('user', 'max') // 推荐：stale-while-revalidate
}
```

`revalidateTag` 用 stale-while-revalidate 语义按标签失效——**陈旧内容立刻返回，新内容在后台加载**。适合"稍微延迟一点更新可以接受"的内容，比如博客文章、商品目录。

它可以在 **Server Functions 和 Route Handlers** 里调用，不能在客户端组件或 Proxy 里调用（只在服务端环境可用）。

### 签名与第二个参数

```ts
revalidateTag(tag: string, profile: string | { expire?: number }): void
```

- **`tag`**：缓存标签字符串。**区分大小写**，长度不得超过 256 字符。超过限制的 tag 永远不会被赋给缓存数据，所以失效它什么也不会发生——这是个静默失败，要留意。
- **`profile`**：陈旧内容可以被提供多久。推荐值 `'max'`。也可以传 `cacheLife` 里定义的任何其他内置或自定义 profile（**只读取它的 `expire`**），或者一个带 `expire` 属性的对象（单位秒）。

各取值的实际行为：

| 第二个参数 | 行为 |
|---|---|
| **`'max'`（推荐）** | 一年窗口，长到足以保证请求总是先拿到陈旧内容、同时后台重建 |
| 其他 profile 或对象 | 用不同的窗口；只读 `expire` |
| `{ expire: 0 }` | **从不提供陈旧内容**，下一个请求阻塞等待重新验证/缓存未命中。调用方需要数据立刻消失、又不能用 `updateTag` 时用这个 |
| **省略（已弃用）** | 行为等同 `{ expire: 0 }` |

第二个参数设定的是**"超过哪个点之后，数据正确性比速度更重要"**。

```ts
revalidateTag('blog-posts', 'max')          // 推荐
revalidateTag('analytics', 'days')
revalidateTag('products', { expire: 3600 }) // 也接受对象形式
revalidateTag('blog-posts')                 // ⚠️ 已弃用
```

**单参数形式的准确说法是"已弃用 + 行为退化"**，不是"立刻不能用"：它在 TypeScript 下会报错；如果你压制了类型错误，它**仍然可用**，但等同于 `{ expire: 0 }`——立即过期、不走 SWR。官方标注未来版本可能移除。

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 5 条。

### 标签是怎么打上去的

两种方式：

```ts
// 方式一：fetch 的 next.tags
fetch(url, { next: { tags: ['posts'] } })
```

```ts
// 方式二：'use cache' 作用域内的 cacheTag
import { cacheTag } from 'next/cache'

async function getData() {
  'use cache'
  cacheTag('posts')
  // ...
}
```

同一个标签可以在多个函数里复用，一次失效全部生效。

### 触发者是「请求」，不是「调用」

这是最容易误解的一点：

> 一次重新验证是被**请求**触发的，不是被 `revalidateTag` 那次调用触发的。

`revalidateTag` 做的事是**标记**——把带这个标签的缓存数据标成陈旧。真正重建发生在下一次有人请求这些数据的时候。所以用了这个标签的页面是**在被访问时**逐个重新验证，而不是全部一次性重建。

这个设计有明确的好处：一次内容更新不会引发所有相关页面的构建风暴，重建成本被摊到实际流量上。代价是"我调了 `revalidateTag` 但页面还是旧的"——因为还没人访问过那个页面。

还有一条相关的集成细节：`revalidateTag` 配 stale-while-revalidate profile 时，**不会在 Server Action 的响应里带一次重新渲染**。页面要等到之后某次读取才反映变化。

## `updateTag`：read-your-writes

`updateTag` **立刻让指定标签的缓存数据过期**。下一个请求会**等待**取到新数据，而不是提供陈旧内容——所以用户立刻看到自己的变更。完整用法见本章开头的 `app/lib/actions.ts` 示例。

它**只能**在 **Server Actions** 里调用。Route Handlers、客户端组件、任何其他上下文都会抛错：

```ts
// app/api/posts/route.ts
import { revalidateTag, updateTag } from 'next/cache'

export async function POST() {
  // 这会抛错
  updateTag('posts')
  // Error: updateTag can only be called from within a Server Action

  // Route Handler 里用 revalidateTag
  revalidateTag('posts', 'max')
}
```

签名很简单：

```ts
updateTag(tag: string): void
```

`tag` 同样区分大小写、不超过 256 字符。

### `updateTag` 与 `revalidateTag` 对比

| | `updateTag` | `revalidateTag` |
|---|---|---|
| **能用的地方** | 仅 Server Actions | Server Actions 和 Route Handlers |
| **行为** | 立刻过期，下一个请求等新数据 | stale-while-revalidate，先给陈旧的 |
| **适用场景** | read-your-own-writes（用户看到自己的变更） | 后台刷新（稍有延迟可接受） |
| **无 profile 时** | — | 遗留行为，等价于 `updateTag` |

## `refresh`：只刷新未缓存的数据

```ts
// app/actions.ts
'use server'

import { refresh } from 'next/cache'

export async function createPost(formData: FormData) {
  await db.post.create({ data: { title: String(formData.get('title')) } })
  refresh()
}
```

`refresh` 从 Server Action 里**刷新客户端路由**，让 UI 反映最新状态。它**不会重新验证打过标签的数据**，签名是 `refresh(): void`，同样**只能**在 Server Actions 里调用。它的定位是：视图依赖了缓存之外、刚刚被这个 action 改变的状态——典型场景是页面里有未缓存的动态部分需要重新执行。

## 三个 API 的选择口诀

```
自己写的，自己立刻要看到        → updateTag(tag)
给所有人下次请求时失效          → revalidateTag(tag, 'max')
只重跑动态数据，不动缓存        → refresh()
只想按路径失效，不想管标签      → revalidatePath(path)
```

再补一张速查表：

| API | 在哪里用 | 是否立刻重渲染当前路由 | 陈旧内容会被提供吗 |
|---|---|---|---|
| `updateTag` | 仅 Server Actions | **是** | 否 |
| `revalidateTag` + profile | Server Actions、Route Handlers | **否**（有意跳过） | 是 |
| `revalidateTag` + `{ expire: 0 }` | Server Actions、Route Handlers | 否 | 否，下一请求阻塞 |
| `revalidatePath` | Server Actions、Route Handlers | **是** | 否 |
| `refresh` | 仅 Server Actions | **是** | 不涉及缓存 |

"是否立刻重渲染当前路由"这一列很重要：`updateTag`、`revalidatePath`、`refresh` 执行时，Next.js 会在服务端重新渲染当前路由，并把新渲染的 RSC Payload **放进 action 的响应里**，所以页面在同一次往返里就反映了变化。`revalidateTag` 配 SWR profile 是有意跳过这次立即重渲染的。

和 `redirect` 不同，这三个 API 都**不抛异常**，所以 action 调用它们之后仍然可以正常返回值。

## `revalidatePath` 与 tag 的分工

```ts
// app/lib/actions.ts
import { revalidatePath } from 'next/cache'

export async function updateUser(id: string) {
  // 变更数据
  revalidatePath('/profile')
}
```

`revalidatePath` 按**路由路径**失效该路径下的所有缓存数据，用于"想重新验证某个路由、但不知道它关联了哪些标签"的情况。

**优先用标签而不是路径**——标签更精确，能避免过度失效。

两者的分工：

| | `revalidateTag` | `revalidatePath` |
|---|---|---|
| 失效范围 | 所有使用该标签的页面 | 特定页面或布局路径 |
| 精确度 | 高，只动相关数据 | 低，整条路径一起失效 |
| 适用时机 | 知道数据对应的标签 | 不知道标签，或想按页面粒度处理 |

两者可能需要配合使用才能达到完整的数据一致性。

### `revalidatePath` 背后的软标签

`revalidatePath` 能工作，是因为 Next.js 有一套**软标签（soft tags）**机制。软标签由框架根据路由路径自动生成，前缀是 `_N_T_`。

路由 `/blog/hello` 会生成这些软标签：

```
_N_T_/layout
_N_T_/blog/layout
_N_T_/blog/hello/layout
_N_T_/blog/hello
```

路径里**每个段**都有一个 layout 标签，再加上叶子路由本身。

调 `revalidatePath('/blog/hello')` 时，它会通过同一套标签系统失效那个路径的叶子路由标签以及所有祖先布局的软标签。理解这一点有助于解释"为什么我失效 `/blog/hello`，`/blog` 上的内容也变了"——因为祖先布局的软标签被一起失效了。

自己用 `cacheTag` 打的标签叫**显式标签（explicit tags）**，和软标签是两类。

## ISR 的工作原理与 stale-while-revalidate

Cache Components 下的 ISR 和旧的 ISR 是同一个思路，但组成方式不同。

构建时，PPR 把每次渲染拆成两部分：

- **App Shell**：页面里与 URL 数据无关的、可复用的部分
- 其余可静态渲染的内容：`generateStaticParams` 里列出的那些 URL 的参数特化版本

访问一个参数在 `generateStaticParams` 里的 URL，Next.js 直接从缓存返回完整预渲染页。访问一个不在里面的 URL，先立刻返回 App Shell，然后在后台用已知的参数升级它。后续访问这个 URL 就拿到升级后的结果，完全跳过 App Shell。

启用方式：

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
}

export default nextConfig
```

Cache Components 产出 App Shell，Partial Prefetching 负责在参数已知后把它升级成完整路由。

### 时间维度上的 stale-while-revalidate

`cacheLife` 的 `revalidate` 和 `expire` 定义了时间维度上的行为：

```
内容产生 ──────── revalidate ──────── expire ────────→ 时间
    │                │                  │
    │  直接返回缓存   │  返回缓存 +       │  同步等待新内容
    │                │  后台重建         │
```

- **`revalidate` 之前**：直接返回缓存，不做任何检查。
- **超过 `revalidate`**：请求到达时先立刻返回缓存版本，同时后台重建，重建完更新缓存。
- **超过 `expire`**（且期间没有流量）：下一个请求**同步等待**新内容。

从 Pages Router 迁移过来的对应关系：

| Pages Router | Cache Components |
|---|---|
| `getStaticProps` + `revalidate` | `'use cache'` + `cacheLife` |
| `getStaticPaths` | `generateStaticParams` |
| `getStaticPaths` 的 `fallback: true` | **默认行为**，访客立刻拿到 `<Suspense>` fallback，内容流式补上 |
| `router.isFallback` | 不需要，预渲染步骤会产出静态外壳 |

## 常见坑

- **现象**：升级到 16 后 `revalidateTag('posts')` 报 TypeScript 错误。
  **原因**：新签名需要第二个参数（一个 cacheLife profile），用于启用 stale-while-revalidate 行为。
  **解法**：推荐补 `'max'`：`revalidateTag('posts', 'max')`。如果本意就是"立刻失效、不等后台"，用 `{ expire: 0 }`；在 Server Action 里更推荐直接用 `updateTag('posts')`。
  > 单参数形式压制类型错误后仍能跑，但行为等同 `{ expire: 0 }`——立即过期、不走 SWR。

- **现象**：调了 `revalidateTag('posts', 'max')`，页面还是旧的，以为没生效。
  **原因**：两个可能。① **触发者是请求而不是调用**——标签只是被标成陈旧，重建发生在下次有人请求这些数据时。② 配了 SWR profile 的 `revalidateTag` **有意不在 action 响应里带重新渲染**，页面要等之后某次读取才反映变化。
  **解法**：需要当前用户立刻看到变更，用 `updateTag`（它会在同一次往返里重渲染当前路由）。需要验证是否真的失效了，去访问那个页面再看。

- **现象**：在 Route Handler 里调 `updateTag('posts')`，直接抛错。
  **原因**：`updateTag` 和 `refresh` 都**只能**在 Server Actions 里用。这是有意限制——它们需要在 action 的响应里附带重渲染结果。
  **解法**：Route Handler 里用 `revalidateTag(tag, 'max')`。需要立即过期语义就用 `revalidateTag(tag, { expire: 0 })`——webhook 或外部服务调 Route Handler 时 `updateTag` 本来就不可用。

- **现象**：标签失效没反应，也没报错。
  **原因**：标签**区分大小写**，且长度上限 256 字符。超过上限的 tag 永远不会被赋给缓存数据，所以失效它是空操作——静默失败。
  **解法**：核对 `cacheTag('posts')` 和 `revalidateTag('posts', 'max')` 里的字符串完全一致（包括大小写）。用常量来避免拼写不一致。

- **现象**：只调了 `revalidatePath('/blog/hello')`，结果 `/blog` 上的内容也跟着失效了，重建范围超出预期。
  **原因**：`revalidatePath` 走的是软标签机制。路径里每个段都有一个 layout 软标签，失效叶子路由时会连带失效所有祖先布局的软标签。
  **解法**：想精确控制失效范围就用 `cacheTag` + `revalidateTag`。`revalidatePath` 适合"我确实想让这条路径整体重来"的场景。

- **现象**：调了 `refresh()` 之后，打了标签的缓存数据没变。
  **原因**：`refresh` 的职责只是刷新客户端路由、重新执行未缓存的动态逻辑。它**不重新验证**打过标签的数据。
  **解法**：要动缓存用 `updateTag` 或 `revalidateTag`；只有"视图依赖了缓存之外的状态"时才用 `refresh`。

- **现象**：自托管多实例部署下，在一台实例上失效了缓存，其他实例还返回旧内容。
  **原因**：默认情况下重新验证事件是**本地的**。在实例 A 上调用只失效实例 A 的缓存，其他实例会继续提供陈旧内容，直到它们得知这次失效。
  **解法**：实现自定义 cache handler，用 `updateTags()` 把失效事件写到共享存储（Redis、数据库），用 `refreshTags()` 定期读取。另外注意 `refreshTags()` 里必须捕获错误——如果它抛异常，异常会变成请求失败；捕获后请求可以用最后已知的本地标签状态继续，提供可能陈旧的内容直到连接恢复。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 按标签失效 | `revalidateTag('posts')` | **`revalidateTag('posts', 'max')`** |
| 立即失效 | 只能靠单参数 `revalidateTag` | **`updateTag('posts')`**（仅 Server Actions） |
| 刷新未缓存数据 | 无对应 API | **`refresh()`**（仅 Server Actions） |
| 定时重验证 | `export const revalidate = 3600` | `cacheLife('hours')` |
| 缓存 API 命名 | `unstable_cacheTag` / `unstable_cacheLife` | **`cacheTag` / `cacheLife`** |
| ISR fallback | `getStaticPaths` 的 `fallback: true` | **默认行为**，无需配置 |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 4、5、6 条。

## API / 配置速查

| API | 签名 | 能用在哪 | 语义 |
|---|---|---|---|
| `revalidateTag` | `(tag: string, profile: string \| { expire?: number }) => void` | Server Actions、Route Handlers | stale-while-revalidate |
| `updateTag` | `(tag: string) => void` | **仅 Server Actions** | 立刻过期，read-your-writes |
| `revalidatePath` | `(path: string) => void` | Server Actions、Route Handlers | 按路径失效 |
| `refresh` | `() => void` | **仅 Server Actions** | 刷新未缓存数据 |
| `cacheTag` | `(tag: string) => void` | `'use cache'` 作用域内 | 打标签 |
| `cacheLife` | `(profile: string \| object) => void` | `'use cache'` 作用域内 | 设置寿命 |

| `revalidateTag` 的 profile | 行为 |
|---|---|
| `'max'`（推荐） | 一年窗口，总是先给陈旧内容 |
| 其他 profile / 对象 | 只读 `expire` |
| `{ expire: 0 }` | 不提供陈旧内容，下一请求阻塞 |
| 省略（已弃用） | 等同 `{ expire: 0 }` |

| 标签类型 | 前缀 | 来源 |
|---|---|---|
| 显式标签 | 无 | 自己写的 `cacheTag()` 或 `fetch` 的 `next.tags` |
| 软标签 | `_N_T_` | 框架按路由路径自动生成，供 `revalidatePath` 使用 |

## 延伸阅读

- [官方文档：Revalidating](https://nextjs.org/docs/app/getting-started/revalidating)
- [官方文档：`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
- [官方文档：`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag)
- [官方文档：`refresh`](https://nextjs.org/docs/app/api-reference/functions/refresh)
- [官方文档：`revalidatePath`](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
- [官方文档：How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works)
- [官方文档：ISR with Cache Components](https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components)
