# 63 · 高频题：缓存与数据

> **一句话结论**：缓存是 16 改动最大的一块，也是新的区分点。考官想听你讲清"数据默认动态、缓存显式 opt-in、失效的触发者是请求而不是调用"这三条新模型，而不是旧版"`fetch` 默认缓存"。

## Q1：Next.js 的缓存模型是什么

**想听什么**：知不知道 16 起这套变了。

**标准答案要点**：
- 旧版（13/14）：`fetch` 默认缓存，靠 `experimental.ppr` / `dynamicIO` 控制
- 16：`cacheComponents: true` 统一取代上述开关
- 数据**默认动态**，缓存必须显式声明 `"use cache"`
- 缓存 API `cacheLife` / `cacheTag` 已稳定（去掉 `unstable_` 前缀）
- PPR 成为 App Router 默认行为

**加分项**：讲为什么从隐式改显式——隐式缓存让数据不更新成了高频困惑，显式 opt-in 让行为可预期。见 [第 11 章](../02-rendering/11-cache-components.md) 和 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 3、4 条。

**常见错误**：
- "`fetch` 默认缓存"——16 起不默认
- "PPR 要开 `experimental.ppr`"——已移除

## Q2：revalidateTag、updateTag、refresh 有什么区别

**想听什么**：能不能区分三个失效 API 的语义。

**标准答案要点**：
- `revalidateTag(tag, profile)`：标记缓存失效，**所有用户**下次请求时重建。16 起需第二参数（cacheLife profile），单参数已弃用、行为等同 `{ expire: 0 }`
- `updateTag(tag)`：**仅 Server Actions**，read-your-writes——当前用户立刻看到自己的更新
- `refresh()`：**仅 Server Actions**，只刷新未缓存数据，不动缓存
- 失效的触发者是**请求**，不是调用——SWR 模型

**加分项**：给选择口诀：自己写的自己立刻要看到 → `updateTag`；给所有人下次请求失效 → `revalidateTag`；只重跑动态数据 → `refresh`。见 [第 12 章](../02-rendering/12-revalidating.md) 和 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 5、6 条。

**常见错误**：
- "调了 revalidateTag 立刻生效"——不立刻，下次请求才重建
- 用单参数 `revalidateTag('posts')`——已弃用

## Q3：Server Actions 和 Route Handlers 怎么选

**想听什么**：知不知道两者的边界。

**标准答案要点**：
- Server Actions：表单提交、数据变更，渐进增强（无 JS 也能用），自动和缓存集成
- Route Handlers：API 端点，给外部调用、Webhook、流式响应
- 内部数据变更优先 Server Actions，对外 API 用 Route Handlers

**加分项**：讲 Server Actions 的端点可被直接 POST，必须动作内独立鉴权，见 [第 13 章](../02-rendering/13-server-actions.md) 和 [第 57 章](../09-internals/57-build-server-actions.md)。

**常见错误**：
- "Server Actions 比 Route Handlers 安全"——恰恰相反，端点暴露要独立鉴权
- 用 Server Actions 当对外 API——它是表单语义，不是 REST

## Q4：数据获取有哪些方式，怎么选

**想听什么**：会不会选并行而非瀑布。

**标准答案要点**：
- 服务端组件直接 `await`（不再需要 `getServerSideProps`）
- `fetch` 配 `next.tags` 做缓存键
- 并行用 `Promise.all`，优于串行 await
- 客户端获取用 SWR / React Query
- 用 `React.cache` 在同一请求内去重

**加分项**：讲清服务端取数据后要用 `<Suspense>` 包慢请求做流式，避免整页等最慢的。见 [第 10 章](../02-rendering/10-data-fetching.md)。

**常见错误**：
- 在客户端组件里 `useEffect` + `fetch`——除非必要，否则用服务端组件或 SWR
- 串行 await 多个独立请求——应该并行

## Q5：什么是 stale-while-revalidate

**想听什么**：知不知道 ISR 和缓存失效的底层模型。

**标准答案要点**：
- SWR：先给旧的，后台重建，下次请求给新的
- Next.js 的 `revalidate` 时间窗 / `revalidateTag` 标记失效都基于这个模型
- 失效是"标记"，重建发生在"下一个请求"

**加分项**：讲清 `updateTag` 是 SWR 的例外，它只对当前用户立刻生效（read-your-writes），是用户体验的补丁。见 [第 12 章](../02-rendering/12-revalidating.md)。

## Q6：怎么在 Server Action 里让 UI 反映数据变化

**想听什么**：能不能选对失效 API。

**标准答案要点**：
- 当前用户立刻看到自己的更新：`updateTag(tag)`
- 所有人下次请求看到失效：`revalidateTag(tag, profile)`
- 只重跑动态数据：`refresh()`
- 忘了调这些，UI 就不更新

**加分项**：讲多租户场景下缓存键要带租户 id，否则会串数据。见 [第 50 章](../08-projects/50-saas-multi-tenant.md)。

**常见错误**：
- 用 `revalidateTag` 期望立刻看到自己的更新——那是 `updateTag` 的活
- 忘了配第二参数 `revalidateTag('x')`——已弃用

## Q7：怎么在多实例部署下保证缓存一致

**想听什么**：知不知道 ISR 跨实例的坑。

**标准答案要点**：
- 多实例各自有缓存，`revalidateTag` 只在当前实例标记
- 需要"跨实例协调"——共享存储（Redis）或平台的 distributed revalidation
- 自托管时这是大坑，要查平台能力

**加分项**：讲 Next.js 的 How Revalidation Works 指南专门讨论了多实例协调。见 [第 36 章](../07-deployment-ops/36-cdn-isr-build-caching.md)。

## 延伸阅读

- [官方文档：Caching](https://nextjs.org/docs/app/getting-started/caching)
- [官方文档：Revalidating](https://nextjs.org/docs/app/getting-started/revalidating)
- [官方文档：How Revalidation Works](https://nextjs.org/docs/app/guides/how-revalidation-works)
- [官方文档：Server Actions](https://nextjs.org/docs/app/guides/server-actions)
- [官方文档：Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data)
