# 08 · 渲染策略总览

> **一句话结论**：Next.js 16 里"静态还是动态"的决策点**不在路由上，在组件上**。一条路由可以同时有构建期就绪的静态外壳、按小时刷新的缓存区块、和每次请求都重算的流式区块。所以真正要回答的问题不是"这个页面用 SSR 还是 SSG"，而是"这段 UI 的输入来自构建期、缓存、还是这次请求"。

## 最小可运行示例

```tsx
// app/blog/page.tsx
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { cacheLife, cacheTag } from 'next/cache'
import Link from 'next/link'

export default function BlogPage() {
  return (
    <>
      {/* 1. 静态内容：构建期就进静态外壳 */}
      <header>
        <h1>Our Blog</h1>
        <nav>
          <Link href="/">Home</Link> | <Link href="/about">About</Link>
        </nav>
      </header>

      {/* 2. 缓存内容：也进静态外壳，按小时在后台重建 */}
      <BlogPosts />

      {/* 3. 请求期内容：静态外壳里先放 fallback，请求时流式补齐 */}
      <Suspense fallback={<p>Loading your preferences...</p>}>
        <UserPreferences />
      </Suspense>
    </>
  )
}

type Post = { id: string; title: string; author: string; date: string }

async function BlogPosts() {
  'use cache'
  cacheLife('hours')
  cacheTag('posts')

  const res = await fetch('https://api.vercel.app/blog')
  const posts: Post[] = await res.json()

  return (
    <section>
      <h2>Latest Posts</h2>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <h3>{post.title}</h3>
            <p>
              By {post.author} on {post.date}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

async function UserPreferences() {
  const theme = (await cookies()).get('theme')?.value || 'light'

  return (
    <aside>
      <p>Your theme: {theme}</p>
    </aside>
  )
}
```

同一个文件里三种策略共存。构建时产出的静态外壳包含 header、blog posts、以及 preferences 的 fallback；`cookies()` 那段在请求时流进来。

注意最后一行行为的改变：**读 `cookies()` 不再把整条路由变成动态的**。这是 Cache Components 带来的模型变化——运行期访问只影响它所在的那个 Suspense 边界。

## 判定树：先问输入，再问时效

不要从"CSR / SSR / SSG / ISR / PPR"这五个名词出发选。从**数据从哪来**出发，答案自己会浮现。

```
这段 UI 的输入是什么？
│
├─ 构建期就确定，永远不变（模块 import、fs.readFileSync、纯计算、常量）
│  └─ 什么都不用写 → 自动进静态外壳
│
├─ 来自外部数据源，但所有用户看到的是同一份
│  ├─ 可以接受一段时间内不更新
│  │  └─ 'use cache' + cacheLife('hours' | 'days' | ...) → 进静态外壳
│  └─ 必须内容一变就更新
│     └─ 'use cache' + cacheLife('max') + cacheTag('x')
│        内容源变更时打 webhook 调 revalidateTag('x', 'max')
│
├─ 每次请求都可能不同（cookies()、headers()、searchParams、动态 params）
│  ├─ 能忍受先看到 fallback
│  │  └─ 包 <Suspense>，让它在请求期流式补齐
│  └─ 不能，整页必须一次成型
│     └─ 整页包 <Suspense>（或放 loading.tsx），退化成整页骨架
│
└─ 依赖客户端状态或用户交互后才产生
   └─ 客户端组件里取（SWR / React Query），或传 Promise 给客户端用 use() 读
```

对应的决策表：

| 你的情况 | 策略 | 在 16 里怎么写 |
|---|---|---|
| 纯静态内容 | 构建期预渲染 | 什么都不写，自动进静态外壳 |
| 全站同一份数据，可容忍延迟 | 缓存 + 时间失效 | `'use cache'` + `cacheLife(profile)` |
| 全站同一份数据，要即时失效 | 缓存 + 按需失效 | `'use cache'` + `cacheTag` + `revalidateTag(tag, 'max')` |
| 每次请求不同，可接受 fallback | 流式 SSR | `<Suspense>` 包住运行期访问 |
| 每次请求不同，且要完整首屏 | 整页 SSR | 整页 `<Suspense>` / `loading.tsx` |
| 只在交互后才有数据 | CSR | 客户端组件里用 SWR / React Query |

## 为什么这样设计：把静态/动态从二元变成光谱

