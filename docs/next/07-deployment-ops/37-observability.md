# 37 · 可观测性

> **一句话结论**：Next.js 自己已经被 OpenTelemetry 埋点过了，你只需要在根目录放一个 `instrumentation.ts`，在 `register()` 里初始化 SDK。服务端错误用 `onRequestError` 上报。**限制是 `register()` 每个服务器实例只跑一次**，且它跑在请求处理之前——不能用来做请求级的事。

## 最小可运行示例

```bash
pnpm add @vercel/otel @opentelemetry/sdk-logs @opentelemetry/api-logs @opentelemetry/instrumentation
```

```ts
// instrumentation.ts
import { registerOTel } from '@vercel/otel'

export function register() {
  registerOTel({ serviceName: 'next-app' })
}
```

```ts
// instrumentation.ts —— 加上错误上报
import { type Instrumentation } from 'next'
import { registerOTel } from '@vercel/otel'

export function register() {
  registerOTel({ serviceName: 'next-app' })
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const message = err instanceof Error ? err.message : String(err)
  const digest =
    typeof err === 'object' && err !== null && 'digest' in err
      ? String(err.digest)
      : undefined

  await fetch('https://your-collector.example.com/report-error', {
    method: 'POST',
    body: JSON.stringify({ message, digest, request, context }),
    headers: { 'Content-Type': 'application/json' },
  })
}
```

文件必须放在**项目根目录**（用 `src/` 的话放在 `src/` 里，和 `app` 同级），**不能放进 `app/` 或 `pages/`**。用 `pageExtensions` 加后缀的话，文件名也要跟着改。

## `register()` 做什么、不做什么

`register()` 在新服务器实例启动时**被调用一次**，并且**必须完成之后服务器才处理请求**。

这条约束决定了两件事：

**能做**：初始化全局单例——OTel SDK、日志器、APM 客户端、环境校验。这些都是一次性的。

**不能做**：

- **不能拿请求上下文**。没有 `cookies()`、`headers()`，因为还没有请求。
- **不能做慢操作**。所有请求都在等它完成，一个 3 秒的初始化会让首屏慢 3 秒。
- **不能依赖每次请求都执行**。它只跑一次，`setInterval` 之类的副作用要自己想清楚生命周期。

启动时的副作用用动态 `import` 放在 `register` 内部，而不是文件顶层：

```ts
// instrumentation.ts
export async function register() {
  await import('package-with-side-effect')
}
```

官方推荐这么写。理由是顶层 import 会在模块加载时就执行，而模块加载的时机不由你控制；放在 `register` 里，所有副作用集中在一个明确的位置。

### 按 runtime 分支

`register` 在**所有环境**都会被调用，包括 Node.js 和 Edge。不支持某个 runtime 的代码必须条件导入：

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./instrumentation-edge')
  }
}
```

`NEXT_RUNTIME` 的取值是 `'nodejs'` 或 `'edge'`。

**这条对 `NodeSDK` 是硬要求**。`@opentelemetry/sdk-node` 和 Edge runtime 不兼容，必须包在 `process.env.NEXT_RUNTIME === 'nodejs'` 判断里。

## `onRequestError` 的三个参数

```ts
// instrumentation.ts
import { type Instrumentation } from 'next'

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  // ...
}
```

精确类型：

```ts
// onRequestError 的类型签名（来自官方 API 参考）
export function onRequestError(
  error: unknown,
  request: {
    path: string     // 资源路径，如 /blog?name=foo
    method: string   // GET、POST 等
    headers: { [key: string]: string | string[] }
  },
  context: {
    routerKind: 'Pages Router' | 'App Router'
    routePath: string        // 路由文件路径，如 /app/blog/[dynamic]
    routeType: 'render' | 'route' | 'action' | 'proxy'
    renderSource:
      | 'react-server-components'
      | 'react-server-components-payload'
      | 'server-rendering'
    revalidateReason: 'on-demand' | 'stale' | undefined
    renderType: 'dynamic' | 'dynamic-resume'
  }
): void | Promise<void>
```

几个要点：

**`error` 的类型是 `unknown`**，不是 `Error`。读取 `message` 或 `digest` 之前必须先收窄。

**它可能不是你抛出的那个原始错误。** 服务端组件渲染期间发生的错误会被 React 处理过。要识别真实错误类型，用错误对象上的 `digest` 属性。

**在 `onRequestError` 里跑的异步任务必须 `await`。** 它由 Next.js 在捕获错误时触发，不 await 的话进程可能在你发出上报之前就继续走了。

**`routeType` 告诉你错误发生在哪**：服务端组件渲染（`'render'`）、Route Handler（`'route'`）、Server Action（`'action'`）、Proxy（`'proxy'`）。这是排查时最有用的一个字段——同样的错误在 Server Action 里和在渲染里，修复方式完全不同。

**`renderType` 的 `'dynamic-resume'` 表示 PPR**。看到这个值说明错误发生在 PPR 的续传阶段（静态外壳已发出，动态部分流式渲染时出错）。这类错误的表现和普通动态渲染不一样——用户已经看到部分页面了。

`onRequestError` 是 15.0.0 引入的，同时 `instrumentation` 从实验特性转为稳定。所以 16 里不需要任何实验标志。

## 手动配置 OpenTelemetry

`@vercel/otel` 覆盖大部分场景。要更细的控制就用原生 SDK：

```bash
pnpm add @opentelemetry/sdk-node @opentelemetry/resources @opentelemetry/semantic-conventions @opentelemetry/sdk-trace-node @opentelemetry/exporter-trace-otlp-http
```

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node')
  }
}
```

