# 54 · 从零实现 SSG 与 ISR

> **一句话结论**：SSG 是"把渲染从请求期搬到构建期"，产出的就是磁盘上的 HTML 文件；ISR 是"给这个文件加一个保鲜期，过期后先发旧的、同时在后台重建"。落地只需要三样东西：一个磁盘缓存、一个"陈旧但可用"的判断、一个**不阻塞响应且会去重**的后台任务——最后那个去重是绝大多数手写实现会漏掉的一环。

## 最小可运行示例

分三块：构建期预渲染、请求期读取、后台重建。

先定义页面。它接收已经取好的数据，自己不取数——这样构建期和重建期能用同一份组件。

```tsx
// src/PostPage.tsx
export type Post = { slug: string; title: string; body: string }

export function PostPage({ post }: { post: Post }) {
  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
    </article>
  )
}
```

数据层负责取数，构建期和重建期都调它。

```ts
// src/data.ts
import type { Post } from './PostPage'

const posts: Record<string, Post> = {
  hello: { slug: 'hello', title: 'Hello', body: '第一篇。' },
  isr: { slug: 'isr', title: 'ISR', body: '先给旧的，后台重建。' },
}

// 故意慢一点，用来演示"为什么不能在请求路径上同步等它"
async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function getAllSlugs(): Promise<string[]> {
  return Object.keys(posts)
}

export async function getPost(slug: string): Promise<Post | null> {
  await delay(80)
  return posts[slug] ?? null
}
```

文档组件把 HTML 骨架包起来——`prerenderToNodeStream` 期望渲染出的是一整个文档。

```tsx
// src/Document.tsx
import type { ReactNode } from 'react'

export function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <title>博客</title>
      </head>
      <body>
        <div id="root">{children}</div>
        <script type="module" src="/src/entry-client.tsx" />
      </body>
    </html>
  )
}
```

### 构建期：把每个页面渲染成文件

```ts
// scripts/build.ts
import { mkdir, writeFile } from 'node:fs/promises'
import { prerenderToNodeStream } from 'react-dom/static'
import type { ReactElement } from 'react'
import { Document } from '../src/Document'
import { PostPage } from '../src/PostPage'
import { getAllSlugs, getPost } from '../src/data'

// prerenderToNodeStream 会等所有数据加载完才 resolve，
// 这是它和 renderToString 的核心区别
async function renderToHtml(element: ReactElement): Promise<string> {
  const { prelude } = await prerenderToNodeStream(element)
  const chunks: Buffer[] = []
  for await (const chunk of prelude) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf-8')
}

async function main() {
  const slugs = await getAllSlugs()
  await mkdir('dist', { recursive: true })

  await Promise.all(
    slugs.map(async (slug) => {
      const post = await getPost(slug)
      if (!post) return

      const html = await renderToHtml(
        <Document>
          <PostPage post={post} />
        </Document>
      )
      await writeFile(`dist/${slug}.html`, html, 'utf-8')
    })
  )

  console.log(`预渲染完成：${slugs.length} 个页面`)
}

main()
```

```bash
# 跑一次构建
pnpm tsx scripts/build.ts
ls dist
# hello.html  isr.html
```

现在 `dist/*.html` 是完整的、可直接丢 CDN 的静态文件。**请求期不再有 React**。

### 请求期：读文件 + 陈旧判断 + 后台重建

