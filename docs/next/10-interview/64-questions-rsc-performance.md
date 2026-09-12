# 64 · 高频题：RSC / 性能 / 安全

> **一句话结论**：这三块考的是细节——RSC 边界与序列化、性能瓶颈定位、Server Actions 的安全模型。容易踩坑的点恰恰是网上教程讲错最多的点（比如"Date 不能过边界"其实是错的）。

## Q1：服务端组件和客户端组件的边界在哪

**想听什么**：能不能讲清 `"use client"` 的传播规则和限制。

**标准答案要点**：
- 默认是服务端组件
- `"use client"` 标记的文件及其 import 的子树都是客户端模块
- 客户端组件能 import 服务端组件吗——不能直接，但服务端组件可以作为 `children` 传给客户端组件
- 信息流单向：服务端 → 客户端

**加分项**：讲为什么边界要尽量靠近叶子——客户端子树越大，bundle 越大。见 [第 07 章](../02-rendering/07-server-client-components.md) 和 [第 58 章](../09-internals/58-client-components-hydration.md)。

**常见错误**：
- "客户端组件不能被服务端渲染"——服务端照样渲染它的初始 HTML
- 在客户端组件里 import 服务端组件——方向反了

## Q2：服务端组件能给客户端组件传什么 props

**想听什么**：知不知道序列化限制。

**标准答案要点**：
- 可序列化：基本类型、对象/数组、`Date`、`Map`、`Set`、`TypedArray`、`ArrayBuffer`、`Promise`
- 不可序列化：类实例（除上面列的内置类型）、函数引用、Symbol、`Error`
- 函数要过边界只能用 Server Action（`"use server"`）

**加分项**：纠正常见误区——**`Date` 是可序列化的**（React 文档明确列出），真正过不去的是普通类实例。见 [第 55 章](../09-internals/55-rsc-and-flight.md)。

**常见错误**：
- "Date、Map 都不能传"——错，它们可以
- 把函数当 props 直接传——报错 `Functions cannot be passed`

## Q3：什么是 hydration mismatch，怎么避免

**想听什么**：知不知道成因和正确写法。

**标准答案要点**：
- 服务端渲染结果与客户端首次渲染不一致
- 常见来源：时间、随机数、`window`/`document` 检测、客户端专属 API
- 避免：把这些值推迟到 `useEffect`

**加分项**：讲 React 19 对 hydration 错误的改进——更细粒度对账，避免整树重渲染。见 [第 58 章](../09-internals/58-client-components-hydration.md)。

**常见错误**：
- 用 `typeof window !== 'undefined'` 在渲染里分支——服务端/客户端结果不同
- `Math.random()` / `Date.now()` 在渲染里——必然不一致

## Q4：Server Actions 安全吗？怎么保证

**想听什么**：知不知道最大的安全坑。

**标准答案要点**：
- 不安全——客户端能拿到 action id，任何人能直接 POST
- 每个 action 内部必须独立鉴权（验 session + 越权校验）
- Proxy 可做乐观重定向，但不能作为唯一鉴权
- 闭包变量可被篡改，关键参数用 `bind` 在服务端固定

**加分项**：讲双层鉴权模型，给一个越权校验示例。见 [第 13 章](../02-rendering/13-server-actions.md) 和 [第 57 章](../09-internals/57-build-server-actions.md)。

**常见错误**：
- "Server Actions 自动鉴权"——没有，要自己写
- "Proxy 兜住就够了"——端点可绕过 Proxy

## Q5：Next.js 性能怎么优化

**想听什么**：能不能按瓶颈定位。

**标准答案要点**：
- 包体积：bundle 分析，把边界推近叶子，动态 import 重库
- 首屏：Streaming + `loading.tsx`，外壳保持同步快
- 数据：并行优于瀑布，`React.cache` 去重
- 渲染：React Compiler 自动 memoization（需显式开启）
- 缓存：`cacheComponents` + 合适的 `cacheLife`

**加分项**：讲 16 起构建输出移除了 `size` / `First Load JS` 指标，要看包体积得用 bundle analyzer。见 [第 39 章](../07-deployment-ops/39-performance.md)。

**常见错误**：
- 把所有组件标 `"use client"`——bundle 爆炸
- 在外壳（layout）里 await 慢请求——流开不了

## Q6：什么是 React Compiler，要不要开

**想听什么**：知不知道它的边界。

**标准答案要点**：
- 自动 memoization，替代手写 `useMemo` / `useCallback`
- 16 起稳定，但**默认不开启**，需装 `babel-plugin-react-compiler` 并配置
- 不是银弹——有性能开销，对纯展示组件不一定有收益

**加分项**：讲什么时候开（交互密集、状态更新频繁）、什么时候不开（静态内容多）。见 [第 39 章](../07-deployment-ops/39-performance.md)。

## Q7：Turbopack 和 webpack 怎么选

**想听什么**：知不知道什么时候被迫退回。

**标准答案要点**：
- 16 起 Turbopack 是默认打包器（dev + build）
- 有自定义 webpack 配置时 `next build` 会失败，需 `--webpack` 退回
- Turbopack 用函数级缓存，增量粒度比 webpack 细

**加分项**：讲 Turbopack 配置位置在顶层 `turbopack`（不在 `experimental` 下），见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 2、12 条。见 [第 59 章](../09-internals/59-turbopack-and-compilation.md)。

**常见错误**：
- "Turbopack 完全兼容 webpack 配置"——不兼容，自定义配置会构建失败
- 在 `experimental.turbopack` 配——位置错了

## Q8：Data Security 是什么概念

**想听什么**：知不知道服务端/客户端边界对数据安全的影响。

**标准答案要点**：
- 客户端组件代码客户端能看到——敏感数据不能放客户端组件
- 服务端组件代码不进客户端 bundle——敏感逻辑放这里
- props 过边界时不能带敏感字段
- Server Action 返回值也不要带敏感数据

**加分项**：给一个反例——把数据库密码当 props 传给客户端组件，等于泄露。见 [第 38 章](../07-deployment-ops/38-security-and-auth.md)。

## 延伸阅读

- [官方文档：Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [官方文档：Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary)
- [官方文档：Server Actions](https://nextjs.org/docs/app/guides/server-actions)
- [官方文档：Data Security](https://nextjs.org/docs/app/guides/data-security)
- [官方文档：Package Bundling](https://nextjs.org/docs/app/guides/package-bundling)
