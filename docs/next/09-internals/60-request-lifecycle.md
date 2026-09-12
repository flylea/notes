# 60 · 请求生命周期总览

> **一句话结论**：从用户敲下 URL 到页面出现在屏幕上，Next.js 干了 7 件事——Proxy 拦截 → 路由匹配 → 缓存查找 → 服务端渲染（RSC）→ 流式输出 → 客户端 hydration → 缓存写入。前面所有章节讲的都是这条链上的某一环，这一章把它们串起来。

## 一张图把全链路串起来

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1. 请求进入                                                           │
│    HTTP 请求 ────────────────────────────────────────────────────────►│
│    ├─ 有静态资源匹配？── 是 ──► 直接返回静态文件（public/、_next/static）│
│    └─ 否 ──► 进入 Next.js 应用                                        │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 2. Proxy（原 Middleware）                                             │
│    proxy.ts 的 proxy(request) 运行                                    │
│    可：重写 / 重定向 / 改 headers / 直接响应                          │
│    不可：完整鉴权、慢数据获取                                         │
│    runtime 固定 Node.js（16 起 middleware.ts 已废弃 → proxy.ts）       │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 3. 路由匹配                                                           │
│    文件系统路由：app/ 目录结构 → URL                                  │
│    动态段 / 路由组 / 平行 / 拦截 在此解析                             │
│    命中 page.tsx / route.ts / 404                                     │
└──────────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
        route.ts（API）                  page.tsx（页面）
                │                               │
                ▼                               ▼
┌──────────────────────────────┐  ┌──────────────────────────────────┐
│ 4. 缓存查找                  │  │ 4. 渲染：从外往内                │
│    Full Route Cache（构建期产物）│  │   layout.tsx（外壳，必须同步快）│
│    命中？── 是 ──► 返回缓存   │  │     ├─ proxy 已加的 headers      │
│                               │  │     └─ 渲染子树                  │
│    否 ──► 进入实时渲染        │  │       ├─ 服务端组件 await 数据   │
└──────────────────────────────┘  │       ├─ 客户端组件：服务端产    │
                                  │       │   HTML，不跑客户端逻辑    │
                                  │       └─ <Suspense>：流式分块     │
                                  └──────────────────────────────────┘
                                                  │
                                                  ▼
                                  ┌──────────────────────────────────┐
                                  │ 5. 序列化为 Flight payload        │
                                  │   服务端组件 → RSC payload         │
                                  │   客户端组件 → client reference    │
                                  │   （服务端组件代码不进 payload）    │
                                  └──────────────────────────────────┘
                                                  │
                                                  ▼
                                  ┌──────────────────────────────────┐
                                  │ 6. 流式输出                      │
                                  │   renderToPipeableStream          │
                                  │   先发 shell + 占位                │
                                  │   慢请求回来后发内联 <script> 续接 │
                                  └──────────────────────────────────┘
                                                  │
                                                  ▼
                                  ┌──────────────────────────────────┐
                                  │ 7. 客户端 hydration              │
                                  │   hydrateRoot 对账                │
                                  │   - 服务端 HTML 与客户端首次渲染一致│
                                  │   - 一致：挂事件（不重渲染）       │
                                  │   - 不一致：mismatch 警告 / 重渲染  │
                                  │   之后客户端导航走 RSC fetch       │
                                  │   （不再刷新整页 HTML）             │
                                  └──────────────────────────────────┘
                                                  │
                                                  ▼
                                  ┌──────────────────────────────────┐
                                  │ 8. 缓存写入                      │
                                  │   启用 cacheComponents 时          │
                                  │   - "use cache" 的组件/函数进缓存  │
                                  │   - Full Route Cache 写入静态部分  │
                                  │   - 失效由 revalidateTag / updateTag│
                                  │     / refresh 触发，且触发者是请求 │
                                  └──────────────────────────────────┘
