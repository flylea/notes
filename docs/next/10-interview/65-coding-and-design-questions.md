# 65 · 手写题与场景设计题

> **一句话结论**：手写题考的是你能不能把黑盒拆开——不是真让你在生产里手写 SSR，是看你懂不懂机制。系统设计题考的是能不能把全链路串起来给方案。两类题的答法都遵循"先讲要解决什么问题，再讲怎么实现，最后讲代价"。

## A. 手写题

### A1：手写一个最小 SSR 服务

**考点**：能不能讲清 `renderToString` + `hydrateRoot` 三步。

**答题骨架**：

1. 服务端用 `react-dom/server` 的 `renderToString` 把组件树变成 HTML 字符串
2. 拼进 HTML 模板（含客户端 script 标签）
3. 客户端 `hydrateRoot` 对账并挂事件

**关键代码**：

```ts
// server/index.ts
import { renderToString } from 'react-dom/server'
import http from 'http'
import App from '../app'

http.createServer((req, res) => {
  const html = renderToString(<App />)
  res.writeHead(200, { 'content-type': 'text/html' })
  res.end(`<!DOCTYPE html><html><body><div id="root">${html}</div><script src="/client.js"></script></body></html>`)
}).listen(3000)
```

```tsx
// client/index.tsx
import { hydrateRoot } from 'react-dom/client'
import App from '../app'

hydrateRoot(document.getElementById('root')!, <App />)
```

**加分**：讲清 hydration 是对账而非重渲染——服务端 HTML 已显示，hydrate 只挂事件避免闪烁。

**详细实现**：见 [第 53 章](../09-internals/53-build-minimal-ssr.md)。

### A2：手写 ISR

**考点**：知不知道 stale-while-revalidate 怎么落地。

**答题骨架**：

1. 构建期渲染所有静态路由，写入静态 HTML
2. 每个路由配 `revalidate` 时间窗（秒）
3. 请求来时：缓存命中且未过期 → 直接返回；过期 → 先返回旧内容，后台重建后替换

**关键伪代码**：

```ts
// 伪代码，省略存储细节
async function serveRoute(path: string) {
  const cached = await cache.get(path)
  if (cached && !isStale(cached, revalidateWindow)) {
    return cached.html
  }
  // 先返回旧的（如果有）
  if (cached) {
    backgroundRevalidate(path)   // 后台重建
    return cached.html
  }
  // 没有缓存，同步渲染
  return await render(path)
}
```

**加分**：讲清失效的触发者是请求而非调用，后台重建在下一个请求时完成。

**详细实现**：见 [第 54 章](../09-internals/54-build-ssg-and-isr.md)。

### A3：手写极简 RSC payload

**考点**：能不能讲清 Flight 协议解决了什么问题。

**答题骨架**：

1. 不能直接 JSON——会丢组件类型引用
2. Flight 用 id 引用 + 客户端模块清单
3. 服务端组件代码不进 payload，只发"在客户端找这个组件"的指令

**简化 payload 示例**：

```
0:["$","div",null,{"children":["$","h1",null,{"children":"欢迎，Alice"}]}]
1:["$","$1","counter",null,{"children":"点了 0 次"}]
```

**加分**：讲为什么用 id 引用而非完整嵌套——支持流式，服务端边算边发。

**详细**：见 [第 55 章](../09-internals/55-rsc-and-flight.md)。

### A4：手写 Server Action 的请求/响应

**考点**：知不知道 action id + POST + 返回 RSC payload。

**答题骨架**：

1. 打包器给每个 `"use server"` 函数生成稳定 id
2. 客户端"调用"是发 POST 带 FormData，头里带 `Next-Action: <id>`
3. 服务端按 id 路由到函数，执行后返回新的 RSC payload
4. 客户端 hydrate payload 得到新 UI

**加分**：讲渐进增强——没 JS 时浏览器原生提交到那个 URL，服务端返回 HTML 而非 payload。

**详细**：见 [第 57 章](../09-internals/57-build-server-actions.md)。

## B. 场景设计题

### B1：设计一个支持多租户的博客平台

**答题框架**（按这个顺序，不要跳）：