大多数框架在**路由级**划一条硬线：一个页面要么构建期预渲染，要么请求期服务端渲染。这个模型好理解也好部署——静态文件扔 CDN，动态路由指向服务器。

Next.js 16 换了个位置：**边界在组件级**。一条路由里可以有"立刻加载的静态外壳 + 各自解析后流进来的动态区块"；一个缓存函数可以活在动态路由里；一个静态页面可以不重新部署就更新。

这个选择有三方面收益：

- **感知加载更快**：静态外壳立刻渲染，动态内容流进来。用户马上看到有用内容，而不是等整页渲染完。
- **增量缓存**：不必在构建期就决定某条路由是静态还是动态。任何页面都能按需重新验证，任何函数都能用 `'use cache'` 缓存。
- **粒度更细**：缓存一个函数而不是一条路由，失效一个 tag 而不是一次部署。一个昂贵的数据库查询可以独立于页面其余部分被缓存。

代价是把复杂度从应用代码转移到了托管平台：需要流式传输（因为静态和动态在同一个响应里）、需要缓存协调（多实例下失效要传播）、需要保证 HTML 与 RSC Payload 的一致性（客户端导航读的是后者）。这些是部署侧的事，见 [33 构建与部署总览](../07-deployment-ops/33-build-and-deploy.md)。

### PPR 不再是实验特性

| | 旧（15 及更早） | 新（16.3） |
|---|---|---|
| 开启方式 | `experimental.ppr` 全局开关 | **并入 `cacheComponents`** |
| 路由级开关 | `export const experimental_ppr = true` | **已移除**，不需要 |
| 定位 | 实验特性 | **Cache Components 的一部分，App Router 的默认渲染行为** |

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

开启 `cacheComponents` 后，**PPR 就是默认行为**——不需要任何路由级声明。构建期 Next.js 会渲染整棵组件树，根据每个组件用到的 API 决定它怎么被处理：

- `'use cache'` → 结果进缓存、进静态外壳（前提是生命周期足够长）
- `<Suspense>` → fallback 进静态外壳，内容在请求期流式补齐
- 可预测的值（模块 import、`fs.readFileSync`、纯计算）→ 构建期完成，自动进静态外壳
- 随机值与时间戳（`Math.random()`、`Date.now()`、`crypto.randomUUID()`）→ 必须显式处理

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 3 条。

### 静态外壳、App Shell 与 ISR

"静态外壳"（static shell）指所有异步工作解析之前就能渲染出来的部分：布局、导航、以及各 `<Suspense>` 边界定义的 fallback。它会产出 HTML（首次访问用）和序列化 RSC Payload（客户端导航用），两者保证浏览器无论直接访问还是从别的页面跳过来，都能立刻拿到完整渲染的内容。

外壳里能装什么，取决于构建期已知多少信息。当动态参数已知（`generateStaticParams` 列出了它），外壳里就是那个具体内容。**当参数未知，可复用的、与 URL 无关的那一版外壳叫 App Shell**——同一份静态外壳，只是把依赖参数的部分留在 fallback 后面。首次访问之后，后台会把具体版本补上并缓存给下一个访客，这就是 Cache Components 下的 ISR。

| 构建期状态 | 首次访问拿到什么 |
|---|---|
| 两个参数都在 `generateStaticParams` 里 | 完整静态页 |
| 父参数已知、子参数未知 | 父级已渲染的 App Shell，子级流式补齐 |
| 都不已知 | 通用 App Shell，两级都流式补齐 |

App Shell 从 16.3 起就能直接发出，更早的版本会等一次完整的服务端渲染。

### 路由级配置在 16 里已经不可用

这是最容易在升级时踩到的点：开启 `cacheComponents` 后，路由段上还在导出 `dynamic`、`revalidate`、`fetchCache` 会**直接报错**。原来的路由级开关逐一对应到组件级写法：

| 旧的路由段配置 | 现在怎么办 |
|---|---|
| `dynamic = 'force-dynamic'` | **不需要**，所有页面默认动态 |
| `dynamic = 'force-static'` | 删掉；改用 `'use cache'` + `cacheLife('max')` |
| `revalidate = 3600` | 改用 `cacheLife('hours')` 或自定义 profile |
| `fetchCache` | **不需要**，`'use cache'` 作用域内所有取数自动缓存 |