```ts
// server.ts
import { createServer } from 'node:http'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { prerenderToNodeStream } from 'react-dom/static'
import { Document } from './src/Document'
import { PostPage } from './src/PostPage'
import { getPost } from './src/data'

const REVALIDATE_MS = 60_000

type CacheEntry = { html: string; ageMs: number }

async function readCache(slug: string): Promise<CacheEntry | null> {
  try {
    const [html, info] = await Promise.all([
      readFile(`dist/${slug}.html`, 'utf-8'),
      stat(`dist/${slug}.html`),
    ])
    return { html, ageMs: Date.now() - info.mtimeMs }
  } catch {
    return null
  }
}

async function render(slug: string): Promise<void> {
  const post = await getPost(slug)
  if (!post) return

  const { prelude } = await prerenderToNodeStream(
    <Document>
      <PostPage post={post} />
    </Document>
  )
  const chunks: Buffer[] = []
  for await (const chunk of prelude) chunks.push(Buffer.from(chunk))
  await writeFile(`dist/${slug}.html`, Buffer.concat(chunks))
}

// 单飞（single-flight）：同一个 slug 同时只允许一个重建在跑
const inFlight = new Map<string, Promise<void>>()

function revalidate(slug: string): Promise<void> {
  const running = inFlight.get(slug)
  if (running) return running

  const task = render(slug)
    .catch((error) => console.error(`重建 ${slug} 失败`, error))
    .finally(() => inFlight.delete(slug))

  inFlight.set(slug, task)
  return task
}

createServer(async (req, res) => {
  const slug =
    (req.url ?? '/').replace(/^\//, '').replace(/\.html$/, '') || 'index'

  let cached = await readCache(slug)

  if (!cached) {
    // 缓存未命中：同步等一次构建，再返回（对应 fallback: 'blocking'）
    await revalidate(slug)
    cached = await readCache(slug)
    if (!cached) {
      res.statusCode = 404
      res.end('Not Found')
      return
    }
    res.setHeader('X-Cache', 'MISS')
  } else if (cached.ageMs > REVALIDATE_MS) {
    // 陈旧但可用：先发旧的，重建在后台跑，不 await
    void revalidate(slug)
    res.setHeader('X-Cache', 'STALE')
  } else {
    res.setHeader('X-Cache', 'HIT')
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // 让 CDN 也能做同样的 stale-while-revalidate
  res.setHeader(
    'Cache-Control',
    `s-maxage=${REVALIDATE_MS / 1000}, stale-while-revalidate=${(REVALIDATE_MS * 10) / 1000}`
  )
  res.end(cached.html)
}).listen(3000, () => {
  console.log('http://localhost:3000/hello')
})
```

验证方式很简单：连续请求两次，第一次 `X-Cache: HIT`；等 60 秒后再请求一次，这一次仍然是 `X-Cache: STALE` 但内容立刻返回——**重建已经在你收到响应的同时开始了**。

## 内部机制

### SSG 省下的是什么

对比 [53](./53-build-minimal-ssr.md) 的请求期 SSR：

| | 请求期 SSR | 构建期 SSG |
|---|---|---|
| 每个请求的 CPU | 一次完整渲染 | **零** |
| TTFB | 取数 + 渲染的时间 | 读文件的时间（可被 CDN 压到边缘） |
| 数据新鲜度 | 实时 | 构建那一刻的快照 |
| 扩容方式 | 加服务器 | 加 CDN 节点 |
| 内容变更 | 自动 | **要重新构建** |

最后一行是 SSG 的硬伤：内容一改就得重新部署。ISR 就是为这一行打的补丁——**不重新部署，也能换掉那个文件**。

### ISR 就是 HTTP 的 `stale-while-revalidate`

ISR 这个名字是 Next.js 起的，但它描述的行为是 HTTP 缓存规范里的 `stale-while-revalidate`：

```
内容生成 ────── revalidate ────── expire ──────→ 时间
    │               │                │
    │  直接返回缓存   │  返回缓存 +      │  同步等新内容
    │  （新鲜）      │  后台重建        │  （阻塞）
```

三个区间的语义完全不同：

| 区间 | 用户拿到什么 | 服务端做什么 |
|---|---|---|
| `age < revalidate` | 缓存内容，无额外延迟 | 什么都不做 |
| `revalidate < age < expire` | 缓存内容，无额外延迟 | 触发一次后台重建（不阻塞响应） |
| `age > expire` 且期间无流量 | 等新内容（**TTFB 变长**） | 同步重建，等它完成再返回 |

第三行是很多人忽略的：如果内容冷了很久（没人访问导致后台重建从没被触发），下一个访客就要**等**。`expire` 定义的是"超过这个点之后，内容正确性比速度更重要"。

对应到 Cache Components 的 `cacheLife` profile，这三个字段就是 `revalidate` 和 `expire`：

```ts
// app/lib/data.ts
import { cacheLife } from 'next/cache'

export async function getPost(slug: string) {
  'use cache'
  cacheLife('hours') // stale: 5 分钟，revalidate: 1 小时，expire: 1 天
  return db.post.findUnique({ where: { slug } })
}
```

还有一条容易忽略的规则：**寿命太短的缓存会被排除出预渲染**。`revalidate` 为 `0`、`expire` 小于 5 分钟、`stale` 小于 30 秒——满足任一条，这块内容就不进静态外壳，而是在请求期解析。所以"我配了缓存但它没进静态外壳"往往不是 bug，是阈值没够。详见 [11 缓存模型 Cache Components](../02-rendering/11-cache-components.md)。

### 单飞：手写 ISR 最容易漏的一环

上面那段代码里，`revalidate` 函数外面套了一个 `inFlight` Map。这是整个实现里最关键、也最容易被省略的部分。