1. **明确需求**：多少租户、单租户数据量、是否需要自定义域名、读写比、一致性要求
2. **路由**：子域名（`acme.app.com`）vs 路径（`/t/acme`）。子域名隔离更彻底但要通配 DNS + 证书；路径简单但要小心缓存键
3. **数据隔离**：共享库 + `tenant_id` 字段（小规模）vs 独立 schema（大规模、合规要求）
4. **缓存键设计**：**这是最容易翻车的地方**——所有缓存 tag 必须带租户 id（`posts:acme`），否则会串数据
5. **鉴权**：Proxy 做租户路由 + 乐观校验；Server Action 内独立验租户归属
6. **部署**：单区域起步 → 多区域时考虑 Multi-Zones 或 CDN 层路由

**陷阱**：
- 缓存不带租户 id → 跨租户串数据
- Server Action 不验租户 → 越权改别人的文章
- 静态导出想做多租户 → 不支持（Proxy 不支持静态导出）

**详细**：见 [第 50 章](../08-projects/50-saas-multi-tenant.md)、[第 51 章](../08-projects/51-saas-multi-region-deploy.md)。

### B2：设计一个高并发的商品列表页

**答题框架**：

1. **渲染策略**：商品列表用 ISR（构建期预渲染 + 后台再生成），详情页用 SSG + ISR，搜索用 CSR（实时性高）
2. **缓存**：`cacheComponents` + `"use cache"` 缓存商品组件，`cacheTag` 带商品类目
3. **失效**：库存变更时 `revalidateTag('catalog:electronics', 'max')`；当前用户加购物车立刻看到 → `updateTag`
4. **流式**：评论等慢内容用 `<Suspense>` 包，外壳（商品图 + 标题 + 价格）同步快
5. **数据获取**：商品基本信息并行取，评论延迟取
6. **性能**：图片用 `next/image` 配 `sizes`；bundle 把客户端组件推到叶子

**陷阱**：
- 把整个列表页标 `"use client"` → bundle 爆炸
- 缓存不带类目 → 改一类商品，所有类目都失效
- 外壳 await 评论 → 流开不了

### B3：迁移一个 Pages Router 项目到 App Router

**答题框架**：

1. **评估**：项目多大、用了多少 Pages Router 专属 API（`getServerSideProps` 等）
2. **渐进**：App Router 和 Pages Router 可共存，按路由逐个迁
3. **数据层**：`getServerSideProps` → 服务端组件内 `await`；`getStaticProps` → `generateStaticParams` + 服务端组件
4. **缓存**：旧的隐式缓存行为变了，按 `cacheComponents` 模型重写
5. **同步 API 迁移**：`params` / `cookies()` / `headers()` 改 await，跑 `next-async-request-api` codemod
6. **middleware → proxy**：重命名文件和导出函数
7. **验证**：每迁一个路由，对照 [`MIGRATION-16.md`](../../MIGRATION-16.md) 逐条检查

**陷阱**：
- 想一次全迁 → 风险太大，应渐进
- 照搬旧缓存写法 → 行为不对
- 漏了 middleware → proxy → 鉴权断

**详细**：见 [第 32 章](../06-config-tooling/32-migrating.md)。

## 答题通用原则

1. **先问需求**——系统设计题没明确需求就开始答是大忌
2. **先讲要解决什么问题**——不要直接上方案
3. **给对照表**——多个方案的取舍讲清楚
4. **讲代价**——每个选择都说不选会怎样
5. **结合全链路**——能画出 [第 60 章](../09-internals/60-request-lifecycle.md) 的链路图

## 延伸阅读

- [第 53 章 · 从零实现最小 SSR](../09-internals/53-build-minimal-ssr.md)
- [第 54 章 · 从零实现 SSG 与 ISR](../09-internals/54-build-ssg-and-isr.md)
- [第 55 章 · RSC 实现原理与 Flight 协议](../09-internals/55-rsc-and-flight.md)
- [第 57 章 · 从零实现 Server Actions](../09-internals/57-build-server-actions.md)
- [第 60 章 · 请求生命周期总览](../09-internals/60-request-lifecycle.md)
