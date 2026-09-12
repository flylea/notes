# 39 · 性能优化

> **一句话结论**：优化的顺序是**先量再改**——`next experimental-analyze` 找大依赖，`useReportWebVitals` 看真实用户体验。三个最高收益的动作是：把纯计算从客户端组件挪到服务端组件、用 `partialPrefetching` 把预取从「按链接」变成「按路由」、开 React Compiler 免掉手写 memo。**别凭感觉优化，`next build` 已经不再给你 `First Load JS` 这类可以盯着看的数字了。**

## 最小可运行示例

```bash
# Turbopack Bundle Analyzer（16.1+），打开浏览器交互视图
pnpm next experimental-analyze

# 不启服务器，把结果写到 .next/diagnostics/analyze
pnpm next experimental-analyze --output
```

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  // 预取改为按路由取 App Shell，一个路由只取一份
  partialPrefetching: true,
  // React Compiler：稳定，但默认关闭
  reactCompiler: true,
}

export default nextConfig
```

```bash
pnpm add -D babel-plugin-react-compiler
```

`reactCompiler: true` 之前**必须先装 `babel-plugin-react-compiler`**，否则构建失败。

## 包体积分析

### Turbopack Bundle Analyzer

16.1 起内置，和 Turbopack 的模块图集成，能看服务端和客户端模块，带精确的 import 追踪。

```bash
pnpm next experimental-analyze
```

界面里可以按路由、环境（客户端/服务端）、类型（JS / CSS / JSON）过滤，或按文件名搜索。treemap 里每个模块是一个矩形，**面积代表体积**。点一个模块能看到它的体积、完整 import 链、以及它到底在哪些地方被用到。

要分享结果或对比优化前后：

```bash
pnpm next experimental-analyze --output
# 输出到 .next/diagnostics/analyze

cp -r .next/diagnostics/analyze ./analyze-before-refactor
```

保存目录后就能做前后 diff。这个能力在改了一堆 import 之后验证效果特别有用。

### Webpack 的 bundle analyzer

用 `--webpack` 构建的话：

```bash
pnpm add @next/bundle-analyzer
```

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {}

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer(nextConfig)
```

```bash
ANALYZE=true pnpm build
```

会打开三个标签页，分别是 client / server / edge 的产物。

### 三个常见的体积问题

**一、包导出太多**。图标库、工具库动辄几百个导出，`import { one } from 'lib'` 可能把整个库拉进来。

```js
// next.config.js
const nextConfig = {
  experimental: {
    optimizePackageImports: ['icon-library'],
  },
}
```

它只加载你**实际用到**的模块，同时保留「写一个 import 拿多个命名导出」的写法。Next.js 已经自动优化了一批常见库，不用手动列——完整列表见 [optimizePackageImports 文档](https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports)。

**二、把纯计算放在了客户端**。这是最容易被忽略也收益最大的一类。语法高亮、图表渲染、markdown 解析这类库，职责是「把数据变成 UI」，如果不需要浏览器 API 和用户交互，就该在服务端跑：

```tsx
// app/blog/[slug]/page.tsx —— 优化前：整个高亮库进客户端 bundle
'use client'

import Highlight from 'prism-react-renderer'
import theme from 'prism-react-renderer/themes/github'

export default function Page() {
  const code = `export function hello() { console.log("hi") }`
  return (
    <Highlight code={code} language="tsx" theme={theme}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre className={className} style={style}>
          <code>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </code>
        </pre>
      )}
    </Highlight>
  )
}
```

```tsx
// app/blog/[slug]/page.tsx —— 优化后：客户端只收到 HTML
import { codeToHtml } from 'shiki'

export default async function Page() {
  const code = `export function hello() { console.log("hi") }`

  // Shiki 在服务端跑，永远不会进客户端 bundle
  const highlightedHtml = await codeToHtml(code, {
    lang: 'tsx',
    theme: 'github-dark',
  })

  return (
    <article>
      <h1>Blog Post Title</h1>
      <pre>
        <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      </pre>
    </article>
  )
}
```

优化前的版本把整个 prism 库和它的分词逻辑都发到了客户端，尽管最终输出只是一个 `<code>` 块。这个改动通常能省几十到几百 KB。

**三、依赖没被排除出打包**。服务端组件和 Route Handler 里的 import 会被自动打包。有些包（原生模块、需要运行时 `require` 的包）应该排除：