`GET` Route Handler 也遵循同一模型：不再用 `dynamic = 'force-static'` 开启缓存，而是把取数逻辑挪进一个 `'use cache'` 函数里让 handler 调用。注意指令**不能直接加在 `GET` 导出上**。

### 什么时候该让路由阻塞

有些路由确实无法立即产出外壳。用 `instant` 路由段配置标注它：

```tsx
// app/dashboard/layout.tsx
export const instant = false
```

`instant = false` 表示"这个段允许阻塞导航"。它**不会**把路由强制成动态——真正可预渲染的路由照样产出静态外壳。它只是告诉 Next.js 别在这里报"导航不够快"的验证错误，让你能分批迁移：先让整个应用能构建能跑，再一条路由一条路由地清理。

需要注意它清不掉一类错误：**同步 IO**。`new Date()`、`Date.now()`、`Math.random()`、`crypto.randomUUID()` 在预渲染期间会抛构建错误，`instant = false` 不管用。要处理就把这段挪到请求期——用 `<Suspense>` 包住并先调 `connection()`：

```tsx
// app/page.tsx
import { connection } from 'next/server'
import { Suspense } from 'react'

async function UniqueContent() {
  await connection() // 预渲染到此为止，下面只在请求期执行
  const uuid = crypto.randomUUID()
  return <p>Request ID: {uuid}</p>
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <UniqueContent />
    </Suspense>
  )
}
```

`performance.now()` 是个例外——它是给遥测用的，Next.js 不把它当作需要守护的值。用它计时并把结果交给日志/指标，不要渲染出来。

### 把异步工作推深，让外壳长更大

这是 Cache Components 奖励的结构性写法，对**所有**运行期 API 和异步操作都成立：**异步工作下沉得越深，能预渲染的部分越多**。

考虑一个在顶层解构 `params` 的布局：

```tsx
// app/shop/[slug]/layout.tsx
export default async function Layout({
  children,
  params,
}: LayoutProps<'/shop/[slug]'>) {
  const { slug } = await params // 参数若是动态的，整个布局就无法预渲染

  return (
    <div>
      <Sidebar />
      <h1>{slug}</h1>
      {children}
    </div>
  )
}
```

改成把 promise 往下传、在边界内部 await：

```tsx
// app/shop/[slug]/layout.tsx
import { Suspense } from 'react'

// 不写 async：这个布局永远不 await params
export default function Layout({
  children,
  params,
}: LayoutProps<'/shop/[slug]'>) {
  return (
    <div>
      <Sidebar />
      <Suspense fallback={<h1>Loading...</h1>}>
        {/* await 发生在边界内部，外壳照样渲染 */}
        {params.then(({ slug }) => (
          <SlugHeading slug={slug} />
        ))}
      </Suspense>
      {children}
    </div>
  )
}

function SlugHeading({ slug }: { slug: string }) {
  return <h1>{slug}</h1>
}
```

现在 `<Sidebar />`、`{children}`、Suspense fallback 全都进了静态外壳，只有 `SlugHeading` 在请求期流进来。`cookies()`、`headers()`、`searchParams`、数据获取都是同一个道理。

## 常见坑

- **现象**：一条本来可以静态化的内容页，为了里面一个"显示用户名"的小区块，整页变成了动态渲染，TTFB 直接等于最慢的查询。
  **原因**：旧模型下在顶层读 `cookies()` 会让整条路由变成动态的。这是最典型的误用——用整页动态去换一小块个性化。
  **解法**：把读运行期数据的组件拆出来单独包 `<Suspense>`，让其余部分留在静态外壳里。判定标准很简单：**这个数据是"全站同一份"还是"每个请求不同"**——同一份就该缓存，不同的才该流式。

- **现象**：升级到 16 并开启 `cacheComponents` 后，构建报错说 `dynamic` / `revalidate` / `fetchCache` 不被允许。
  **原因**：这三个路由段配置在 Cache Components 下已不可用，它们对应的能力被组件级的 `'use cache'` + `cacheLife` 取代了。
  **解法**：按上文对照表逐项迁移。`force-dynamic` 直接删；`force-static` 改成 `'use cache'` + `cacheLife('max')`；`revalidate = N` 换算成最接近的 profile 或自定义 profile。

