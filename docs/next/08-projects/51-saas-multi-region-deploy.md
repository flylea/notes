# 51 · SaaS B：多区域与平台部署

> **一句话结论**：多区域部署里**计算是简单的部分，数据是难的部分**——把 Node 进程铺到五个区域只要改一个配置，把数据库和缓存铺过去要重新设计一致性模型。另外注意：`preferredRegion` 路由段配置在 16 里**已废弃**，区域选择现在是平台的职责，不是应用代码的职责。

## 最小可运行示例

```ts
// instrumentation.ts —— 必须在项目根目录（或 src/ 下），不能在 app/ 里
import { registerOTel } from '@vercel/otel'
import type { Instrumentation } from 'next'

export function register() {
  registerOTel({
    serviceName: 'saas-web',
    attributes: {
      // 让所有 span 都带上部署元信息，跨区域排查时能直接分组
      'deployment.region': process.env.VERCEL_REGION ?? process.env.REGION ?? 'local',
      'deployment.env': process.env.NODE_ENV ?? 'development',
    },
  })
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const digest =
    typeof err === 'object' && err !== null && 'digest' in err
      ? String(err.digest)
      : undefined

  // 注意：onRequestError 会在 Server Components 渲染、Server Actions、
  // Route Handlers、Proxy 四类场景里触发，context.routeType 会告诉你哪一类
  await fetch(`${process.env.OTEL_COLLECTOR_URL}/errors`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: err instanceof Error ? err.message : String(err),
      // Server Components 里的错误可能被 React 包装过，
      // 原始类型要靠 digest 识别
      digest,
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
      revalidateReason: context.revalidateReason,
      region: process.env.VERCEL_REGION ?? 'unknown',
    }),
  }).catch(() => {
    // 上报失败不能影响请求本身
  })
}
```

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Multi-Zones：让本 zone 的静态资源走独立前缀，避免和其他 zone 冲突
  assetPrefix: process.env.ZONE_PREFIX,

  async rewrites() {
    return [
      // 把 /blog/* 交给另一个 zone
      {
        source: '/blog',
        destination: `${process.env.BLOG_ZONE_URL}/blog`,
      },
      {
        source: '/blog/:path+',
        destination: `${process.env.BLOG_ZONE_URL}/blog/:path+`,
      },
      // 静态资源也必须转发，否则 blog zone 的 JS/CSS 会 404
      {
        source: '/blog-static/:path+',
        destination: `${process.env.BLOG_ZONE_URL}/blog-static/:path+`,
      },
    ]
  },
}

export default nextConfig
```

## 多区域：先分清计算和数据

```
计算（Node 进程）          数据（数据库 / 缓存）
├─ 部署到 5 个区域          ├─ 主库通常只有一个
├─ 无状态，随时可扩          ├─ 只读副本可以铺到多个区域
└─ 部署配置改一行            └─ 写入延迟受物理距离限制
```

**计算多区域的收益**：用户请求在最近的区域处理，TTFB 从 200ms 降到 30ms。这个收益是真实的，但**只对「不需要访问主库」的请求成立**。

**数据多区域的代价**：如果每次请求都要读主库，那么把计算铺到 5 个区域只让「到应用的网络延迟」变短，应用访问数据库的延迟没变——甚至更糟，因为现在有一个区域的进程离主库特别远。

所以多区域部署的第一件事是**给请求分类**：

| 请求类型 | 是否需要跨区域访问数据 | 处理方式 |
|---|---|---|
| 静态资源 | 否 | CDN 边缘直接返回 |
| 静态页面（`'use cache'`） | 否 | 各区域的预渲染产物 / CDN |
| 读多写少的租户数据 | 是（读） | 就近读只读副本 |
| 写操作、强一致读 | 是（写） | 路由到主库所在区域 |

### 数据驻留（Data Residency）

如果客户是欧盟企业，「数据不能离开欧盟」是合同条款。这时租户需要带上**区域属性**：

```prisma
// prisma/schema.prisma（片段）
model Tenant {
  id     String @id @default(cuid())
  slug   String @unique
  name   String

  // 数据驻留区域。决定这个租户的数据存在哪个区域的库里
  region String @default("eu-central")

  // 也可能需要独立的数据源
  dataSourceId String?

  createdAt DateTime @default(now())
}
```

**关键点：`region` 必须进缓存键。** 这和第 50 章的 `tenantId` 是同一个道理——同一个 slug 在不同区域可能对应不同的数据源：

```ts
// lib/dal/posts.ts
import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'
import { getPrismaForRegion } from '@/lib/db'