```ts
// instrumentation.node.ts
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'next-app',
  }),
  spanProcessor: new SimpleSpanProcessor(new OTLPTraceExporter()),
})
sdk.start()
```

这和 `@vercel/otel` 等价，但能改一些 `@vercel/otel` 没暴露的选项。**代价是不支持 Edge runtime**——需要 Edge 支持就必须用 `@vercel/otel`。

## 自动埋点的 Span

Next.js 已经给关键路径埋好了 span，属性遵循 OpenTelemetry 语义约定，另外在 `next` 命名空间下加了自定义属性：

| 属性 | 含义 |
|---|---|
| `next.span_name` | span 名称 |
| `next.span_type` | span 类型唯一标识 |
| `next.route` | 路由模式，如 `/[param]/user` |
| `next.rsc` | 是否 RSC 请求（如预取） |
| `next.page` | 内部值，指向 `page.ts` / `layout.ts` 等特殊文件。**必须和 `next.route` 配对使用**——`/layout` 单独用无法区分 `/(groupA)/layout.ts` 和 `/(groupB)/layout.ts` |

主要 span 类型：

| Span | `next.span_type` | 含义 |
|---|---|---|
| `[http.method] [next.route]` | `BaseServer.handleRequest` | 每个请求的根 span |
| `render route (app) [next.route]` | `AppRender.getBodyResult` | App Router 渲染路由 |
| `fetch [http.method] [http.url]` | `AppRender.fetch` | 代码里的 fetch 请求 |
| `executing api route (app) [next.route]` | `AppRouteRouteHandlers.runHandler` | Route Handler 执行 |
| `generateMetadata [next.page]` | `ResolveMetadata.generateMetadata` | 元数据生成（一条路由可能有多个） |
| `resolve page components` | `NextNodeServer.findPageComponents` | 解析页面组件 |
| `resolve segment modules` | `NextNodeServer.getLayoutOrPageModule` | 加载 layout / page 模块 |
| `start response` | `NextNodeServer.startResponse` | 首字节已发送（零长度 span） |

`fetch` span 可以用 `NEXT_OTEL_FETCH_DISABLED=1` 关掉——你用了自己的 fetch 埋点库时有用。

**默认只输出一部分 span。** 想看更多设 `NEXT_OTEL_VERBOSE=1`。

追踪起点是 `GET /requested/pathname` 这个根 span，其他 span 都嵌在它下面。

## 自定义 Span

```ts
// lib/github.ts
import { trace } from '@opentelemetry/api'

export async function fetchGithubStars() {
  return await trace
    .getTracer('nextjs-example')
    .startActiveSpan('fetchGithubStars', async (span) => {
      try {
        return await getValue()
      } finally {
        span.end()
      }
    })
}
```

`register` 会在你的代码运行前执行，所以那时创建的 span 能正确挂到导出的 trace 上。`span.end()` 放在 `finally` 里——异常路径不结束 span 会泄漏。

## Analytics 集成