去掉它会发生什么？假设 `revalidate` 时间是 60 秒，你的页面刚过保鲜期，这时来了 50 个并发请求：

```
50 个请求同时读到 ageMs > REVALIDATE_MS
  → 50 次 void revalidate(slug)
  → 50 次 getPost() + 50 次完整渲染
  → 50 次 writeFile 写同一个文件
```

这就是**缓存击穿（cache stampede / thundering herd）**。后果不只是浪费 CPU：50 个并发写同一个文件还可能写坏内容（所以真实实现里写文件要写临时文件再 `rename` 原子替换）。

单飞的写法就是"用一个 Map 记住正在跑的 Promise，后来者直接复用同一个 Promise"。这是 Next.js 内部 `dedupe-fetch`、`with-promise-cache` 这类工具在做的事——你可以在 `packages/next/src/server/lib/dedupe-fetch.ts` 和 `packages/next/src/lib/with-promise-cache.ts` 里看到对应实现。

### `postponed`：静态外壳与动态空洞

到这里有个问题没解决：如果页面里有一部分内容**必须**每次请求都不同（读 cookie、读 `headers()`），SSG 怎么处理？

答案是 React 的 `postponed` 机制。`prerenderToNodeStream` 的返回值是**两个**东西：

```ts
// React 文档里给出的签名
const { prelude, postponed } = await prerenderToNodeStream(reactNode, options?)
```

| 字段 | 含义 |
|---|---|
| `prelude` | Node.js 流，装的是 HTML。可以整段读成字符串，也可以直接 pipe 出去 |
| `postponed` | **可 JSON 序列化的不透明对象**。非 `null` 表示预渲染没完成，可以交给 `resumeToPipeableStream` 续渲染；`null` 表示 `prelude` 已经是完整内容 |

这就把渲染拆成了两段：

```
构建期 / 请求早期：prerenderToNodeStream
  → 渲染到"动态访问"处中断
  → prelude 产出静态外壳（含 fallback）
  → postponed 被序列化存起来（Redis、文件、S3 都行）

请求期：resumeToPipeableStream
  → 从存储里取出 postponed
  → 从断点继续渲染
  → pipe 出去，流式补齐动态部分
```

官方文档给的用法：

```ts
// app/route.ts —— React 文档中 resumeToPipeableStream 的示例形态
import { resumeToPipeableStream } from 'react-dom/server'
import { getPostponedState } from './storage'

export async function GET(request: Request) {
  const postponed = await getPostponedState(request)

  const { pipe } = resumeToPipeableStream(<App />, postponed, {
    onShellReady: () => {
      pipe(response)
    },
  })
}
```

**这就是 PPR（Partial Prerendering）的实现机制**：静态外壳构建期就定好、放 CDN；动态空洞的"断点状态"被存成 `postponed`；请求到达时从断点续上，把动态部分流过去。

在 Next.js 里，触发中断的那个动作是框架内部的"运行期访问"——`cookies()`、`headers()`、`searchParams`、未缓存的数据。你不需要手写 `postponed` 的存取，开启 `cacheComponents: true` 之后框架替你管这一套。你要做的是**用 `<Suspense>` 标出边界**，告诉框架"这里可以断"。

> 手写和框架的差距就在这一层：手写版要自己设计 `postponed` 的存储、失效、版本兼容；Next.js 把这些收进了 `.next/server` 的预渲染产物和 resume 数据缓存里。你可以在源码里看到 `packages/next/src/server/resume-data-cache/` 这个目录，它就是干这个的。

### 多实例下的失效传播

最后一个绕不开的问题：你部署了 3 个实例，实例 A 上有人触发了一次内容更新，实例 B 和 C 的缓存怎么办？

默认行为是**不传播**。官方文档说得很直接：重新验证事件是**本地的**——在实例 A 上调用 `revalidateTag()` 只失效实例 A 的缓存，其他实例继续提供陈旧内容，直到它们自己得知这次失效。

缓存处理器（cache handler）API 给了两个钩子来打通这件事：

| 钩子 | 何时被调用 | 你要做什么 |
|---|---|---|
| `updateTags()` | `revalidateTag()` 被调用时 | 把失效事件写进共享存储（Redis、数据库） |
| `refreshTags()` | 周期性调用，且**一定在新请求开始前**调用 | 从共享存储读最近的失效事件，更新本地标签状态 |

两个容易踩的点：