/**
 * 区域也必须作为参数传进来，不能靠 headers() 在缓存作用域里读。
 * 理由和 tenantId 完全一样：它是缓存键的一部分。
 */
export async function listPosts(tenantId: string, region: string) {
  'use cache'
  cacheLife('minutes')
  cacheTag(`posts:${region}:${tenantId}`)

  const db = getPrismaForRegion(region)
  return db.post.findMany({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })
}
```

标签写成 `posts:${region}:${tenantId}` 而不是 `posts:${tenantId}`。虽然理论上 `tenantId` 已经唯一确定了一个租户、也就确定了它的区域，但**冗余写进标签的代价是零，漏掉一次的代价是数据串区**。

### 区域选择在 16 里归谁管

```ts
// 已废弃的写法 —— 不要在 16 里用
export const preferredRegion = 'eu-central'
```

`preferredRegion` 路由段配置在 16 里**已标记废弃**。原因是它把「部署拓扑」这件事写进了应用代码——而应用代码不应该知道自己在哪个区域运行。

现在的做法：

| 层级 | 负责什么 | 怎么做 |
|---|---|---|
| 平台 | 默认部署区域、区域列表 | 平台配置（如 `vercel.json` 的 `regions`，或自托管的多集群） |
| 应用 | 从环境变量读当前区域 | `process.env.VERCEL_REGION` / 自定义 `REGION` |
| 应用 | 按租户区域选择数据源 | 应用代码（业务逻辑，不是部署配置） |

**应用代码只做一件事：读环境变量知道自己在哪，然后按业务规则决定去哪拿数据。** 它不声明「我应该被部署到哪」。

```ts
// lib/region.ts
import 'server-only'

/**
 * 当前进程运行在哪个区域。由平台注入的环境变量决定。
 * 本地开发返回 'local'，用于跳过区域相关的分支。
 */
export const currentRegion =
  process.env.VERCEL_REGION ?? process.env.REGION ?? 'local'