```tsx
// app/layout.tsx
import { GoogleTagManager } from '@next/third-parties/google'
import { GoogleAnalytics } from '@next/third-parties/google'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <GoogleTagManager gtmId="GTM-XYZ" />
      <body>{children}</body>
      <GoogleAnalytics gaId="G-XYZ" />
    </html>
  )
}
```

```bash
pnpm add @next/third-parties@latest
```

`@next/third-parties` 目前是**实验性**库，官方建议用 `latest` 或 `canary` 装。它做的主要优化是**默认在 hydration 之后才加载原始脚本**——不阻塞首屏。

发送事件：

```tsx
// app/event-button.tsx
'use client'

import { sendGTMEvent } from '@next/third-parties/google'

export function EventButton() {
  return (
    <button onClick={() => sendGTMEvent({ event: 'buttonClicked', value: 'xyz' })}>
      发送事件
    </button>
  )
}
```

`sendGAEvent` 的签名不同，注意别混：`sendGAEvent('event', 'buttonClicked', { value: 'xyz' })`。

**页面浏览自动上报**：Google Analytics 会在浏览器 history 变化时自动发 pageview，所以 Next.js 的客户端导航不需要额外配置。前提是在 GA 后台开启了「Enhanced Measurement」并勾选「Page changes based on browser history events」。手动发 pageview 的话要**关掉默认的**，否则数据重复。

`@next/third-parties` 还提供 `GoogleMapsEmbed`（默认 lazy load）和 `YouTubeEmbed`（底层用 `lite-youtube-embed`，比原生 iframe 快得多）。

## Core Web Vitals

```tsx
// app/web-vitals.tsx
'use client'

import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals((metric) => {
    // 上报到你的分析服务
    navigator.sendBeacon('/api/vitals', JSON.stringify(metric))
  })
  return null
}
```

挂在根布局里就能收集全站的真实用户指标。用 `sendBeacon` 而不是 `fetch` 是因为它不阻塞卸载——用户离开页面时也能发出去。

`webVitalsAttribution` 配置可以定位 Web Vitals 问题的来源：

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  webVitalsAttribution: ['CLS', 'LCP'],
}
export default nextConfig
```

## 日志与链路追踪的串联

日志和 trace 各自独立的话，排查时你没法把一条错误日志和它的请求链路对上。串联的方式是在日志里带上 trace ID：

```ts
// lib/logger.ts
import { trace } from '@opentelemetry/api'

