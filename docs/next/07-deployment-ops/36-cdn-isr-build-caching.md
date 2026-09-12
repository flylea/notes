# 36 · 平台缓存

> **一句话结论**：Next.js 按渲染策略自动设 `Cache-Control`，CDN 认这个头就能缓存。但**CDN 缓存和 `revalidateTag()` 是两套独立的失效机制**——调 `revalidateTag()` 只失效 Next.js 服务端缓存，CDN 会继续发它的副本直到 TTL 到期。要打通就得在失效时同步调 CDN 的 purge API。

## 最小可运行示例

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 用 git hash 做 build ID，保证容器间一致
  generateBuildId: async () => process.env.GIT_SHA ?? 'dev',
}
export default nextConfig
```

```ts
// app/actions.ts
'use server'

import { revalidateTag } from 'next/cache'

export async function publishPost(id: string) {
  await db.posts.publish(id)

  // 1. 失效 Next.js 服务端缓存
  revalidateTag(`post:${id}`, 'max')

  // 2. 同步失效 CDN 缓存（必须自己做，框架不会代劳）
  await fetch(`${process.env.CDN_PURGE_URL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CDN_PURGE_TOKEN}` },
    body: JSON.stringify({ tags: [`post:${id}`] }),
  })
}
```

第 2 步是这一章的核心。只做第 1 步，用户刷页面看到旧内容——而且刷新也没用，因为 CDN 的副本还在。

## `Cache-Control` 头怎么来的

Next.js 按每条路由的渲染策略设头：

| 路由类型 | `Cache-Control` |
|---|---|
| 静态页面（无重验证） | `s-maxage=31536000` |
| ISR 页面（基于时间的重验证） | `s-maxage={revalidate}, stale-while-revalidate={expire - revalidate}` |
| 动态页面（不缓存） | `private, no-cache, no-store, max-age=0, must-revalidate` |
| `/_next/static/` 下的静态资源 | `public, max-age=31536000, immutable` |

几个要点：

**`s-maxage` 是给共享缓存（CDN、代理）看的**，`max-age` 是给浏览器看的。Next.js 用 `s-maxage` 让 CDN 缓存，同时不污染浏览器缓存。

**ISR 的 `expire` 默认是一年**，所以 `stale-while-revalidate` 默认就会出现，值是 `expire - revalidate`。用 `cacheLife` 可以改这两个值。默认 `stale-while-revalidate` 存在意味着：TTL 到了之后 CDN 会先返回旧内容，同时在后台回源取新的——用户感知不到等待。

**动态页面带 `private`**，CDN 不会缓存它。这是安全的默认值：动态页面可能包含用户特定数据，缓存到共享层会造成数据串号。

**静态资源带 `immutable`**，文件名里有内容哈希，内容一变文件名就变，所以可以无限期缓存。

`assetPrefix` 可以把静态资源放到另一个域名或 CDN 源：

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  assetPrefix: 'https://cdn.example.com',
}
export default nextConfig
```

## CDN 缓存的难点：`Vary`

App Router 的响应会基于几个自定义请求头变化。Next.js 会设 `Vary` 头告诉 CDN：

| 请求头 | 作用 |
|---|---|
| `rsc` | 请求该返回 RSC 载荷还是 HTML |
| `next-router-state-tree` | 客户端当前的路由状态，用于动态导航时的定向段更新 |
| `next-router-prefetch` | 是否预取请求 |
| `next-router-segment-prefetch` | 具体在预取哪个段 |
| `next-url` | 只用于拦截路由，携带被拦截的 URL |

**很多 CDN 不支持 `Vary`**，或者需要额外配置。Next.js 的对策是 `_rsc` 查询参数：它是相关请求头值的哈希，充当缓存键，让不同响应变体落到不同键上。这样即使 CDN 忽略 `Vary`，也能返回正确内容。

### 必须保留的东西

**`rsc` 头必须从客户端转发到服务端。** 它告诉服务端返回 RSC 载荷而不是 HTML。CDN 把它剥掉，服务端就会在客户端路由器期待 RSC 数据时返回 HTML——客户端导航直接崩掉，退化成浏览器整页跳转。`Vary` 头和 `_rsc` 参数存在的全部意义就是防止 CDN 把缓存的 HTML 响应发给 RSC 请求。