export function regionForTenant(tenant: { region: string }): string {
  // 数据驻留是硬约束：租户数据在哪个区域，就必须在哪个区域处理。
  // 不做「就近读副本」的优化 —— 那会让数据跨区域
  return tenant.region
}
```

## Multi-Zones：把一个域拆成多个应用

Multi-Zones 解决的是**构建时间和团队边界**的问题，不是性能问题。

```
example.com/            → 主应用（zone A）
example.com/blog/*      → 博客应用（zone B）
example.com/dashboard/* → 控制台应用（zone C）
```

三个独立部署的 Next.js 应用，共享一个域名。用户看到的是一致的产品。

### 收益

| 收益 | 说明 |
|---|---|
| 构建时间 | 每个 zone 单独构建，改博客不会触发控制台重建 |
| 代码边界 | 博客的 MDX 依赖不会进控制台的依赖图 |
| 独立发布 | 三个团队各自发版 |
| 框架自由 | 理论上其他 zone 可以用别的框架 |

### 代价

**导航从软跳转变成硬跳转。** 同一个 zone 内是客户端导航（不刷新页面），跨 zone 是**整页刷新**——因为两个 zone 的客户端路由互不知情。

这条决定了 zone 的划分原则：**经常互相跳转的页面必须放在同一个 zone**。把「文章列表」和「文章详情」拆到两个 zone，用户每次点文章都要整页刷新。

### 关键配置

**每个 zone 要有独立的 `assetPrefix`：**

```ts
// 博客 zone 的 next.config.ts
const nextConfig: NextConfig = {
  assetPrefix: '/blog-static',
}
```

没有它，两个 zone 的 `_next/static/chunk-abc.js` 会互相覆盖——文件名哈希不同还好，哈希相同时（比如两边有完全相同的依赖）就会加载到错误的版本。

**静态资源也要转发：**

```ts
// 主应用（zone A）的 next.config.ts
async rewrites() {
  return [
    { source: '/blog', destination: `${process.env.BLOG_ZONE_URL}/blog` },
    { source: '/blog/:path+', destination: `${process.env.BLOG_ZONE_URL}/blog/:path+` },
    // 这一条最容易漏。漏了之后 HTML 能出来，但 JS/CSS 全部 404
    { source: '/blog-static/:path+', destination: `${process.env.BLOG_ZONE_URL}/blog-static/:path+` },
  ]
}
```

**跨 zone 的链接用 `<a>` 而不是 `<Link>`：**

```tsx
// 主应用里指向博客的链接
<a href="/blog/hello">读这篇文章</a>
```

`<Link>` 会尝试预取和客户端软导航，而目标在另一个 zone——预取会 404，软导航会失败。用原生 `<a>` 触发一次正常的整页请求，由主应用的 rewrite 转发过去。

**Server Actions 需要显式允许来源：**

```ts
// next.config.ts
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 用户的域名可能由多个应用共同服务，必须显式声明
      allowedOrigins: ['example.com'],
    },
  },
}
```

没有这一条，跨 zone 的 Server Action 会因为 CSRF 的 `Origin` 校验失败被拒绝。

### 什么时候不该用 Multi-Zones

- **团队只有一支**。构建时间不是瓶颈时，拆分的协调成本大于收益。
- **页面之间跳转频繁**。硬跳转会明显劣化体验。
- **共享状态多**。三个 zone 之间共享会话、共享 UI 组件库、共享设计系统，会引入大量的重复配置和版本漂移。

**判断标准**：如果拆完之后你还要写一套「共享包」来协调三个 zone，那说明它们本来就该是一个应用。

## 平台缓存

### 三层缓存

| 层 | 存什么 | 失效方式 |
|---|---|---|
| **CDN 边缘** | 静态外壳 HTML、`_next/static` 资源 | 部署时按内容哈希更新；`Cache-Control` 头 |
| **平台持久缓存** | `'use cache'` 的产物、ISR 升级后的页面 | `revalidateTag` / `updateTag` / `cacheLife` |
| **实例内存** | 默认的共享存储（LRU） | 实例重启即失效 |

关键认知：**`'use cache'` 的默认共享存储是「每实例的内存 LRU」**。在 serverless 上，每个实例的内存是临时的——同一个缓存条目可能在不同实例上各有一份，也可能因为实例回收而消失。

```ts
// lib/dal/reports.ts
export async function getMonthlyReport(tenantId: string, month: string) {
  // 用 remote 变体，把结果放进跨实例共享的持久缓存。
  // 这是一次网络往返，只有高命中率时才划算
  'use cache: remote'
  cacheLife('days')
  cacheTag(`report:${tenantId}:${month}`)

  return computeExpensiveReport(tenantId, month)
}
```

`'use cache: remote'` 的取舍：

| | `'use cache'`（默认） | `'use cache: remote'` |
|---|---|---|
| 存储位置 | 每实例内存 LRU | 跨实例共享的持久存储 |
| 命中率 | 低（实例多了就分散） | 高 |
| 读取成本 | 内存，接近零 | **一次网络往返** |
| 适用 | 计算便宜、命中率天然高 | 计算昂贵、必须共享 |

**不要无脑上 `remote`。** 一次网络往返（1–5ms）乘以每次请求，可能比重新计算更贵。判断标准是「计算成本是否显著大于一次网络往返」。

### 自定义 cache handler 与多实例失效

自托管多实例部署时有一个必须处理的问题：**重新验证事件默认是本地（per-instance）的**。在实例 A 上调用 `updateTag`，只失效实例 A 的缓存，其他实例继续提供陈旧内容。

```ts
// cache-handler.js
const { Redis } = require('@upstash/redis')

const redis = Redis.fromEnv()

module.exports = class CacheHandler {
  constructor(options) {
    this.options = options
  }

  async get(key) {
    const entry = await redis.get(`cache:${key}`)
    return entry ?? null
  }

  async set(key, data, ctx) {
    await redis.set(`cache:${key}`, JSON.stringify({ value: data, tags: ctx.tags }), {
      ex: ctx.revalidate,
    })
  }

  async revalidateTag(tags) {
    const list = [tags].flat()
    // 把失效事件写到共享存储，让其他实例也能读到
    await redis.sadd('invalidated-tags', ...list)
  }

  async refreshTags() {
    // 这个方法必须捕获自己的错误。
    // 抛异常会让它变成请求失败；捕获后可以用「最后已知的本地标签状态」
    // 继续提供可能陈旧的内容，直到连接恢复
    try {
      const tags = await redis.smembers('invalidated-tags')
      return tags
    } catch {
      return []
    }
  }

  async getExpiration(key) {
    return redis.ttl(`cache:${key}`)
  }
}
```

```ts
// next.config.ts
const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheHandler: require.resolve('./cache-handler.js'),
  // 自托管下控制内存缓存大小
  cacheMaxMemorySize: 0,
}
```

两个必须注意的点：

**`refreshTags()` 里必须 `try/catch`。** 官方明确说明：如果它抛异常，异常会变成**请求失败**。捕获之后，请求可以用最后已知的本地标签状态继续——提供可能陈旧的内容，直到 Redis 连接恢复。这是「可用性优先于新鲜度」的取舍。

**`cacheMaxMemorySize: 0` 关闭内存缓存。** 既然已经上了共享存储，再保留一层内存缓存会让失效语义变复杂（内存层不知道自己被失效了）。要么全内存、要么全共享。

## 可观测性

### `instrumentation.ts`

```ts
// instrumentation.ts
import { registerOTel } from '@vercel/otel'

export function register() {
  registerOTel({ serviceName: 'saas-web' })
}
```

```bash
pnpm add @vercel/otel @opentelemetry/sdk-logs @opentelemetry/api-logs @opentelemetry/instrumentation
```

`register()` 在**一个新的 Next.js 服务实例启动时调用一次**，并且必须**在服务器开始处理请求之前完成**。这让它成为初始化 trace exporter、注册 instrumentation 库的正确位置。

`instrumentation.ts` 必须放在**项目根目录**（或者用 `src/` 时放在 `src/` 下），**不能**放在 `app/` 里。用 `pageExtensions` 加后缀时，这个文件名也要跟着改。

### 错误上报

`onRequestError` 覆盖**四类**服务端错误，`context.routeType` 会告诉你哪一类：

| `routeType` | 场景 |
|---|---|
| `'render'` | Server Components 渲染 |
| `'route'` | Route Handlers |
| `'action'` | Server Actions |
| `'proxy'` | Proxy |

```ts
// instrumentation.ts（片段）
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  // context 里还有几个排查时很有用的字段：
  // - routePath: '/app/blog/[dynamic]'（路由文件路径，不是实际 URL）
  // - renderSource: 'react-server-components' | 'react-server-components-payload' | 'server-rendering'
  // - revalidateReason: 'on-demand' | 'stale' | undefined
  //   undefined 表示这是一次普通的、没有触发重新验证的请求
  await report(err, { ...request, ...context })
}
```

**`revalidateReason` 这个字段值得单独用起来。** 它的值能直接回答「这次请求是普通请求，还是因为缓存陈旧而重建，还是因为有人调了 `revalidateTag`」。缓存相关的线上问题，靠这一个字段就能定性。

**`digest` 是识别原始错误类型的关键。** Server Components 渲染时的错误可能已经被 React 处理过，`err` 不是原始实例。官方明确说明：这种情况下用 `error.digest` 来识别实际的错误类型。

### 业务指标

```ts
// lib/metrics.ts
import 'server-only'

const counters = new Map<string, number>()

export function increment(metric: string, labels: Record<string, string> = {}) {
  const key = `${metric}:${JSON.stringify(labels)}`
  counters.set(key, (counters.get(key) ?? 0) + 1)
}

export function snapshot() {
  return Object.fromEntries(counters)
}
```

这个实现在**单实例**下能用，多实例下每个实例一份——**多区域部署时它就是错的**。生产环境要发到共享的 metrics 后端（Prometheus / OTLP collector）。

要埋的业务指标，按多租户场景排序：

| 指标 | 标签 | 用途 |
|---|---|---|
| 缓存命中率 | `region`, `route`, `hit` | 命中率骤降说明缓存键变了 |
| 租户级请求量 | `tenantId`, `plan` | 用量计费、发现异常租户 |
| 跨区域请求数 | `fromRegion`, `toRegion` | 数据驻留违规的早期信号 |
| Server Action 失败率 | `action`, `routeType` | 权限或校验问题 |
| 数据库查询 P99 | `tenantId`, `query` | 大租户拖慢所有人 |

**「跨区域请求数」这个指标在多租户场景里特别重要。** 它的非零值意味着某个请求去了不该去的区域——可能是缓存键漏了区域维度，也可能是数据源选择逻辑有 bug。**它应该长期维持在零。**

## 常见坑

- **现象**：用了 `export const preferredRegion = 'eu-central'`，构建时报废弃警告。
  **原因**：`preferredRegion` 路由段配置在 16 里**已废弃**。它把部署拓扑写进了应用代码。
  **解法**：区域选择交给平台配置。应用代码只从环境变量读当前区域。

- **现象**：Multi-Zones 拆分后，博客页面的 JS/CSS 全部 404。
  **原因**：只转发 HTML 路径，忘了转发 `assetPrefix` 下的静态资源路径。
  **解法**：rewrite 里加上 `{ source: '/blog-static/:path+', destination: '...' }`。这是最容易漏的一条。

- **现象**：从主应用点进博客页面时整页刷新，体验割裂。
  **原因**：跨 zone 导航必然是硬导航。两个 zone 的客户端路由互不知情。
  **解法**：这是 Multi-Zones 的固有特性。调整 zone 边界，把频繁互跳的页面放进同一个 zone。跨 zone 链接用原生 `<a>`，不要用 `<Link>`（预取会 404）。

- **现象**：自托管多实例下，一台实例上更新了内容，其他实例还返回旧数据。
  **原因**：重新验证事件默认是**本地的**。
  **解法**：实现自定义 cache handler，用 `revalidateTag()` 把失效事件写进共享存储，用 `refreshTags()` 定期读取。

- **现象**：自定义 cache handler 的 `refreshTags()` 抛异常后，整个站点的请求开始失败。
  **原因**：`refreshTags()` 抛出的异常会变成请求失败。
  **解法**：在 `refreshTags()` 内部 `try/catch`，失败时返回最后已知的标签状态（可以是空数组）。可用性优先于新鲜度。

- **现象**：`'use cache'` 的缓存命中率在 serverless 上极低，几乎每次都重算。
  **原因**：默认共享存储是**每实例的内存 LRU**，serverless 实例是临时的。
  **解法**：计算昂贵的场景用 `'use cache: remote'`。计算便宜的场景接受低命中率——加 `remote` 反而更慢。

- **现象**：`instrumentation.ts` 放在 `app/` 目录里没有生效。
  **原因**：这个文件必须在**项目根目录**（或 `src/` 下），和 `app/` 同级。
  **解法**：移到根目录。另外注意 `pageExtensions` 如果加了后缀，这个文件名也要改。

- **现象**：错误上报里拿到的 `err` 不是自己抛的那个错误对象。
  **原因**：Server Components 渲染时的错误可能已经被 React 包装过。
  **解法**：用 `error.digest` 识别原始错误类型。官方文档明确说明了这一点。

- **现象**：多区域部署后，某些区域的请求明显更慢。
  **原因**：那些区域的进程离主库最远。计算铺开了，数据没铺开。
  **解法**：给请求分类——只读且能容忍轻微陈旧的走就近只读副本；写操作和强一致读路由到主库所在区域。这需要在应用层做路由决策，不是部署配置能解决的。

- **现象**：缓存里的租户数据跨区域串了。
  **原因**：`cacheTag` 里带了 `tenantId` 但没带 `region`。同一个租户在迁移区域的过程中，两个区域的数据都挂在同一个标签下。
  **解法**：标签写全 `posts:${region}:${tenantId}`。同时把「跨区域请求数」作为长期监控指标——它应该恒为零。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 指定部署区域 | `export const preferredRegion = 'eu-central'` | **已废弃**，交给平台配置 + 环境变量 |
| 区域感知 | 应用代码声明区域 | 应用读 `process.env.VERCEL_REGION` |
| 强制静态 | `export const dynamic = 'force-static'` | `'use cache'` + `cacheLife('max')` |
| 定时重建 | `export const revalidate = 3600` | `cacheLife('hours')` |
| 缓存处理 | `unstable_cache` | **`'use cache'` / `'use cache: remote'`** |
| 运行时 | 可配 `runtime = 'edge'` | **固定 Node.js runtime**（Cache Components 依赖它） |
| 打包器 | webpack | **Turbopack 默认** |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 2、3、5 条。

## API / 配置速查

| API / 配置 | 签名 | 说明 |
|---|---|---|
| `register()` | `() => void \| Promise<void>` | 服务实例启动时调一次，必须早于请求处理 |
| `onRequestError` | `(err, request, context) => void \| Promise<void>` | 覆盖 `render` / `route` / `action` / `proxy` 四类错误 |
| `context.routeType` | `'render' \| 'route' \| 'action' \| 'proxy'` | 错误发生的场景 |
| `context.revalidateReason` | `'on-demand' \| 'stale' \| undefined` | `undefined` = 普通请求，不是重新验证触发的 |
| `error.digest` | `string \| undefined` | 识别被 React 包装过的原始错误 |
| `registerOTel({ serviceName, attributes })` | — | 来自 `@vercel/otel` |
| `assetPrefix` | `string` | Multi-Zones 下每个 zone 必须唯一 |
| `rewrites()` | `() => Rewrite[]` | 跨 zone 路由；**别忘了静态资源那一条** |
| `experimental.serverActions.allowedOrigins` | `string[]` | Multi-Zones 下必须显式声明用户域名 |
| `'use cache: remote'` | 指令 | 跨实例共享缓存，代价是一次网络往返 |
| `cacheHandler` | `string`（模块路径） | 自定义缓存后端，多实例自托管必需 |
| `cacheMaxMemorySize` | `number` | 自托管下控制内存缓存；上共享存储时设 `0` |

| 缓存层 | 存储位置 | 失效粒度 |
|---|---|---|
| CDN 边缘 | 平台边缘节点 | 部署 / `Cache-Control` |
| 平台持久缓存 | 平台存储 | `revalidateTag` / `updateTag` / `cacheLife` |
| `'use cache'` 默认 | **每实例内存 LRU** | 实例内 |
| `'use cache: remote'` | 跨实例共享 | 全局（需 cache handler 配合） |

| 路由段配置（16 现状） | 状态 |
|---|---|
| `dynamicParams` | 可用，默认 `true` |
| `runtime` | 可用，`'edge'` **已废弃** |
| `preferredRegion` | **已废弃** |
| `maxDuration` | 可用，由平台设定 |
| `dynamic` / `revalidate` / `fetchCache` | **`cacheComponents` 开启后已移除** |

## 延伸阅读

- [官方文档：Deploying](https://nextjs.org/docs/app/getting-started/deploying)
- [官方文档：Multi-Zones](https://nextjs.org/docs/app/guides/multi-zones)
- [官方文档：OpenTelemetry](https://nextjs.org/docs/app/guides/open-telemetry)
- [官方文档：`instrumentation.ts`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)
- [官方文档：Self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [官方文档：CDN and ISR caching](https://nextjs.org/docs/app/guides/cdn-caching)
- [官方文档：Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)
- [官方文档：`use cache: remote`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote)
- [`@vercel/otel`](https://www.npmjs.com/package/@vercel/otel)
- [OpenTelemetry 官方文档](https://opentelemetry.io/docs/)
- [Next.js 示例：with-zones](https://github.com/vercel/next.js/tree/canary/examples/with-zones)