```

## 每一环的要点速查

| 环节 | 在哪章详讲 | 这环最容易错的点 |
|---|---|---|
| Proxy | [第 16 章](../03-routing-network/16-proxy.md) | 用它做完整鉴权；忘了改 middleware.ts → proxy.ts |
| 路由匹配 | [第 02](../01-foundation/02-file-conventions.md)、[04](../01-foundation/04-dynamic-routes.md)、[05](../01-foundation/05-route-groups-parallel-intercepting.md) 章 | 平行路由漏 `default.js`；动态段 `params` 没 await |
| 缓存查找 | [第 11 章](../02-rendering/11-cache-components.md) | 以为 `fetch` 默认缓存（16 起不默认）；找不到 PPR 的开关 |
| 渲染 | [第 07](../02-rendering/07-server-client-components.md)、[08](../02-rendering/08-rendering-strategies.md) 章 | 把客户端组件标错位置，体积进 bundle |
| Flight payload | [第 55 章](./55-rsc-and-flight.md) | 把函数/类实例当 props 传过边界 |
| 流式输出 | [第 09 章](../02-rendering/09-streaming-and-suspense.md)、[第 56 章](./56-build-streaming-ssr.md) | 外壳（layout）有慢请求，导致流不开 |
| Hydration | [第 58 章](./58-client-components-hydration.md) | 渲染依赖时间/随机数/window，mismatch |
| 缓存写入 | [第 12 章](../02-rendering/12-revalidating.md) | 调了 `revalidateTag` 但 UI 没更新；触发者是请求而非调用 |

## 三个"为什么这么设计"

把链路串起来后，几个之前看似奇怪的设计就有了答案：

### 为什么 Proxy 不能做完整鉴权

Proxy 在请求最早期运行，能做乐观重定向（把明显没登录的拒掉），但 Server Action 的端点可以被直接 POST——绕过 Proxy。所以鉴权必须**双层**：Proxy 兜住大部分，Server Action / Route Handler 内部独立验。见 [第 16 章](../03-routing-network/16-proxy.md) 和 [第 57 章](./57-build-server-actions.md)。

### 为什么外壳必须同步快

流式渲染的锚点是外壳（layout）。外壳不算完，第一个 chunk 都没法发。所以官方反复强调：把慢数据挪进 `<Suspense>` 包裹的子树，让 layout 保持极简同步。见 [第 56 章](./56-build-streaming-ssr.md)。

### 为什么失效的触发者是"请求"而不是"调用"

`revalidateTag` 标记缓存失效，但**不会立刻重建**——下一个请求到达时才会重新取数据。这是 SWR（stale-while-revalidate）模型的核心：先给旧的、后台重建。`updateTag` 是这个模型的例外，它只对当前用户立刻生效（read-your-writes）。两者分工见 [第 12 章](../02-rendering/12-revalidating.md) 和 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 5、6 条。

## 不同请求类型的路径差异

| 请求类型 | 走的路径 |
|---|---|
| 静态资源（`/logo.png`、`/_next/static/*`） | 不进 Next.js 应用，CDN/静态服务器直接返回 |
| 页面首次请求 | 完整 8 环链路 |
| 页面客户端导航 | 不重走 Proxy（同源内）；走 RSC fetch，仅 4→8（渲染→序列化→流式→hydration→缓存） |
| Route Handler | Proxy → 路由匹配 → route.ts 执行 → 响应（不走渲染、不 hydrate） |
| Server Action POST | Proxy → 路由匹配 → action 执行 → 返回新 RSC payload |
| 静态导出 | 构建期一次性渲染所有静态路由，运行时纯静态返回 |

## 一个能对照调试的实践

链路里任何一环卡住，症状都不一样。按症状定位：

| 症状 | 卡在哪环 | 怎么查 |
|---|---|---|
| 首屏白屏很久 | 外壳慢 | 看 layout 里有没有同步 await |
| 内容陆续出现但布局抖 | Suspense 没占位 | 给 fallback 留高度 |
| 控制台 hydration 警告 | 渲染不一致 | 找时间/随机/window 依赖 |
| 改了数据 UI 不变 | 缓存写入/失效 | 检查 action 里有没有调 revalidation |
| 任何人能改别人数据 | 鉴权缺环 | 看 action 内有没有独立鉴权 |
| 静态资源慢 | 没走 CDN | 确认是否在 `/_next/static/` 或 public 下 |

## 常见坑

- **现象**：开了 `cacheComponents` 后数据不更新。
  **原因**：缓存默认 opt-in，但 opt-in 的组件一旦缓存了就按 `cacheLife` 生存周期，不主动失效不重建。
  **解法**：配 `cacheTag`，数据变更时 `revalidateTag(tag, 'max')`。

- **现象**：proxy 改了 header 但页面里读不到。
  **原因**：header 在请求头里，要在服务端组件 `await headers()` 才读到。注意 16 起 `headers()` 必须 await（见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条）。

- **现象**：客户端导航后某个服务端组件不重新执行。
  **原因**：它被缓存了。
  **解法**：要么显式 `"use cache"` 配置较短 `cacheLife`，要么用 `revalidatePath` 在导航前失效。

## 旧写法 vs 新写法

| 环节 | 旧（13/14 + Pages Router） | 新（16.3 + App Router） |
|---|---|---|
| 拦截层 | `middleware.ts`（可 edge） | `proxy.ts`（固定 Node.js） |
| 取数据 | `getServerSideProps` / `getStaticProps` | 服务端组件内 `await` |
| 渲染模型 | SSR + 全量 hydration | RSC + 选择性 hydration |
| 缓存 | 隐式（`fetch` 默认缓存） | 显式（`cacheComponents` + `"use cache"`） |
| 失效 | `revalidateTag(tag)` 单参数 | `revalidateTag(tag, profile)` + `updateTag` + `refresh` |
| 打包器 | webpack | Turbopack |

每一条的详细对照见 [`MIGRATION-16.md`](../../MIGRATION-16.md)。

## 延伸阅读

- [官方文档：Rendering Philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy)
- [官方文档：Caching](https://nextjs.org/docs/app/getting-started/caching)
- [官方文档：How Revalidation Works](https://nextjs.org/docs/app/guides/how-revalidation-works)
- [官方文档：Proxy](https://nextjs.org/docs/app/getting-started/proxy)
- [官方文档：Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary)
