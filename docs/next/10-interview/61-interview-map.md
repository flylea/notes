# 61 · 面试知识地图与准备策略

> **一句话结论**：Next.js 面试不是考你背 API，而是考三层能力——会用（能不能搭起来）、懂原理（黑盒拆不拆得开）、能权衡（为什么选这个不选那个）。准备策略只有一条：把"会用"层练熟到不用想，"原理"层靠本仓库模块 02、05、09，"权衡"层靠把每章的"为什么"再过一遍。

## 三层能力模型

| 层 | 能力 | 在本仓库哪练 | 面试官想听到 |
|---|---|---|---|
| L1 会用 | 搭项目、跑通链路 | 模块 01、03、04、06、07 | 能说清步骤，知道文件约定 |
| L2 懂原理 | 解释渲染、缓存、RSC 内部 | 模块 02、09 | 不背 API，讲机制和动机 |
| L3 能权衡 | 在多个方案里选并说理由 | 各章的"为什么"段、模块 08 实战 | 能给对照表，知道代价 |

多数候选人停在 L1。**L2 是分水岭**，L3 是拿 offer 的关键。

## 高频考察维度

按出现频率从高到低：

1. **渲染策略**（CSR / SSR / SSG / ISR / PPR）——几乎必问
2. **服务端/客户端组件边界**——次高频
3. **缓存与失效**——16 起这套变了，是新的区分点
4. **Server Actions 与安全**——中高频
5. **路由与 Proxy**——中频
6. **性能与部署**——看岗位
7. **源码原理**（手写 SSR / RSC）——大厂或资深岗

对应到本仓库：

| 维度 | 主章节 |
|---|---|
| 渲染策略 | [08](../02-rendering/08-rendering-strategies.md)、[09](../02-rendering/09-streaming-and-suspense.md) |
| RSC 边界 | [07](../02-rendering/07-server-client-components.md)、[55](../09-internals/55-rsc-and-flight.md) |
| 缓存 | [11](../02-rendering/11-cache-components.md)、[12](../02-rendering/12-revalidating.md) |
| Server Actions | [13](../02-rendering/13-server-actions.md)、[57](../09-internals/57-build-server-actions.md) |
| 路由 / Proxy | [02](../01-foundation/02-file-conventions.md)、[16](../03-routing-network/16-proxy.md) |
| 性能 / 部署 | [39](../07-deployment-ops/39-performance.md)、[33](../07-deployment-ops/33-build-and-deploy.md) |
| 源码原理 | [53](../09-internals/53-build-minimal-ssr.md)–[60](./60-request-lifecycle.md) |

## 答题框架：四段式

不管什么题，用这个结构答最稳：

1. **先给结论**——面试官不想听你思考过程。
2. **讲机制**——这个 API / 概念在做什么，黑盒里发生了什么。
3. **给权衡**——为什么这么做、不这么做会怎样、有什么代价。
4. **结合场景**——在什么项目里这么用过，踩过什么坑。

举例，问"什么是 RSC"：

- ❌ "RSC 是 React Server Component，是 React 18 引入的，让组件可以在服务端运行……"（背定义，没信息量）
- ✅ "RSC 解决的不是'组件在服务端跑'——那是 SSR。它解决的是让服务端组件和客户端组件长在同一棵树里，服务端那部分以 Flight payload 传到浏览器，代码不进客户端 bundle。代价是信息流单向，客户端要影响服务端得靠 Server Action……"（先讲它解决什么问题，再讲机制，再说代价）

四段式对应到本仓库的"一句话结论 → 为什么 → 常见坑"结构，几乎是同构的。

## 准备清单

### 一周冲刺

- 模块 02 全过一遍（渲染 + 缓存 + Server Actions），这是面试主战场
- [`MIGRATION-16.md`](../../MIGRATION-16.md) 18 条全背下来，能讲清每条为什么变
- 模块 09 的 53、55、57 三章手写实现看懂

### 一个月系统准备

- 上面的 + 模块 01、03、04、06 全章
- 模块 08 实战挑两个项目跟一遍（Notes App 和 Blog）
- 模块 09 剩余章节，至少能口述实现思路

### 拿 offer

- 全部章节 + [`MIGRATION-16.md`](../../MIGRATION-16.md)
- 能在白板上口述 [第 60 章](./60-request-lifecycle.md) 的全链路图
- 能在"多租户 / 多区域 / 性能"这种系统设计题上给方案

## 常见错误回答（避雷）

| 错误 | 为什么错 | 正确方向 |
|---|---|---|
| "RSC 就是组件在服务端渲染" | 那是 SSR | 讲 Flight payload 和边界 |
| "`fetch` 默认缓存" | 16 起不默认 | 讲 `cacheComponents` 和 `"use cache"` |
| "middleware 做鉴权" | 已改名 proxy，且不能做完整鉴权 | 讲双层鉴权 |
| "SSR 一定比 CSR 快" | 不一定，看场景 | 讲权衡 |
| "Server Actions 安全" | 不安全，端点可被直接 POST | 讲动作内独立鉴权 |
| "use client 就是组件只在客户端跑" | 服务端照样渲染它 | 讲边界与 hydration |

## 延伸阅读

- [官方文档：Rendering Philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy)
- [官方文档：Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary)
- [官方文档：How Revalidation Works](https://nextjs.org/docs/app/guides/how-revalidation-works)