- **`refreshTags()` 里必须捕获错误**。官方明确说明：如果它抛异常，异常会传播成**请求失败**。捕获之后请求可以用最后已知的本地标签状态继续，最多提供一点陈旧内容，而不是直接 500。
- **HTML 和 RSC Payload 必须一起缓存**。一次重新验证会重新生成**两个**产物（HTML 响应和 RSC Payload），它们存在同一个缓存条目里。如果平台的 CDN 用不同的 TTL 分别缓存了它们，客户端导航时会拿到"HTML 是新的、payload 是旧的"这种错配内容。

这两个问题在自托管单实例下都不存在——本地文件系统缓存写入是原子的，标签状态在内存里，一致性自动成立。**只有多实例才需要处理**。

## 手写实现 ↔ Next.js 对应机制

| 手写实现 | Next.js 16 里的对应物 |
|---|---|
| `scripts/build.ts` 遍历 slug 预渲染 | `generateStaticParams` + `next build` |
| `writeFile('dist/x.html')` | `.next/server/app/x.html`（或平台的持久存储） |
| `prerenderToNodeStream` | 框架内部的 `prerender` / `prerenderToNodeStream` 调用 |
| `readFile` + `stat().mtimeMs` | 增量缓存（incremental cache）+ `cacheLife` 的 `revalidate` / `expire` |
| `ageMs > REVALIDATE_MS` 判断 | `cacheLife` 的 `revalidate` 字段 |
| `inFlight` Map 单飞 | 内部去重（`dedupe-fetch`、`with-promise-cache`） |
| `void revalidate(slug)` 不阻塞 | 后台重建 |
| `Cache-Control: s-maxage, stale-while-revalidate` | 同样的响应头，交给 CDN |
| `postponed` 存取 + `resumeToPipeableStream` | **PPR 的静态外壳 + resume**，开启 `cacheComponents` 后是默认行为 |
| 缓存未命中时同步构建 | `fallback: 'blocking'` 的语义（Pages Router 时代） |
| 手写标签失效表 | `cacheTag` + `revalidateTag` / `updateTag` / `revalidatePath` |
| 无 | **App Shell**：与 URL 无关的可复用外壳，首次访问后由 ISR 升级成具体版本 |
| 无 | `partialPrefetching: true`：让 App Shell 被预取，未列出的 URL 也能即时首访 |

## 常见坑

- **现象**：内容明明更新了，页面还是旧的，等一会儿自己好了。
  **原因**：这就是 stale-while-revalidate 的正常行为——旧内容先发出去，重建在后台。**触发重建的是请求，不是那次内容更新**。没有流量就没有重建。
  **解法**：需要"改完立刻生效"就用 `updateTag(tag)`（read-your-writes，下一个请求等新数据）或 `revalidateTag(tag, { expire: 0 })`。需要"别人下次访问时后台刷新"才用 `revalidateTag(tag, 'max')`。详见 [12 重新验证](../02-rendering/12-revalidating.md)。

- **现象**：刚过保鲜期的瞬间，服务器 CPU 飙高，或者文件内容出现半截 HTML。
  **原因**：漏了单飞。并发请求同时判定"需要重建"，于是并发跑 N 次渲染、并发写同一个文件。
  **解法**：用 Map 缓存正在跑的 Promise（见上文 `revalidate` 实现）；写文件时先写临时文件再 `rename` 原子替换。

- **现象**：某个页面冷启动后的第一个请求特别慢，之后恢复正常。
  **原因**：这块内容已经超过 `expire`，而且期间没有流量触发过后台重建，所以第一个请求**同步等待**了完整重建。
  **解法**：这是设计行为，不是 bug。要么把 `expire` 配长一点（让窗口内的请求总能拿到旧内容），要么在部署后主动预热关键路由。

- **现象**：`prerenderToNodeStream` 写在了请求处理函数里，某个慢查询把整个页面拖住。
  **原因**：`prerenderToNodeStream` **会等所有数据加载完才 resolve**——这正是它适合 SSG 的原因，也是它不适合放在热路径上的原因。
  **解法**：构建期用它。请求期要流式，用 `renderToPipeableStream`（见 [56](./56-build-streaming-ssr.md)）。

- **现象**：多实例部署下，一台机器上更新了内容，其他机器返回旧内容，刷新几次才对。
  **原因**：重新验证事件默认是本地的，不会跨实例传播。
  **解法**：实现自定义 cache handler，用 `updateTags()` 写共享存储、`refreshTags()` 读。注意 `refreshTags()` 里必须 catch 错误——它抛异常会变成请求失败。单实例自托管不需要处理。