- **现象**：构建挂在某个路由上，50 秒后报 `Filling a cache during prerender timed out`。
  **原因**：`'use cache'` 作用域里拿到了一个在边界**外面**创建的、指向运行期数据的 Promise（`params`、`searchParams`、`cookies()`、未缓存数据）。缓存函数在等一个构建期永远解析不了的东西。
  **解法**：把运行期数据在缓存边界外面先 await 出来，把**具体值**当参数传进缓存函数。直接调 `cookies()` 或 `headers()` 会立刻报另一个错（`next-request-in-use-cache`），不是超时。

- **现象**：给 `cacheLife` 配了 `revalidate: 0` 或很短的时间，结果这块内容没有被预渲染。
  **原因**：生命周期太短的缓存会被排除出预渲染，变成"动态空洞"在请求期解析。具体阈值：`revalidate` 为 `0`、或 `expire` 小于 5 分钟、或 `stale` 小于 30 秒——满足任一条就不进预渲染。预置 profile 里只有 `seconds` 会踩到（它的 `expire` 是 1 分钟）。
  **解法**：如果这块内容本来就该每次请求重算，那是预期行为，包个 `<Suspense>` 给它 fallback 就行。如果你本意是"缓存"，把 profile 换长一点。

- **现象**：页面在浏览器里正常，爬虫抓到的却是渲染失败的版本。
  **原因**：爬虫的处理方式和浏览器不同。HTML-limited 的爬虫会**跳过预渲染的外壳，在请求期重新整页动态渲染**。如果外壳依赖了只在构建期存在的数据，人访问没事，爬虫就会失败。
  **解法**：确保外壳依赖的数据在请求期同样可得。另外，这类爬虫会等 `generateMetadata` 解析完再发内容，把元数据放进 `<head>`。

- **现象**：把 `<Suspense>` 加得到处都是，页面反而更慢了。
  **原因**：每个 Suspense 边界都是潜在的阻塞点。React 在慢网络或繁忙 CPU 下可能真的回退到 fallback；而且边界太大时，React 为了发送它的 HTML 本身也会延迟。加一个边界就等于接受"它可能真的被用上"。
  **解法**：只在确实有异步工作时加边界，并且加在**靠近运行期访问的地方**。LCP 元素（hero 图、主标题）要放在边界外面或上面。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 强制动态 | `export const dynamic = 'force-dynamic'` | 不需要，默认就是动态 |
| 强制静态 | `export const dynamic = 'force-static'` | `'use cache'` + `cacheLife('max')` |
| 定时重建 | `export const revalidate = 3600` | `cacheLife('hours')` |
| 取数缓存 | `fetchCache` 路由段配置 | `'use cache'` 作用域内自动缓存 |
| 开启 PPR | `experimental.ppr: true` + 路由级 `experimental_ppr` | `cacheComponents: true`，PPR 成为默认 |
| 让路由允许阻塞 | 无对应配置 | `export const instant = false` |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 3 条。

## API / 配置速查

| 配置 | 位置 | 作用 |
|---|---|---|
| `cacheComponents: true` | `next.config.ts` | 开启 Cache Components，PPR 成为默认行为 |
| `partialPrefetching: true` | `next.config.ts` | 让 App Shell 被预取，实现未列出 URL 的即时首访 |
| `instant = false` | 路由段（layout / page / 平行槽） | 标记该段允许阻塞导航 |
| `connection()` | `next/server` | 在此处截断预渲染，之后只在请求期执行 |

| 输入来源 | 处理方式 | 是否进静态外壳 |
|---|---|---|
| 模块 import、`fs.readFileSync`、纯计算 | 什么都不写 | 是 |
| 外部数据，`'use cache'` + 足够长的 `cacheLife` | 缓存指令 | 是 |
| `'use cache'` + 过短的 `cacheLife` | 缓存指令 | 否，变成动态空洞 |
| `cookies()` / `headers()` / `searchParams` / 动态 `params` | `<Suspense>` | 否，fallback 进外壳 |
| `Math.random()` / `Date.now()` / `crypto.randomUUID()` | `connection()` + `<Suspense>`，或 `'use cache'` | 视处理方式而定 |

## 延伸阅读

- [官方文档：Rendering Philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy)
- [官方文档：Caching](https://nextjs.org/docs/app/getting-started/caching)
- [官方文档：ISR with Cache Components](https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components)
- [官方文档：`cacheComponents`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
- [官方文档：`instant` 路由段配置](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/instant)
- [官方文档：`connection`](https://nextjs.org/docs/app/api-reference/functions/connection)