```js
// next.config.js
const nextConfig = {
  serverExternalPackages: ['package-name'],
}
```

monorepo 里需要转译的包用 `transpilePackages`：

```js
// next.config.js
const nextConfig = {
  transpilePackages: ['@acme/ui'],
}
```

## 预取优化

### 默认行为

Next.js 在**生产环境**自动预取。每个 `<Link>` 进入视口时，它预取该路由后面的资源，并用一个任务队列调度，避免一页链接把网络打满。

预取多少取决于路由是静态还是动态（**未启用 Cache Components 时**）：

| | 静态页 | 动态页 |
|---|---|---|
| 是否预取 | 是，完整路由 | 否，除非有 `loading.js` |
| 客户端缓存 TTL | 5 分钟（默认） | 关闭，除非配 `staleTimes` |
| 点击时是否回源 | 否 | 是，在 shell 之后流式传入 |

有 `loading.js` 时，预取的是「布局到第一个 loading 边界」这段，而不是整页。

`staleTimes` 可以调客户端缓存 TTL：

```js
// next.config.js
const nextConfig = {
  staleTimes: {
    static: 300,   // 秒
    dynamic: 30,
  },
}
```

### 布局去重

**官方文档里没有「布局去重」这个术语**，社区这么叫，指的是客户端缓存的行为：

> Next.js 把预取到的 RSC 载荷存在内存里，**按路由段做键**。在兄弟路由之间导航时（如 `/dashboard/settings` → `/dashboard/analytics`），Next.js **复用父布局，只取变化的叶子页面**。

所以共享布局的部分不会重复下载。这个机制是自动的，前提是你的布局是纯的——**布局里有副作用会出问题**，见下面的常见坑。

### 增量预取

同样，官方用的是 **Prefetch scheduling（预取调度）** 这个词。Next.js 维护一个小的任务队列，按这个顺序预取：

1. 视口内的链接
2. 表现出用户意图的链接（hover 或 touch）
3. 新的链接替换旧的
4. 滚出视口的链接被丢弃

这个调度器优先处理「很可能被点击的导航」，同时最小化无用下载。开启实验性的 `useOffline` 配置后，应用从网络中断中恢复时，挂起的预取会重新走这个队列。

### Partial Prefetching

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
}
export default nextConfig
```

**`partialPrefetching` 依赖 `cacheComponents`**——不启用的话，`next dev` 和 `next build` 会在配置校验阶段抛错。

这个开关把预取模型从「全有或全无」换成「每个路由一份 App Shell」：

| | 之前的模型 | Partial Prefetching |
|---|---|---|
| 预取单位 | 每个可见链接 | 每个路由 |
| 内容 | 整页 | App Shell（静态 + 会话输出） |
| 同一路由的多个链接 | 各预取一次 | **共享一份** |
| 成本上界 | 可见链接数 | 路由数 |

具体行为：

- **一个路由一个 shell，多个链接共享。** 第一个链接进视口时取一次，后续指向同一路由的链接直接复用。**一页有很多链接时，预取请求数比「逐个全量预取」少得多。**
- **其余内容导航后流式传入**，落在 shell 的 `<Suspense>` 边界后面。
- **失效会静默刷新预取**。`revalidateTag` / `revalidatePath` 触发时会刷新关联的预取。

设计动机和 SPA 里的按路由代码分割一样：一个路由一个产物，所有指向它的链接共享。

> 读 `cookies()` 或 `headers()` 的路由，它的 App Shell 会包含会话数据。框架会自动检测并按会话在客户端缓存 shell。

单个链接想要更多内容，用 `<Link prefetch={true}>`：

```tsx
// app/page.tsx
import Link from 'next/link'

export default function Home() {
  return (
    <nav>
      <Link href="/search?q=react" prefetch={true}>React</Link>
      <Link href="/search?q=next" prefetch={true}>Next.js</Link>
    </nav>
  )
}
```

```tsx
// app/search/page.tsx
import { Suspense } from 'react'