- **现象**：客户端导航时页面内容跳变，或者 HTML 和客户端导航后的内容不一致。
  **原因**：一次重新验证会同时重新生成 HTML 和 RSC Payload，两者存在同一个缓存条目里。如果 CDN 用不同 TTL 分别缓存了它们，就会出现错配。
  **解法**：让 HTML 和 payload 用同一个 TTL、同一个失效策略一起缓存，并尊重 Next.js 设置的 `Vary` 头。

- **现象**：配了 `cacheLife('seconds')`，结果这块内容没进静态外壳。
  **原因**：`seconds` profile 的 `expire` 是 1 分钟，小于 5 分钟的阈值，所以被排除出预渲染，变成请求期解析的"动态空洞"。
  **解法**：如果本意就是"每次请求都重新取"，那是预期行为——给它包个 `<Suspense>` 提供 fallback 就行。如果本意是"缓存"，换一个更长的 profile。

- **现象**：滚动部署期间用户看到"Failed to find Server Action"。
  **原因**：每次部署会生成新的 action ID（Next.js 最多每 14 天轮换一次，即使源码没变）。客户端还在跑旧构建时，会调用一个已经不存在的 action ID。
  **解法**：用滚动部署而不是硬切换；多实例下保持 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 稳定；UI 上把这个错误做成"重试"路径而不是硬失败。详见 [57 从零实现 Server Actions](./57-build-server-actions.md)。

## API / 配置速查

| API / 配置 | 位置 | 说明 |
|---|---|---|
| `prerenderToNodeStream` | `react-dom/static` | Node.js 静态预渲染，**等所有数据**，返回 `{ prelude, postponed }` |
| `prerender` | `react-dom/static` | Web Streams 版本（Deno / 边缘） |
| `resumeToPipeableStream` | `react-dom/server` | 用 `postponed` 续渲染，Node.js |
| `resume` | `react-dom/server` | Web Streams 版本 |
| `cacheLife(profile)` | `next/cache` | 在 `'use cache'` 作用域内设置 `stale` / `revalidate` / `expire` |
| `cacheTag(tag)` | `next/cache` | 打标签供按需失效 |
| `revalidateTag(tag, profile)` | `next/cache` | 后台刷新（SWR 语义） |
| `updateTag(tag)` | `next/cache` | 立刻过期，read-your-writes；**仅 Server Actions** |
| `revalidatePath(path)` | `next/cache` | 按路径失效，走软标签机制 |
| `generateStaticParams` | 路由段 | 决定哪些参数组合在构建期预渲染 |
| `partialPrefetching` | `next.config.ts` | 预取 App Shell，实现未列出 URL 的即时首访 |
| `cacheHandlers` | `next.config.ts` | 自定义 cache handler（注意是复数，给 `'use cache'` 用） |
| `deploymentId` | `next.config.ts` | 跨部署错配时触发硬导航 |

`cacheLife` 三个时间属性的分工：

| 属性 | 作用域 | 说明 |
|---|---|---|
| `stale` | 客户端 | 客户端可以不做校验就用缓存数据的时长；还决定内容能否进 App Shell。**最少 30 秒** |
| `revalidate` | 服务端 | 后台重建频率，即 ISR 的保鲜期 |
| `expire` | 服务端 | 必须重建的上限。设了 `revalidate` 时它必须更长，否则报错 |

预置 profile 对照（节选）：

| Profile | `stale` | `revalidate` | `expire` | 适合 |
|---|---|---|---|---|
| `seconds` | 30 秒 | 1 秒 | 1 分钟 | 实时数据（**会因 `expire` 太短被排除出预渲染**） |
| `hours` | 5 分钟 | 1 小时 | 1 天 | 每天更新几次的内容 |
| `days` | 5 分钟 | 1 天 | 1 周 | 每天更新 |
| `max` | 5 分钟 | 30 天 | 1 年 | 极少变化 |

## 延伸阅读

- [React 文档：`prerenderToNodeStream`](https://react.dev/reference/react-dom/static/prerenderToNodeStream) —— `postponed` 的官方定义
- [React 文档：`resumeToPipeableStream`](https://react.dev/reference/react-dom/server/resumeToPipeableStream)
- [官方文档：Caching](https://nextjs.org/docs/app/getting-started/caching)
- [官方文档：How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works) —— 标签系统、多实例协调、优雅降级
- [官方文档：ISR with Cache Components](https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components)
- [官方文档：Custom Cache Handler](https://nextjs.org/docs/app/api-reference/config/next-config-js/incrementalCacheHandlerPath)
- [官方文档：`cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers)
- [官方文档：CDN Caching](https://nextjs.org/docs/app/guides/cdn-caching) —— HTML 与 RSC Payload 必须同 TTL
- [MDN：`stale-while-revalidate`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