**`_rsc` 参数必须进缓存键。** 有些 CDN 默认会从缓存键里剥掉查询参数——那样 HTML 和 RSC 会互相覆盖。确认你的 CDN 不剥。

**有 `next-router-prefetch` 时，预取头和 `_rsc` 都要保留。** 预取流程里 `_rsc` 是必需的缓存区分符。

**默认行为**：RSC 请求带着错误的 `_rsc` 值时，服务端返回 **307 重定向**到带正确哈希的 URL。CDN 要跟随这个重定向。可以在上游算好哈希并改写请求来省掉这次往返。要关掉这个行为：`experimental.validateRSCRequestHeaders: false`。

### 可以安全忽略的

| 头 | 省略的后果 |
|---|---|
| `next-router-state-tree` | 非预取的 RSC 请求返回完整载荷而非定向段更新——响应更大，功能正常 |
| `next-router-segment-prefetch` | 退化成更宽的预取载荷，而非段级预取 |
| `next-url` | **拦截路由不支持**，用户看到目标页而不是被拦截的页面。其余情况正常 |

注意最后一条：省略 `next-url` 会让拦截路由静默降级。不用拦截路由的话可以忽略。

### Proxy 和 CDN 的顺序

**`proxy.ts` 必须在 CDN 缓存之前运行**，这样它才是鉴权、重定向、改写的唯一事实来源。如果部署把 `proxy.ts` 放在 CDN 后面，就得让缓存层对「依赖 proxy 决策的路由」跳过缓存——否则一个未登录用户可能拿到已登录用户的缓存副本。

## ISR 的平台侧要求

ISR 要求平台能做三件事：

1. **在边缘缓存响应**，识别 `s-maxage` 和 `stale-while-revalidate`
2. **回源时能拿到新版本**，且回源请求不经过缓存
3. **支持按需失效**（这是难点）

第 3 点的困境：`revalidateTag()` / `revalidatePath()` 失效的是 Next.js **服务端**缓存，CDN 不知道。所以：

| 机制 | 谁负责 |
|---|---|
| `s-maxage` TTL 到期 | CDN 自己 |
| `stale-while-revalidate` 后台刷新 | CDN 自己 |
| `revalidateTag()` / `revalidatePath()` | **只有 Next.js 服务端** |
| CDN 副本失效 | **你得自己调 purge API** |

常见模式就是「调 `revalidateTag()` 失效服务端缓存 → 调 CDN purge API 失效边缘副本」。purge 时要**同时覆盖 HTML 和 RSC 变体**——两者是不同的缓存键。

多实例自托管时还有一层：服务端缓存本身也要跨实例协调。那需要自定义 `cacheHandler` 并实现 `refreshTags()`，见第 35 章。

### PPR 路由的静态预取

路由启用了 Partial Prerendering 且请求带 `next-router-prefetch` 头（静态预取）时，响应是**确定性的**——不管客户端路由状态如何，都返回同样的预渲染内容。`next-router-state-tree` 头对这些请求**不被解析**，所以不影响响应。

要让 CDN 缓存这类响应，需要：

1. 把 `_rsc` 查询参数纳入缓存键（区分预取变体和 HTML 响应）
2. 尊重 Next.js 设的 `Cache-Control`

没有 PPR 的路由则相反：预取请求会读 `next-router-state-tree` 决定包含哪些段，缓存需要 `vary` 的维度随当前路由状态变化。

启用 Cache Components 后，段级预取已经改用基于路径名的路由（如 `/page.segments/_tree.segment.rsc`），CDN 用标准路径名缓存键就能缓存。

### 方向：基于路径名的缓存键

Next.js 团队在做的事是把所有影响缓存的输入都挪进 URL 路径名，从而彻底去掉对自定义头的 `Vary` 依赖和 `_rsc` 参数。

文件扩展名标识响应类型：

| 路径 | 返回 |
|---|---|
| `/my/page.rsc` | 整页的 RSC 载荷 |
| `/my/page.segments/path/to/segment.segment.rsc` | 特定段的 RSC 载荷 |

这个模型下：

