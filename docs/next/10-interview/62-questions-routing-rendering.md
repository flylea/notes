# 62 · 高频题：路由与渲染

> **一句话结论**：路由和渲染是面试出现频率最高的题组。考官想听的不是定义——是你在什么场景选哪个、为什么。每题给"想听什么 / 标准答案要点 / 加分项 / 常见错误"四栏。

## Q1：CSR、SSR、SSG、ISR、PPR 有什么区别，怎么选

**想听什么**：能不能把五种策略的边界画清楚，能不能按场景选。

**标准答案要点**：
- CSR：浏览器渲染，首屏慢，依赖 JS
- SSR：服务端每次请求渲染，内容实时，开销大
- SSG：构建期渲染成静态 HTML，最快，内容不变
- ISR：SSG + 后台再生成，兼顾静态与新鲜
- PPR：静态外壳 + 动态流式，16 起是 Cache Components 的一部分

**加分项**：讲清 PPR 不是新策略，而是"静态 + 动态混合"的模型，是 App Router 的默认行为；给一个具体场景的选型（"首页用 SSG，用户仪表盘用 SSR+Streaming，商品列表用 ISR"）。

**常见错误**：
- "SSR 一定比 CSR 快"——不一定，SSR 服务端开销大，内容稀疏的页面 CSR 反而快
- 把 PPR 当成独立渲染策略——它是组合模型

**参考**：[第 08 章](../02-rendering/08-rendering-strategies.md)、[`MIGRATION-16.md`](../../MIGRATION-16.md) 第 3 条

## Q2：什么是 React Server Component，和 SSR 有什么区别

**想听什么**：有没有理解 Flight payload 和"代码不进客户端 bundle"这一点。

**标准答案要点**：
- SSR 把组件在服务端渲染成 HTML，但组件代码依然进客户端 bundle（要 hydrate）
- RSC 让服务端组件代码**不进**客户端 bundle，以 Flight payload（可流式、可引用客户端组件的中间表示）传到浏览器
- 同一棵树里服务端组件和客户端组件共存，信息流单向（服务端 → 客户端）
- 客户端要影响服务端得靠 Server Action

**加分项**：讲为什么不能直接 JSON 序列化（函数引用、流式、客户端模块清单），见 [第 55 章](../09-internals/55-rsc-and-flight.md)。

**常见错误**：
- "RSC 就是组件在服务端跑"——那叫 SSR
- "RSC 替代了 SSR"——两者并存，RSC 是 SSR 的演进

## Q3：App Router 和 Pages Router 有什么区别

**想听什么**：知不知道两套路由模型，知不知道为什么官方推 App Router。

**标准答案要点**：
- Pages Router：`pages/` 目录，文件即路由，`getServerSideProps` / `getStaticProps` 取数据
- App Router：`app/` 目录，嵌套布局，服务端组件直接 `await` 取数据
- App Router 支持 RSC、嵌套布局、流式渲染；Pages Router 不支持
- Pages Router 仍可用且官方继续维护，但新项目建议用 App Router

**加分项**：讲 App Router 里 React 版本用 canary（含 React 19 稳定变更），Pages Router 用 `package.json` 里的 React 版本。

**常见错误**：
- "Pages Router 要被废弃了"——官方明确仍支持
- 把 App Router 等同于 RSC——App Router 是路由模型，RSC 是组件模型

## Q4：什么是 Streaming SSR，Suspense 在服务端做什么

**想听什么**：知不知道流式的本质是"边算边发"。

**标准答案要点**：
- 流式 SSR 不一次性吐 HTML，按 `<Suspense>` 边界分块
- 先发外壳 + 占位，慢请求回来后发内联 `<script>` 把真实内容塞进 DOM
- 占位位置靠 id 匹配，不依赖 DOM 重排
- 替换用内联 script，不等 JS bundle 解析完

**加分项**：讲清外壳（layout）必须同步快，否则流开不了；讲嵌套 Suspense 各自独立。见 [第 56 章](../09-internals/56-build-streaming-ssr.md)。

**常见错误**：
- "Suspense 只在客户端用"——它也是服务端的流式边界
- "流式就是分块传 HTML"——还要讲内联 script 的续接机制

## Q5：什么是 PPR（Partial Prerendering）

**想听什么**：知不知道 16 起它的定位变了。

**标准答案要点**：
- PPR = 静态外壳 + 动态流式，结合 SSG 的快和 SSR 的实时
- 16 起 `experimental.ppr` 移除，演进为 **Cache Components** 的一部分
- App Router 默认就是 PPR 行为，不需要开关

**加分项**：讲为什么从 opt-in 实验特性变成默认——它本来就是 App Router 渲染模型的自然形态。

**常见错误**：
- "PPR 是新功能要开 `experimental.ppr`"——已移除，见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 3 条

## Q6：路由文件约定有哪些，什么时候触发

**想听什么**：知不知道文件系统路由的约定。

**标准答案要点**：
- `page.tsx` 路由入口
- `layout.tsx` 布局，包裹子路由
- `loading.tsx` 等价于给 page 套 `<Suspense>`
- `error.tsx` 错误边界
- `not-found.tsx` 404
- `template.tsx` 类似 layout 但每次导航重挂载
- `route.ts` API 端点
- `default.tsx` 平行路由槽位的兜底

**加分项**：讲清 layout 和 template 的关键区别（template 重挂载，layout 保持状态），见 [第 06 章](../01-foundation/06-layouts-and-templates.md)。

**常见错误**：
- 把 loading.tsx 当成客户端组件专属——它本质是服务端 Suspense 边界

## Q7：动态路由的几种写法

**想听什么**：知不知道 `[slug]` / `[...slug]` / `[[...slug]]` 的区别。

**标准答案要点**：
- `[slug]`：单段动态，`/post/abc` 匹配
- `[...slug]`：catch-all，`/a/b/c` 全匹配，至少一段
- `[[...slug]]`：可选 catch-all，连 `/` 都匹配
- `generateStaticParams` 在构建期预渲染指定动态段

**加分项**：讲 16 起 `params` 是 Promise 必须 `await`，见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条。见 [第 04 章](../01-foundation/04-dynamic-routes.md)。

## Q8：平行路由和拦截路由解决什么问题

**想听什么**：知不知道这俩不是炫技，是有具体场景。

**标准答案要点**：
- 平行路由（`@slot`）：同一页面同时渲染多个独立视图（仪表盘多面板），各自独立 loading/error
- 拦截路由（`(.)`/`(..)`/`(...)`）：在不离开当前路由的情况下显示另一个路由的内容（模态框显示详情页）
- 16 起所有平行槽位必须显式 `default.js`

**加分项**：给一个模态框 + 平行路由的完整示例，见 [第 05 章](../01-foundation/05-route-groups-parallel-intercepting.md)。

**常见错误**：
- "平行路由就是布局"——它是独立视图，不是嵌套
- 漏掉 `default.js` 的硬要求

## 延伸阅读

- [官方文档：Rendering Philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy)
- [官方文档：Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [官方文档：Streaming](https://nextjs.org/docs/app/guides/streaming)
- [官方文档：Project Structure](https://nextjs.org/docs/app/getting-started/project-structure)