export default function SearchPage({ searchParams }: PageProps<'/search'>) {
  return (
    <>
      <h1>Search</h1>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Results({
  searchParams,
}: {
  searchParams: PageProps<'/search'>['searchParams']
}) {
  const { q } = await searchParams
  return <ResultList items={await search(q)} />
}

async function search(q: string) {
  'use cache'
  return db.search(q)
}
```

不加 `prefetch={true}` 时，App Shell 渲染 `<h1>`，`<Results>` 显示 fallback，查询在点击后才解析并流式传入。加了之后，路由器预取一个「已解析 `<Results>`」的渲染——`q` 来自链接的 URL，在预取时就已知；缓存的 `search(q)` 提供结果。点击时结果立即出现，没有 fallback。

**代价是每个可预取链接消耗一次服务端调用。** 所以它是**按链接选择性开启**的。整页都可静态渲染时，Next.js 从静态缓存返回预取，不走服务端。

> 冷缓存（首次访问或过期后）时服务端仍需计算缓存结果，用户可能在第一次导航看到 loading。后续导航只要缓存是热的就立即完成。

`params` 和 `searchParams` 一样需要 `<Suspense>` 边界——**即使值已经由 `generateStaticParams` 预定义**。静态已知的 param 仍然属于某一个 URL；`prefetch={true}` 解析的是 `generateStaticParams` 没覆盖的那些值。

什么时候值得开：

| 值得 | 不值得 |
|---|---|
| 组件树的一部分依赖 URL 数据（完整 URL、`searchParams`、未被 `generateStaticParams` 覆盖的 `params`） | 路由几乎没有 URL 数据依赖，App Shell 已经让导航即时 |
| 那部分内容有已知的缓存生命周期（能用 `"use cache"` 或 `"use cache: private"` 表达） | 依赖的内容必须每次请求都是新的，预取会在同一个 `<Suspense>` fallback 处停下 |
| 流量足够大，能摊平每次链接的服务端调用 | 路由很少被访问——你为每个可见链接付费，不管点击率 |

**网格布局要特别小心**：一屏几十张卡片，每个 `<Link prefetch={true}>` 进视口就发一次请求。这时改用 hover 触发：

```tsx
// app/ui/hover-prefetch-link.tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'

export function HoverPrefetchLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  const [active, setActive] = useState(false)

  return (
    <Link
      href={href}
      prefetch={active ? null : false}
      onMouseEnter={() => setActive(true)}
    >
      {children}
    </Link>
  )
}
```

`prefetch={null}` 表示「用户表现出意图后恢复默认预取」。

**完全关掉预取**：

```tsx
// app/ui/no-prefetch-link.tsx
'use client'

import Link, { type LinkProps } from 'next/link'

function NoPrefetchLink({ prefetch, ...rest }: LinkProps & { children: React.ReactNode }) {
  return <Link {...rest} prefetch={false} />
}
```

代价是静态路由只能点击时才取，动态路由要等服务端渲染完才能导航。适合页脚这类「不太会被点」的链接。

**手动预取**：

```tsx
// app/pricing-card.tsx
'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

export function PricingCard() {
  const router = useRouter()

  return (
    <div onMouseEnter={() => router.prefetch('/pricing')}>
      <Link href="/pricing">View Pricing</Link>
    </div>
  )
}
```

`router.prefetch` 还支持 `onInvalidate` 回调，Next.js 怀疑缓存数据陈旧时调用它，让你刷新预取。用 `useRouter` 重建 `<Link>` 的行为会**把预取和缓存失效的维护责任转移到你身上**——除非默认行为不够用，否则别这么干。

## 内存排查

```bash
pnpm dev --experimental-cpu-prof
pnpm build --experimental-cpu-prof
```

生成的 `.cpuprofile` 用 Chrome DevTools 的 Performance 面板 → Load profile 打开。重点看 `dev-server-*`（dev）和 `build-turbopack-*`（build）——主进程通常只是调度。

服务端内存问题的几个常见来源：

**模块级缓存不释放**：

```ts
// lib/cache.ts —— 危险
const cache = new Map<string, unknown>()

export function remember<T>(key: string, compute: () => T): T {
  if (!cache.has(key)) cache.set(key, compute())
  return cache.get(key) as T
}
```

dev 下模块级 `Map` 可能不随 HMR 清理，反复改文件持续堆积。生产下多实例各自持有全量缓存，内存随数据量线性增长。用 LRU 或外部缓存替代。

**缓存没有上限**：

```js
// next.config.js
module.exports = {
  // 默认内存缓存上限 50MB，设为 0 完全禁用
  cacheMaxMemorySize: 0,
  images: {
    // 默认用启动时可用磁盘空间的 50%，显式设上限
    maximumDiskCacheSize: 500_000_000,
  },
}
```

**构建期内存峰值**。`next build` 预渲染大量静态页面时所有页面并发渲染，内存占用显著高于运行时。CI runner 要给够内存；排查时用 `--debug-build-paths` 缩小范围：

```bash
next build --debug-build-paths="app/**/page.tsx,!app/admin/**"
```

## React Compiler

```bash
pnpm add -D babel-plugin-react-compiler
```

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
}
export default nextConfig
```

React Compiler 自动做 memoization，`useMemo` / `useCallback` 的手写场景大幅减少。16 里它**已稳定**，但**默认不开启**——需要显式安装 `babel-plugin-react-compiler` 并在配置里打开。

### 为什么需要装 Babel 插件

React Compiler 本身是 Babel 插件。Next.js 用 Rust 写的 SWC 做编译，比 Babel 快得多。所以 Next.js 加了一层 SWC 优化：**分析项目，只对相关文件应用 React Compiler**——也就是含 JSX 或 React Hooks 的那些，而不是跑每个文件。

结果是构建时间会比纯 Rust 编译稍慢，但影响是局部的、小的。这个取舍是必要的：React Compiler 需要完整的 AST 分析和转换能力，SWC 侧的等价实现还不存在。

### 注解模式

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: {
    compilationMode: 'annotation',
  },
}
export default nextConfig
```

```tsx
// app/page.tsx
export default function Page() {
  'use memo'
  // ...
}
```

注解模式下只有标了 `"use memo"` 的组件和 hook 会被编译。反向的 `"use no memo"` 可以单独排除某个组件或 hook。

注解模式的用途是**渐进采用**：先在一个组件上验证行为，确认没有副作用问题再逐步推开。全量开启后发现某个组件行为异常，也不用整体回退。

### 该注意什么

React Compiler 依赖组件是**纯的**。它假设渲染过程中不产生副作用、不读可变的外部状态。违反这些假设的代码编译后行为可能和预期不同。升级时如果发现某个组件「莫名其妙的缓存了旧值」，先检查它是不是读了模块级的可变变量。

## 常见坑

- **现象**：`reactCompiler: true` 后构建失败，报找不到 Babel 插件。
  **原因**：React Compiler 通过 `babel-plugin-react-compiler` 运行，默认没装。
  **解法**：`pnpm add -D babel-plugin-react-compiler`。

- **现象**：开了 `partialPrefetching` 后 dev server 启动就报配置错误。
  **原因**：`partialPrefetching` 依赖 `cacheComponents`。
  **解法**：同时设 `cacheComponents: true`。

- **现象**：预取时触发了分析埋点，pageview 数据偏高。
  **原因**：布局或页面不纯，有副作用（如 `trackPageView()`）。Next.js 预取路由时会执行它们，而不是等用户真的访问。
  **解法**：把副作用挪进 `useEffect`（客户端组件）或由客户端组件触发的 Server Action。

  ```tsx
  // app/ui/analytics-tracker.tsx
  'use client'

  import { useEffect } from 'react'
  import { trackPageView } from '@/lib/analytics'

  export function AnalyticsTracker() {
    useEffect(() => {
      trackPageView()
    }, [])
    return null
  }
  ```

- **现象**：`<Link prefetch={true}>` 在卡片网格里导致大量服务端请求。
  **原因**：每个可见链接各消耗一次服务端调用。
  **解法**：改用 hover 触发预取，或对列表项用 `prefetch={false}`。

- **现象**：`prefetch={true}` 指向的路由在 dev 下报错，提示要开 partialPrefetching。
  **原因**：目标路由没有采用 Partial Prefetching。
  **解法**：全局开 `partialPrefetching`，或在段上设 `prefetch = 'partial'`。

- **现象**：客户端 bundle 里出现了只在服务端用的大库。
  **原因**：某个客户端组件 import 了它，或者一个共享模块里混了服务端和客户端逻辑。
  **解法**：用 `next experimental-analyze` 看 import 链，把纯计算逻辑挪到服务端组件。

- **现象**：服务端内存持续增长，重启才降。
  **原因**：模块级 `Map` 缓存无上限，或图片磁盘缓存没设上限。
  **解法**：换 LRU / 外部缓存；`cacheMaxMemorySize: 0` 关掉默认内存缓存；设 `images.maximumDiskCacheSize`。

- **现象**：`next build` 在 CI 里 OOM。
  **原因**：预渲染大量页面时并发渲染，内存峰值高。
  **解法**：给 runner 加内存；用 `--debug-build-paths` 定位是哪批路由；检查是否有页面在构建时加载了过大的数据集。

- **现象**：找不到 `First Load JS` 数字，没法对比优化效果。
  **原因**：16 移除了 `size` 和 `First Load JS` 两列（RSC 架构下这两个数字不准确）。
  **解法**：用 `next experimental-analyze`，它给的是模块级的真实数据。

## 旧写法 vs 新写法

| 场景 | 旧写法 | 16 写法 |
|---|---|---|
| 包体积分析 | `@next/bundle-analyzer`（webpack） | **`next experimental-analyze`**（Turbopack，16.1+） |
| 构建体积指标 | `size` / `First Load JS` 列 | **移除**，用 analyzer |
| 预取模型 | 每个可见链接全量预取 | **`partialPrefetching`**：每路由一份 App Shell |
| 手写 memoization | `useMemo` / `useCallback` | **React Compiler**（需装 Babel 插件） |
| 客户端缓存 TTL | 默认 5 分钟 | `staleTimes.static` / `staleTimes.dynamic` |
| 包导入优化 | 手动 tree-shake | `optimizePackageImports` |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 18 条。

## API / 配置速查

| 配置 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `partialPrefetching` | boolean | `false` | 每路由 App Shell，**需 `cacheComponents`** |
| `reactCompiler` | boolean \| `{ compilationMode }` | `false` | 需装 `babel-plugin-react-compiler` |
| `experimental.optimizePackageImports` | string[] | — | 只加载实际用到的模块 |
| `serverExternalPackages` | string[] | `[]` | 不打包，走原生 `require` |
| `transpilePackages` | string[] | `[]` | 转译 monorepo / `node_modules` 依赖 |
| `staleTimes.static` | number（秒） | `300` | 静态路由客户端缓存 TTL |
| `staleTimes.dynamic` | number（秒） | `0`（关闭） | 动态路由客户端缓存 TTL |
| `cacheMaxMemorySize` | number | `52428800`（50MB） | `0` 禁用内存缓存 |
| `images.maximumDiskCacheSize` | number（字节） | 可用磁盘空间的 50% | `0` 禁用磁盘缓存 |
| `images.maximumResponseBody` | number（字节） | `50000000`（50MB） | 图片响应体上限 |
| `webVitalsAttribution` | string[] | — | 定位 Web Vitals 问题来源 |

| 命令 | 作用 |
|---|---|
| `next experimental-analyze` | Turbopack 包体积分析（16.1+） |
| `next experimental-analyze --output` | 结果写到 `.next/diagnostics/analyze` |
| `next experimental-analyze --port <port>` | 分析器端口，默认 4000 |
| `next dev --experimental-cpu-prof` | CPU profile 写到 `.next-profiles/` |
| `next build --profile` | React 生产性能分析 |
| `next build --debug-build-paths=<glob>` | 只构建匹配路由 |

| `<Link>` 的 `prefetch` | 行为 |
|---|---|
| 不设 | 默认预取（Partial Prefetching 下取 App Shell） |
| `true` | 额外解析 URL 数据（`params` / `searchParams`） |
| `false` | 完全关闭 |
| `null` | 恢复默认行为（配合 hover 使用） |

| 预取调度顺序 | 优先级 |
|---|---|
| 视口内链接 | 1 |
| hover / touch 意图 | 2 |
| 新链接替换旧链接 | 3 |
| 滚出视口 | 丢弃 |

## 延伸阅读

- [官方文档：Package Bundling](https://nextjs.org/docs/app/guides/package-bundling)
- [官方文档：Prefetching](https://nextjs.org/docs/app/guides/prefetching)
- [官方文档：Optimizing prefetching](https://nextjs.org/docs/app/guides/optimizing-prefetching)
- [官方文档：partialPrefetching](https://nextjs.org/docs/app/api-reference/config/next-config-js/partialPrefetching)
- [官方文档：reactCompiler](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler)
- [官方文档：optimizePackageImports](https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports)
- [官方文档：staleTimes](https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes)
- [官方文档：Production Checklist](https://nextjs.org/docs/app/guides/production-checklist)
- [React 文档：React Compiler](https://react.dev/learn/react-compiler/introduction)
- [Web Vitals](https://web.dev/articles/vitals)