- **路径名就是缓存键**，路径里的任何东西都影响返回哪个变体
- **查询参数可以安全丢弃**，不影响响应
- **标准 HTTP 缓存头**（`Cache-Control`、`max-age`）照常生效
- **CDN 不需要支持 `Vary`**

拦截路由会变成把可变性编码进**查询参数**（不是路径名）：CDN 保留查询参数则拦截正常工作；丢弃则优雅降级到非拦截页面，客户端导航不会坏。这样拦截路由的支持就变成 CDN 的可选能力，而不是硬要求。

这个方向目前**还在设计中**，不是已发布行为。它扩展的是代码库里已经在跑的模式（段预取路径、`output: 'export'`）。

## CI 构建缓存

### build ID 一致性

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  generateBuildId: async () => process.env.GIT_SHA ?? 'dev',
}
export default nextConfig
```

默认的 build ID 是随机生成的，多容器构建会得到不同 ID，客户端跨实例导航时可能触发不必要的整页重载。用 git commit hash 让同一份代码产出一致的 ID。

**但配了 `deploymentId` 之后 `generateBuildId` 就无效了**——`deploymentId` 取代了它的职责。两者选一个：

| 目标 | 用哪个 |
|---|---|
| 容器间 build ID 一致 | `generateBuildId` |
| 滚动部署的版本偏移保护 | `deploymentId` |

### Turbopack 文件系统缓存

Turbopack 的文件系统缓存默认开启，CI 里持久化缓存目录能显著加速重复构建。相关配置项：

| 配置 | 作用 |
|---|---|
| `turbopackFileSystemCache` | Turbopack 构建的文件系统缓存 |
| `turbopackMemoryEviction` | 持久缓存的内存驱逐策略 |
| `turbopackChunking` | 生产环境客户端 JS 分块 |

CI 里缓存哪些目录：

```yaml
# .github/workflows/build.yml 片段
- uses: actions/cache@v4
  with:
    path: |
      .next/cache
      .next/dev
    key: ${{ runner.os }}-nextjs-${{ hashFiles('pnpm-lock.yaml') }}-${{ hashFiles('**/*.ts', '**/*.tsx') }}
    restore-keys: |
      ${{ runner.os }}-nextjs-${{ hashFiles('pnpm-lock.yaml') }}-
