# 66 · 拓展阅读与源码索引

> **一句话结论**：能查一手资料就别查二手。这份索引把 Next.js 源码仓库的目录结构、官方高价值页面、延伸资料列清楚——面试或实战遇到细节问题，先去这里找。

## Next.js 源码仓库目录导览

仓库：https://github.com/vercel/next.js

主要代码在 `packages/next/src/`，按职责分模块：

| 路径 | 管什么 |
|---|---|
| `packages/next/src/server/` | 服务端运行时——路由匹配、SSR、RSC 序列化、缓存 |
| `packages/next/src/client/` | 客户端运行时——hydration、客户端导航、Router |
| `packages/next/src/build/` | 构建流程——打包、产物生成 |
| `packages/next/src/server/route-definitions/` | 路由定义与匹配 |
| `packages/next/src/server/response-cache/` | 全路由缓存 |
| `packages/next/src/server/app-render/` | App Router 的渲染管线（RSC、Streaming） |
| `packages/next/src/server/future/` | 实验性特性的孵化地 |
| `packages/next/src/compiled/` | 第三方依赖的内置版本 |
| `packages/next/src/lib/` | 通用工具 |
| `packages/next/src/dev/` | 开发服务器相关 |
| `crates/` | Turbopack 的 Rust 实现（顶层） |

**怎么用源码**：

- 想看 Proxy 实现：搜 `proxy.ts` 的处理逻辑，在 `server/` 下
- 想看 RSC 序列化：看 `app-render/` 下的 flight 相关文件
- 想看缓存失效：搜 `revalidateTag` 的服务端实现

**注意**：源码节奏快，文件位置和命名会随版本变。看之前先确认对应版本的 tag。

## 官方文档高价值页面清单

按用途分组，遇到问题先去对应组查：

### 入门与心智模型
- [What is Next.js](https://nextjs.org/docs) —— 总览
- [App Router and Pages Router](https://nextjs.org/docs#app-router-and-pages-router) —— 两套路由模型
- [Project Structure](https://nextjs.org/docs/app/getting-started/project-structure)
- [Installation](https://nextjs.org/docs/app/getting-started/installation)

### 渲染与组件
- [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary)
- [Rendering Philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy)
- [Streaming](https://nextjs.org/docs/app/guides/streaming)

### 数据与缓存
- [Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data)
- [Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data)
- [Caching](https://nextjs.org/docs/app/getting-started/caching)
- [Revalidating](https://nextjs.org/docs/app/getting-started/revalidating)
- [How Revalidation Works](https://nextjs.org/docs/app/guides/how-revalidation-works) —— 深度好文
- [Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components)
- [Server Actions](https://nextjs.org/docs/app/guides/server-actions)

### 路由与网络
- [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Proxy](https://nextjs.org/docs/app/getting-started/proxy) —— 16 起的中间件
- [Redirecting](https://nextjs.org/docs/app/guides/redirecting)

### 工程化
- [Upgrading](https://nextjs.org/docs/app/getting-started/upgrading)
- [Version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Debugging](https://nextjs.org/docs/app/guides/debugging)
- [Testing](https://nextjs.org/docs/app/guides/testing)
- [AI Coding Agents](https://nextjs.org/docs/app/guides/ai-agents)
- [Next.js MCP Server](https://nextjs.org/docs/app/guides/mcp)

### 部署与运维
- [Deploying](https://nextjs.org/docs/app/getting-started/deploying)
- [Self-Hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [CDN Caching](https://nextjs.org/docs/app/guides/cdn-caching)
- [OpenTelemetry](https://nextjs.org/docs/app/guides/open-telemetry)
- [Production Checklist](https://nextjs.org/docs/app/guides/production-checklist)

### 安全
- [Data Security](https://nextjs.org/docs/app/guides/data-security)
- [Authentication](https://nextjs.org/docs/app/guides/authentication)
- [Authentication with Cache Components](https://nextjs.org/docs/app/guides/authentication-with-cache-components)
- [Content Security Policy](https://nextjs.org/docs/app/guides/content-security-policy)

### 场景指南
- [Multi-tenant](https://nextjs.org/docs/app/guides/multi-tenant)
- [Multi-zones](https://nextjs.org/docs/app/guides/multi-zones)
- [Internationalization](https://nextjs.org/docs/app/guides/internationalization)
- [Draft Mode](https://nextjs.org/docs/app/guides/draft-mode)
- [Static Exports](https://nextjs.org/docs/app/guides/static-exports)
- [Single-Page Applications](https://nextjs.org/docs/app/guides/single-page-applications)

### API 参考
- [File Conventions](https://nextjs.org/docs/app/api-reference/file-conventions)
- [next.config.ts](https://nextjs.org/docs/app/api-reference/config/next-config-js)
- [Turbopack](https://nextjs.org/docs/app/api-reference/turbopack)
- [CLI: create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app)

### 其他
- [官方博客](https://nextjs.org/blog) —— 版本发布公告
- [Preview 文档](https://preview.nextjs.org) —— 未发布特性预览
- [llms.txt](https://nextjs.org/docs/llms.txt) —— 文档索引（给 AI 用）

## 延伸资料

### React
- [React 官方文档](https://react.dev)
- [Server Components](https://react.dev/reference/rsc/server-components)
- [use client](https://react.dev/reference/rsc/use-client)
- [React Canaries](https://react.dev/blog/2023/05/03/react-canaries) —— App Router 用的 canary 机制

### 资料源（本仓库用到的）
- [掘金小册《Next.js 开发指南》](https://github.com/flylea/NuggetsBooklet) —— 章节骨架参考（内容基于 13/14，已逐条校对）
- B站 HDAlex_John《Next简明教程》2026 夏 —— 详见 [`SOURCES.md`](../../SOURCES.md)

### 社区与生态
- [Next.js GitHub Discussions](https://github.com/vercel/next.js/discussions)
- [Next.js Discord](https://discord.com/invite/bUG2bvbtHy)
- [r/nextjs](https://www.reddit.com/r/nextjs)

## 怎么用这份索引

| 你想做的事 | 去哪 |
|---|---|
| 查某个 API 的确切签名 | API Reference 组 + 该页面 |
| 理解某个特性的设计动机 | Guides 组对应文章 |
| 看升级时要改什么 | Version 16 upgrade guide + [`MIGRATION-16.md`](../../MIGRATION-16.md) |
| 调试某个行为 | Debugging + 源码对应模块 |
| 给 AI 助手喂正确知识 | AI Coding Agents + MCP + llms.txt |

## 写在最后

这份笔记的写作基准是 **Next.js 16.3.x**。Next.js 节奏快——大约每半年一个大版本，期间还有小版本。这份资料会过时，但本仓库建立的方法论不会：

- 以官方文档为一手裁决
- 遇旧写法纠正，不照抄
- 讲机制不讲定义
- 给权衡不给结论

按这套方法更新到下一版本，就是改 [`MIGRATION-16.md`](../../MIGRATION-16.md) 一张表 + 逐章核对的工作量，而不是重写一遍。

## 延伸阅读

- [Next.js 官方文档首页](https://nextjs.org/docs)
- [Next.js GitHub 仓库](https://github.com/vercel/next.js)
- [Next.js 博客](https://nextjs.org/blog)
