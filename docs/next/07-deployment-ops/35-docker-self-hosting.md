# 35 · Docker 与自托管

> **一句话结论**：`output: 'standalone'` + 多阶段 Dockerfile 是自托管的标准组合，镜像能压到几百 MB。但真正难的不是镜像，是**多实例一致性**：默认缓存是每实例内存，`revalidateTag()` 只失效当前实例，其他实例会继续吐旧内容直到各自发现失效。解法是实现自定义 `cacheHandler` 并实现 `refreshTags()`，从共享存储同步标签。

## 最小可运行示例

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // 多实例部署时用于版本偏移保护
  deploymentId: process.env.DEPLOYMENT_ID,
}

export default nextConfig
```

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable pnpm && pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
docker build -t my-app .
docker run -p 3000:3000 -e NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$KEY" my-app
```

三个 `COPY` 缺一不可。少了 `public` 静态资源 404，少了 `.next/static` 样式全丢，少了 `.next/standalone` 连服务器都起不来。

## 为什么 standalone 能压这么小

默认的 `.next/` 产物需要完整 `node_modules` 才能运行——因为 Next.js 无法预知哪些依赖会被用到，只能要求你全装上。一个中等项目的 `node_modules` 几百 MB 到 1 GB，镜像也跟着这么大。

`standalone` 用 [`@vercel/nft`](https://github.com/vercel/nft) 静态分析 `import` / `require` / `fs` 的实际用法，算出每条路由真正会加载哪些文件，然后只把这些文件复制到 `.next/standalone/`。`node_modules` 被裁成一个子集。

产物结构：

```
.next/standalone/
├─ server.js              # 最小 HTTP 服务器，替代 next start
├─ package.json
├─ .next/
│  ├─ server/             # 服务端 bundle
│  ├─ next-server.js.nft.json
│  └─ static/             # 需要手动复制进来
├─ node_modules/          # 裁剪后的子集
└─ public/                # 需要手动复制进来
```

`server.js` 是个极简 HTTP 服务器，只做路由分发和请求处理，不带 CLI、不带构建逻辑。

**它不会自动复制 `public/` 和 `.next/static/`。** 官方设计上认为这两个目录应该由 CDN 提供，本地服务进程不该承担静态文件服务。所以 Dockerfile 里要手动 `COPY` 进去——不复制的话页面 HTML 能返回，但 CSS 和图片全 404，这是 standalone 最常见的坑。

静态分析必然有误判。两种补救：

```js
// next.config.js
module.exports = {
  outputFileTracingIncludes: {
    // 原生二进制、运行时读取的 JSON、模板文件
    '/*': ['node_modules/sharp/**/*', 'src/i18n/locales/**/*.json'],
  },
  outputFileTracingExcludes: {
    '/api/hello': ['./un-necessary-folder/**/*'],
  },
}
```

键是路由 glob（`/api/hello`、`/products/*`、`/*` 表示全部），值是相对项目根的文件 glob。**只在服务端 trace 上生效**——Edge runtime 路由和完全静态页面不受影响。

monorepo 里 tracing 默认以 Next.js 项目目录为根，仓库里其他包的文件不会被包含：

```js
// packages/web-app/next.config.js
const path = require('path')

module.exports = {
  outputFileTracingRoot: path.join(__dirname, '../../'),
}
```

## 缓存配置

默认情况下，缓存资源存在**内存（上限 50 MB）和磁盘**上。在临时计算平台上磁盘通常不持久，所以缓存实际上是「短暂的、按实例隔离的」。在 K8s 上，每个 pod 持有一份独立的缓存副本。

要换成外部存储：

```js
// next.config.js
module.exports = {
  cacheHandler: require.resolve('./cache-handler.js'),
  cacheMaxMemorySize: 0, // 关掉默认内存缓存
}
```

```js
// cache-handler.js —— 官方文档给出的起点实现
const cache = new Map()

module.exports = class CacheHandler {
  constructor(options) {
    this.options = options
  }

  async get(key) {
    return cache.get(key)
  }

  async set(key, data, ctx) {
    cache.set(key, {
      value: data,
      lastModified: Date.now(),
      tags: ctx.tags,
    })
  }

  async revalidateTag(tags) {
    tags = [tags].flat()
    for (let [key, value] of cache) {
      if (value.tags.some((tag) => tags.includes(tag))) {
        cache.delete(key)
      }
    }
  }

  resetRequestCache() {}
}
```

> 这是**起点不是成品**。生产要补持久化存储、驱逐策略、错误处理、分布式标签协调。Redis 参考实现见 [cache-handler-redis](https://github.com/vercel/next.js/tree/canary/examples/cache-handler-redis)。

`revalidatePath` 是建在标签之上的便利层：调用它等同于用该页面的特殊默认标签调 `revalidateTag`。

如果给 `'use cache'` 指令配后端，用 `cacheHandlers`（复数）而不是 `cacheHandler`：

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheHandlers: {
    default: require.resolve('./cache-handlers/default-handler.js'),
    remote: require.resolve('./cache-handlers/remote-handler.js'),
  },
}
export default nextConfig
```

| 键 | 对应指令 |
|---|---|
| `default` | `'use cache'` |
| `remote` | `'use cache: remote'` |
| 自定义名（如 `sessions`） | `'use cache: <name>'` |

`'use cache: private'` **不走 cache handler**，无法自定义——它的作用域只在浏览器。

`CacheHandler` 接口的五个方法：

| 方法 | 签名 | 说明 |
|---|---|---|
| `get` | `(cacheKey: string, softTags: string[]) => Promise<CacheEntry \| undefined>` | 未命中或已过期返回 `undefined` |
| `set` | `(cacheKey: string, pendingEntry: Promise<CacheEntry>) => Promise<void>` | **必须先 `await` 这个 promise** |
| `refreshTags` | `() => Promise<void>` | 每个新请求前调用，与外部标签服务同步 |
| `getExpiration` | `(tags: string[]) => Promise<number>` | `0` 表示从未 revalidate；时间戳表示最近一次；`Infinity` 表示自己处理 soft tag |
| `updateTags` | `(tags: string[], durations?: { expire?: number }) => Promise<void>` | `revalidateTag()` 触发时调用 |

`CacheEntry` 的形状：

```ts
// CacheEntry —— 缓存条目的结构（官方 API 参考）
interface CacheEntry {
  value: ReadableStream<Uint8Array>
  tags: string[]
  stale: number
  timestamp: number
  expire: number
  revalidate: number
}
```

`value` 是 `ReadableStream`。要同时「存下来」和「返回给调用方」就用 `.tee()`。大页面会产生大条目，S3 类后端建议直接流式写入，别全量缓冲。

## 多实例一致性

这是自托管最核心的问题。

**默认行为**：在一个实例上调 `revalidateTag()` **只会失效该实例的缓存**。其他实例会继续提供陈旧内容，直到它们各自独立发现失效（比如 TTL 到期）。

### 解法：`refreshTags()` + 共享存储

`refreshTags()` 在**每个请求之前**被调用。在分布式缓存里实现它，从共享存储同步标签状态：

```js
// cache-handlers/distributed-tags.js
const { createClient } = require('redis')

const client = createClient({ url: process.env.REDIS_URL })
client.connect()

const localTagTimestamps = new Map()

module.exports = {
  // get() / set() 略

  async refreshTags() {
    const tagKeys = await client.sMembers('revalidated-tags')
    if (tagKeys.length > 0) {
      const values = await client.mGet(tagKeys.map((k) => `tag:${k}`))
      for (let i = 0; i < tagKeys.length; i++) {
        localTagTimestamps.set(tagKeys[i], Number(values[i]))
      }
    }
  },

  async getExpiration(tags) {
    const timestamps = tags.map((tag) => localTagTimestamps.get(tag) || 0)
    return Math.max(...timestamps, 0)
  },

  async updateTags(tags, durations) {
    const now = Date.now()
    const pipeline = client.multi()
    for (const tag of tags) {
      pipeline.set(`tag:${tag}`, String(now))
      pipeline.sAdd('revalidated-tags', tag)
      localTagTimestamps.set(tag, now)
    }
    await pipeline.exec()
  },
}
```

协调流程：`updateTags()` 把失效时间戳写进共享存储 → 每个实例在请求前通过 `refreshTags()` 拉取 → `getExpiration()` 返回最新时间戳 → 缓存条目时间戳早于它就被判定过期。

**soft tags** 也要处理。它们是 Next.js 根据路由路径自动生成的隐式标签，用来支持 `revalidatePath()`。例如 `/blog/hello` 会生成 `/layout`、`/blog/layout`、`/blog/hello/layout`、`/blog/hello`（内部带 `_N_T_` 前缀）。这些通过 `get()` 的 `softTags` 参数传进来；如果某个 soft tag 的失效时间晚于条目的 `timestamp`，该条目应视为过期。

### 多实例部署的完整清单

| 项 | 配置 | 不做的后果 |
|---|---|---|
| 缓存存储 | 自定义 `cacheHandler` + Redis 等 | 每实例一份缓存，内存浪费且不一致 |
| 标签同步 | 实现 `refreshTags()` | `revalidateTag()` 只失效当前实例 |
| 跨实例数据 | `'use cache: remote'` | 内存缓存不跨实例共享 |
| 加密密钥 | 所有实例同一个 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | 滚动部署时报 "Failed to find Server Action" |
| 版本偏移 | 配 `deploymentId` | 新旧版本混跑时行为错乱 |

`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 要求是 base64 编码的 AES 密钥，长度 16 / 24 / 32 字节，Next.js 默认生成 32 字节。

`deploymentId` 的作用是滚动部署期间做版本偏移保护：客户端和新旧实例的 build ID 不匹配时，触发整页硬导航而不是让新旧协议混用。**注意设了 `deploymentId` 之后 `generateBuildId` 会失效**——两者互斥。

## 反向代理与运行时配置

**必须放在 Next.js 前面**。反向代理负责处理畸形请求、慢连接攻击、载荷限制、限流——这些不该让应用进程扛。

```nginx
# nginx.conf —— 流式渲染必需
proxy_buffering off;
add_header X-Accel-Buffering no;
```

不关缓冲的话，流式渲染会被代理攒起来一次性发出——用户看到的还是「等全部数据好了一次性出现」，`<Suspense>` 的渐进式体验全没了。负载均衡器也要支持分块传输或 HTTP/2 流式。

**优雅停止**：`next start` 收到 `SIGINT` / `SIGTERM` 后会等待在途请求完成。K8s 里要给足排空时间，**推荐 10–30 秒**。`after` API 依赖这个机制——如果进程被立即杀掉，`after` 里的收尾逻辑不会执行。

**图片优化**用 `next start` 部署时零配置可用。glibc 基础的 Linux 上可能需要额外配置 [sharp 的内存分配器](https://sharp.pixelplumbing.com/install#linux-memory-allocator) 防止内存占用过高：

```dockerfile
# Dockerfile —— 安装 sharp 依赖
RUN apk add --no-cache vips-dev
```

或用 `outputFileTracingIncludes` 确保原生二进制被打进 trace：

```js
// next.config.js
module.exports = {
  outputFileTracingIncludes: {
    '/*': ['node_modules/sharp/**/*'],
  },
}
```

**环境变量**默认只在服务端可用，`NEXT_PUBLIC_` 前缀的会在构建时内联。**自托管的一个常见失误**是把该按环境变化的值用了 `NEXT_PUBLIC_`——那样一个镜像没法在多环境间复用。需要运行时读取就用 `await connection()` 把路由标记为动态，再在服务端读普通变量。

**CDN 场景**：动态 API 访问的页面带 `Cache-Control: private`，完全静态预渲染的带 `Cache-Control: public`。

**Build cache**：用 `generateBuildId`（如取 git hash）让容器间产出一致的 build ID。但配了 `deploymentId` 之后这个就无效了。

## 常见坑

- **现象**：容器起来了，页面 HTML 正常但没有任何样式，图片 404。
  **原因**：standalone 不会自动复制 `public/` 和 `.next/static/`。
  **解法**：Dockerfile 里加两个 `COPY`：`/app/public` → `./public`，`/app/.next/static` → `./.next/static`。

- **现象**：滚动部署期间用户点按钮报 "Failed to find Server Action"。
  **原因**：新旧实例的 Server Action 加密密钥不同。
  **解法**：所有实例注入同一个 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`；同时配 `deploymentId` 做版本偏移保护。

- **现象**：多实例部署后，后台改了内容，部分用户看到的还是旧数据，刷新也不一定好。
  **原因**：`revalidateTag()` 只失效当前实例的缓存。
  **解法**：实现自定义 `cacheHandler` 并实现 `refreshTags()`，从共享存储同步标签状态。

- **现象**：`<Suspense>` 的流式加载在线上看不到，本地正常。
  **原因**：反向代理开了响应缓冲。
  **解法**：nginx 设 `X-Accel-Buffering: no` 并关闭 `proxy_buffering`；确认 LB 支持 HTTP/2 或分块传输。

- **现象**：`after()` 里的逻辑有时不执行。
  **原因**：进程被立即杀死，没走优雅停止。
  **解法**：K8s 里配足 `terminationGracePeriodSeconds`（10–30 秒），确保 `SIGTERM` 后有时间排空。

- **现象**：部署后某个原生模块报找不到。
  **原因**：静态分析没追踪到它（动态 `require`、运行时读取的路径）。
  **解法**：用 `outputFileTracingIncludes` 显式加进来。

- **现象**：构建时 `NEXT_PUBLIC_API_URL` 是对的，换成另一个环境后值没变。
  **原因**：`NEXT_PUBLIC_` 在构建时内联，值被冻进 bundle。
  **解法**：这个变量不该用 `NEXT_PUBLIC_`。改成服务端读取 + `await connection()` 走动态渲染。

- **现象**：容器内存持续增长。
  **原因**：模块级 `Map` / 数组做缓存，或图片优化的磁盘缓存没设上限。
  **解法**：换 LRU 或外部缓存；`cacheMaxMemorySize: 0` 关掉默认内存缓存；`images.maximumDiskCacheSize` 设上限（不设时用启动时可用磁盘空间的 50%）。

## 旧写法 vs 新写法

| 场景 | 旧写法 | 新写法 |
|---|---|---|
| 服务端产物 | `target: 'serverless'` | **`output: 'standalone'`** |
| 启动方式 | `next start` | `node .next/standalone/server.js` |
| 缓存处理器 | `incrementalCacheHandlerPath` | `cacheHandler`；`'use cache'` 用 `cacheHandlers` |
| 缓存 API | `unstable_cacheLife` / `unstable_cacheTag` | **`cacheLife` / `cacheTag`** |
| 失效标签 | `revalidateTag('posts')` | **`revalidateTag('posts', 'max')`** |
| 立即生效 | — | `updateTag()`（仅 Server Actions） |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 4、5、6 条。

## API / 配置速查

| 配置 | 作用 |
|---|---|
| `output: 'standalone'` | 最小化服务端产物 |
| `outputFileTracingRoot` | monorepo tracing 根目录 |
| `outputFileTracingIncludes` / `Excludes` | 调整 trace 文件集 |
| `cacheHandler` | 增量缓存的自定义处理器 |
| `cacheMaxMemorySize` | 内存缓存上限，`0` 表示禁用 |
| `cacheHandlers.default` | `'use cache'` 的处理器 |
| `cacheHandlers.remote` | `'use cache: remote'` 的处理器 |
| `deploymentId` | 版本偏移保护（会让 `generateBuildId` 失效） |
| `generateBuildId` | 自定义 build ID（如 git hash） |
| `images.maximumDiskCacheSize` | 图片磁盘缓存上限，默认用可用空间的 50% |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | 多实例必须一致 |

| 环境变量 | 作用 |
|---|---|
| `PORT` | 监听端口，默认 3000 |
| `HOSTNAME` | 监听地址，默认 `0.0.0.0` |
| `NEXT_TELEMETRY_DISABLED=1` | 关闭遥测 |
| `NEXT_RUNTIME` | `nodejs` \| `edge` |

| CacheHandler 方法 | 签名 |
|---|---|
| `get` | `(cacheKey, softTags) => Promise<CacheEntry \| undefined>` |
| `set` | `(cacheKey, pendingEntry) => Promise<void>` |
| `refreshTags` | `() => Promise<void>` |
| `getExpiration` | `(tags) => Promise<number>` |
| `updateTags` | `(tags, durations?) => Promise<void>` |

## 延伸阅读

- [官方文档：Self-Hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [官方文档：output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [官方文档：cacheHandlers](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers)
- [官方文档：How Revalidation Works](https://nextjs.org/docs/app/guides/how-revalidation-works)
- [官方文档：Streaming（代理配置）](https://nextjs.org/docs/app/guides/streaming)
- [官方示例：with-docker](https://github.com/vercel/next.js/tree/canary/examples/with-docker)
- [官方示例：with-docker-multi-env](https://github.com/vercel/next.js/tree/canary/examples/with-docker-multi-env)
- [官方示例：cache-handler-redis](https://github.com/vercel/next.js/tree/canary/examples/cache-handler-redis)
- [Docker 官方 Next.js 指南](https://docs.docker.com/guides/nextjs)