```

`restore-keys` 是关键的降级策略：源码变了导致精确 key 不命中时，用只基于 lockfile 的 key 拿到一个稍旧的缓存——比完全没有缓存好得多。

`.next/cache` 存的是构建期缓存（包括 ISR 预渲染结果和 fetch 缓存）。缓存它能让「代码没变的页面」跳过重新渲染。

### 构建缓存要注意的

**不要缓存 `.next/standalone` 和 `.next/static`**——它们是产物，不是缓存。缓存它们会导致用了旧产物。

**构建期缓存和运行时缓存是两回事。** `.next/cache` 是构建时的，运行时缓存由 `cacheHandler` 管。CI 缓存解决的是「构建慢」，`cacheHandler` 解决的是「多实例不一致」。

**预渲染页面多的时候构建内存峰值高。** 所有页面并发渲染，内存占用显著高于运行时。CI runner 要给够内存，或者用 `--debug-build-paths` 缩小范围排查。

## 常见坑

- **现象**：后台改了内容，调了 `revalidateTag()`，用户刷新页面还是旧内容。
  **原因**：CDN 的副本没失效——`revalidateTag()` 只作用于 Next.js 服务端缓存。
  **解法**：失效时同步调 CDN purge API，且要覆盖 HTML 和 RSC 两种变体。

- **现象**：CDN 打开后客户端导航变成整页刷新。
  **原因**：CDN 剥掉了 `rsc` 请求头，或者从缓存键里丢了 `_rsc` 参数，导致 HTML 响应被发给了 RSC 请求。
  **解法**：确认 CDN 转发 `rsc` 头；确认 `_rsc` 进缓存键；确认 CDN 不剥查询参数。

- **现象**：拦截路由（`@modal` 之类）在 CDN 后失效，用户看到目标页而不是弹层。
  **原因**：`next-url` 头被省略，服务端不知道原始路径。
  **解法**：保留 `next-url`，或接受降级（不用拦截路由的话没影响）。

- **现象**：登录用户看到了别人的缓存内容。
  **原因**：`proxy.ts` 在 CDN 后面，或者缓存层没对依赖 proxy 决策的路由跳过缓存。
  **解法**：让 `proxy.ts` 跑在 CDN 缓存之前；或配置缓存层绕过这些路由。

- **现象**：RSC 请求收到 307 重定向，多一次往返。
  **原因**：`_rsc` 值不匹配，服务端的默认保护行为。
  **解法**：让 CDN 跟随重定向；或在上游算好哈希并改写请求。要彻底关掉：`experimental.validateRSCRequestHeaders: false`。

- **现象**：CI 构建时间没有随缓存改善。
  **原因**：`actions/cache` 的 key 里带了源码 hash，代码一改精确 key 就不命中，而 `restore-keys` 没配。
  **解法**：配 `restore-keys` 做降级匹配，只用 lockfile 做 key 前缀。

- **现象**：ISR 页面 TTL 到了但用户仍看到旧内容很久。
  **原因**：`expire` 默认是一年，`stale-while-revalidate` 的窗口很长，CDN 会持续发旧副本。
  **解法**：用 `cacheLife` 调整 `revalidate` 和 `expire`，让窗口符合业务可接受的新鲜度。

## 旧写法 vs 新写法

| 场景 | 旧写法 | 16 写法 |
|---|---|---|
| 缓存生命周期 | `export const revalidate = 60` | `cacheLife('minutes')` |
| 失效标签 | `revalidateTag('posts')` | **`revalidateTag('posts', 'max')`** |
| 缓存 API | `unstable_cacheLife` / `unstable_cacheTag` | **`cacheLife` / `cacheTag`** |
| 立即生效 | — | `updateTag()`（仅 Server Actions） |
| 静态预取缓存 | `next-router-state-tree` 影响缓存维度 | 基于路径名的缓存键（`/page.segments/...`） |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 4、5、6 条。

## API / 配置速查

| 头 | 值 | 适用 |
|---|---|---|
| `Cache-Control`（静态页） | `s-maxage=31536000` | 无重验证的静态页 |
| `Cache-Control`（ISR） | `s-maxage={revalidate}, stale-while-revalidate={expire - revalidate}` | 基于时间的重验证 |
| `Cache-Control`（动态页） | `private, no-cache, no-store, max-age=0, must-revalidate` | 不缓存 |
| `Cache-Control`（静态资源） | `public, max-age=31536000, immutable` | `/_next/static/` |

| 请求头 | 必须保留 | 省略后果 |
|---|---|---|
| `rsc` | **是** | 客户端导航崩溃 |
| `_rsc`（查询参数） | **是**，且进缓存键 | HTML / RSC 互相覆盖 |
| `next-router-prefetch` | 预取时是 | 预取载荷退化 |
| `next-router-state-tree` | 否 | 响应更大，功能正常 |
| `next-router-segment-prefetch` | 否 | 退化成更宽的预取 |
| `next-url` | 用拦截路由时是 | 拦截路由静默降级 |

| 配置 | 作用 |
|---|---|
| `assetPrefix` | 静态资源 CDN 前缀 |
| `generateBuildId` | 自定义 build ID（git hash） |
| `deploymentId` | 版本偏移保护（会让 `generateBuildId` 失效） |
| `expireTime` | ISR 页面的 stale-while-revalidate 过期时间 |
| `experimental.validateRSCRequestHeaders` | `false` 关闭 `_rsc` 校验重定向 |
| `turbopackFileSystemCache` | Turbopack 文件系统缓存 |
| `turbopackMemoryEviction` | 持久缓存的内存驱逐 |
| `cacheLife` | 自定义 revalidate / expire |

## 延伸阅读

- [官方文档：CDN Caching](https://nextjs.org/docs/app/guides/cdn-caching)
- [官方文档：Deploying to Platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms)
- [官方文档：Self-Hosting（缓存配置）](https://nextjs.org/docs/app/guides/self-hosting)
- [官方文档：Incremental Static Regeneration](https://nextjs.org/docs/app/guides/incremental-static-regeneration)
- [官方文档：cacheLife](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheLife)
- [官方文档：revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
- [官方文档：How Revalidation Works](https://nextjs.org/docs/app/guides/how-revalidation-works)