export function log(level: 'info' | 'error', message: string, meta?: unknown) {
  const span = trace.getActiveSpan()
  const ctx = span?.spanContext()

  console[level](
    JSON.stringify({
      level,
      message,
      // 关键：这两个字段把日志和 trace 串起来
      traceId: ctx?.traceId,
      spanId: ctx?.spanId,
      ...(typeof meta === 'object' && meta !== null ? meta : { meta }),
    })
  )
}
```

`trace.getActiveSpan()` 拿当前活跃 span，`spanContext()` 给出 `traceId` 和 `spanId`。日志后端支持的话，直接就能从日志跳到 trace 视图。

`onRequestError` 里也应该带上这两个字段——否则一条错误上报只能看到堆栈，看不到它属于哪次请求、那次请求里还发生了什么。

自托管时 Next.js 会往 stdout 打日志。容器环境里要确保日志被采集（stdout 不丢），并且**别把请求体或敏感头打进日志**——`request.headers` 里可能带 cookie 和 authorization。

## 常见坑

- **现象**：`instrumentation.ts` 放在 `app/` 目录里，完全不生效。
  **原因**：它必须在**项目根目录**（或用 `src/` 时放在 `src/` 里），不能放进 `app/` 或 `pages/`。
  **解法**：移到正确位置，重启 dev server。

- **现象**：用了 `NodeSDK` 后 Edge runtime 路由报错。
  **原因**：`@opentelemetry/sdk-node` 与 Edge runtime 不兼容。
  **解法**：包在 `if (process.env.NEXT_RUNTIME === 'nodejs')` 里条件导入。需要 Edge 支持就换 `@vercel/otel`。

- **现象**：错误上报时有时无。
  **原因**：`onRequestError` 里的异步任务没 `await`，进程在上报完成前就继续了。
  **解法**：把上报逻辑 `await` 掉，或至少确保它被正确排队。

- **现象**：`onRequestError` 里读 `error.message` 报类型错误。
  **原因**：`error` 的类型是 `unknown`，不是 `Error`。
  **解法**：先收窄：`err instanceof Error ? err.message : String(err)`。

- **现象**：上报的堆栈看不出真实错误。
  **原因**：服务端组件渲染期间的错误会被 React 处理，抛出的不是原始实例。
  **解法**：用错误对象上的 `digest` 属性识别实际错误类型。

- **现象**：看不到详细的 span。
  **原因**：Next.js 默认只输出一部分 span。
  **解法**：设 `NEXT_OTEL_VERBOSE=1`。

- **现象**：GA 里的 pageview 数据翻倍。
  **原因**：同时开了自动 pageview 和手动上报。
  **解法**：二选一。手动上报的话关掉 GA 后台的默认 pageview 测量。

- **现象**：`register()` 里的初始化拖慢了首屏。
  **原因**：`register` 必须完成后服务器才处理请求，慢初始化会直接变成启动延迟。
  **解法**：只做必要的同步初始化，把耗时操作挪到请求路径之外或做成懒加载。

- **现象**：日志里出现了 cookie 和 authorization 头。
  **原因**：直接把 `request.headers` 整个打进了日志。
  **解法**：上报前过滤敏感头。`onRequestError` 的 `request.headers` 是原始请求头，包含凭据。

## 旧写法 vs 新写法

| 场景 | 旧写法 | 16 写法 |
|---|---|---|
| 启用 instrumentation | `experimental.instrumentationHook: true` | **无需标志**（15 起稳定） |
| 错误上报 | 无统一入口 | **`onRequestError`**（15.0.0 引入） |
| 第三方脚本 | 手写 `<Script>` + 策略配置 | `@next/third-parties` 组件 |
| Core Web Vitals | 自己接 web-vitals 库 | `useReportWebVitals`（`next/web-vitals`） |

## API / 配置速查

| 导出 / API | 签名 | 说明 |
|---|---|---|
| `register` | `() => void \| Promise<void>` | 每个服务器实例调一次，必须完成后才处理请求 |
| `onRequestError` | `(error, request, context) => void \| Promise<void>` | 上报服务端错误 |
| `Instrumentation.onRequestError` | 类型导入自 `next` | 给导出加类型 |
| `registerOTel` | `({ serviceName }) => void` | `@vercel/otel` 的初始化 |
| `trace.getActiveSpan()` | `() => Span \| undefined` | 拿当前 span |
| `span.spanContext()` | `() => SpanContext` | 拿 `traceId` / `spanId` |
| `useReportWebVitals` | `(cb: (metric) => void) => void` | 收集真实用户指标 |
| `sendGTMEvent` | `(data) => void` | GTM 事件 |
| `sendGAEvent` | `(type, name, params) => void` | GA 事件 |

| 环境变量 | 作用 |
|---|---|
| `NEXT_RUNTIME` | `nodejs` \| `edge`，用于条件导入 |
| `NEXT_OTEL_VERBOSE=1` | 输出更多 span |
| `NEXT_OTEL_FETCH_DISABLED=1` | 关闭内置 fetch span |

| 组件 | 导入自 |
|---|---|
| `GoogleTagManager` | `@next/third-parties/google` |
| `GoogleAnalytics` | `@next/third-parties/google` |
| `GoogleMapsEmbed` | `@next/third-parties/google` |
| `YouTubeEmbed` | `@next/third-parties/google` |

| 配置 | 作用 |
|---|---|
| `webVitalsAttribution` | 定位 Web Vitals 问题来源 |
| `instrumentationClientInject` | 注入额外的客户端插桩模块 |

## 延伸阅读

- [官方文档：OpenTelemetry](https://nextjs.org/docs/app/guides/open-telemetry)
- [官方文档：instrumentation.js](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)
- [官方文档：Third Party Libraries](https://nextjs.org/docs/app/guides/third-party-libraries)
- [官方文档：useReportWebVitals](https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals)
- [官方文档：webVitalsAttribution](https://nextjs.org/docs/app/api-reference/config/next-config-js/webVitalsAttribution)
- [@vercel/otel 文档](https://www.npmjs.com/package/@vercel/otel)
- [OpenTelemetry 概念入门](https://opentelemetry.io/docs/concepts/observability-primer/)
- [OpenTelemetry Collector 入门](https://opentelemetry.io/docs/collector/getting-started/)
- [官方示例：with-opentelemetry](https://github.com/vercel/next.js/tree/canary/examples/with-opentelemetry)
