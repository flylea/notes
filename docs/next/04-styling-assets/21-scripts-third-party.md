# 21 · Script 与第三方库

> **一句话结论**：`next/script` 的默认策略是 `afterInteractive`，**大多数第三方脚本用默认值就对了**；只有「必须在任何 Next.js 代码之前跑」的脚本（机器人检测、Cookie 同意）才用 `beforeInteractive`，而它只能放在根布局里。`worker` 策略仍是实验性的，且**在 App Router 下不可用**——别照着 Pages Router 的教程抄。

## 最小可运行示例

```tsx
// app/layout.tsx
import Script from 'next/script'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
      {/* 默认 strategy="afterInteractive" */}
      <Script src="https://example.com/script.js" />
    </html>
  )
}
```

放在根布局 = 所有路由都加载；放在某个 `layout.tsx` 或 `page.tsx` = 只有那棵子树加载。无论放在哪里，**Next.js 保证同一个脚本只加载一次**，即使在同一布局下反复导航也不会重复注入。

## 四种加载策略

```tsx
// app/page.tsx
import Script from 'next/script'

export default function Page() {
  return (
    <>
      <Script src="https://example.com/a.js" strategy="beforeInteractive" />
      <Script src="https://example.com/b.js" strategy="afterInteractive" />
      <Script src="https://example.com/c.js" strategy="lazyOnload" />
    </>
  )
}
```

| 策略 | 加载时机 | 注入方式 | 位置限制 |
|---|---|---|---|
| `beforeInteractive` | 在任何 Next.js 代码和 hydration 之前 | 服务端注入初始 HTML 的 `<head>` | **只能放根布局** |
| `afterInteractive`（默认） | hydration 开始之后，尽早 | 客户端注入 | 任意 page / layout |
| `lazyOnload` | 浏览器空闲时 | 客户端注入 | 任意 page / layout |
| `worker` | Web Worker 中 | Partytown | **仅 `pages/`，App Router 不可用** |

### `beforeInteractive`：代价最高

这个策略的脚本会被注入服务端的初始 HTML，在任何 first-party 代码之前下载并**按声明顺序**执行。

「不阻塞 hydration」是它的设计目标——脚本预加载并优先拉取，但**执行不会阻塞页面 hydration**。它仍然会占用关键路径上的网络带宽，所以官方措辞很明确：

> 这个策略只应用于**必须尽快获取的关键脚本**。

官方给的两个例子是：**机器人检测**、**Cookie 同意管理**。共同点是「必须在页面其他逻辑跑起来之前就完成判断」。

```tsx
// app/layout.tsx
import Script from 'next/script'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* 无论写在组件里的哪个位置，都会被注入到 <head> */}
        <Script
          src="https://example.com/bot-detect.js"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  )
}
```

两条容易踩的细节：

1. **无论你把 `<Script>` 写在组件的什么位置，`beforeInteractive` 的脚本一定被注入 `<head>`**。
2. **每次文档加载只执行一次**。客户端导航不会重新执行——包括只改变根参数（`/en` → `/fi`）的导航，因为根布局没有变化。

### `afterInteractive`：默认，也是绝大多数场景的答案

脚本在客户端注入，在页面完成部分或全部 hydration 后加载。因为它能访问已 hydration 的 DOM，也不占用首屏关键路径。官方列出的典型用途：**标签管理器（Tag Manager）**、**分析（Analytics）**。

```tsx
// app/page.tsx
import Script from 'next/script'

export default function Page() {
  return <Script src="https://example.com/analytics.js" strategy="afterInteractive" />
}
```

### `lazyOnload`：真正的低优先级

在浏览器空闲时间加载，且要等页面上所有资源都拉取完成。适合**后台任务和低优先级脚本**：

```tsx
// app/page.tsx
import Script from 'next/script'

export default function Page() {
  return <Script src="https://example.com/chat-widget.js" strategy="lazyOnload" />
}
```

官方给的例子：**客服聊天插件**、**社交媒体挂件**。它们的共同点是「晚几秒出现完全没关系」。

### `worker`：App Router 下不可用

```tsx
// pages/home.tsx —— 注意是 pages/，不是 app/
import Script from 'next/script'

export default function Home() {
  return <Script src="https://example.com/script.js" strategy="worker" />
}
```

这个策略把脚本卸载到 Web Worker 里执行（底层用 Partytown），把主线程留给应用本身。三个限制：

1. **尚未稳定**，官方明确标注 experimental。
2. **在 App Router 下不工作**，只能在 `pages/` 目录使用。
3. 需要开启 `experimental.nextScriptWorkers` 并安装 `@qwik.dev/partytown`。

另外 Turbopack 目前也**不支持** `experimental.nextScriptWorkers`（官方标注为「未来计划实现」）。所以 16 默认 Turbopack 的前提下，这个策略基本可以视为不可用。Turbopack 成为默认打包器的变更见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 2 条。

### 策略选择的判断流程

```
脚本必须在页面任何逻辑之前就绪？  → 是 → beforeInteractive（仅根布局）
                                 → 否 → 会影响首屏可见内容或转化埋点？ → 是 → afterInteractive（默认）
                                                                      → 否 → lazyOnload
```

## 事件回调

三个回调都**只能在客户端组件里用**：

```tsx
// app/components/analytics-init.tsx
'use client'

import Script from 'next/script'

export default function AnalyticsInit() {
  return (
    <Script
      src="https://cdn.example.com/lib.js"
      onLoad={() => console.log('脚本加载完成，只执行一次')}
      onReady={() => console.log('脚本就绪，每次组件挂载都会执行')}
      onError={(e: Error) => console.error('脚本加载失败', e)}
    />
  )
}
```

| 回调 | 触发时机 |
|---|---|
| `onLoad` | 脚本加载完成后，**仅一次** |
| `onReady` | 脚本加载完成后 + **每次组件重新挂载**（含路由导航后回来） |
| `onError` | 加载失败时 |

`onLoad` 和 `onError` **不能与 `beforeInteractive` 一起使用**——那个阶段还没有客户端组件。需要在这类脚本上挂钩子就用 `onReady`。

`onReady` 的典型场景是需要「每次进入页面都重新初始化」的嵌入式组件（地图、播放器）：组件重新挂载时再执行一遍初始化，否则第二次进入时容器是空的。

## 内联脚本

内联脚本用 `id` 标记，框架才能追踪和优化它：

```tsx
// app/layout.tsx
import Script from 'next/script'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* 必须给 id，否则框架无法追踪 */}
        <Script id="show-banner">
          {`document.getElementById('banner')?.classList.remove('hidden')`}
        </Script>
      </body>
    </html>
  )
}
```

也可以用 `dangerouslySetInnerHTML={{ __html: '...' }}` 的写法，效果相同。**内联脚本必须给 `id`**，这是硬性要求。

其他 DOM 属性（`nonce`、`data-*`）会自动转发到最终生成的 `<script>` 上：

```tsx
// app/layout.tsx
<Script src="https://example.com/script.js" id="example" nonce="XUENAJFW" data-test="script" />
```

## `@next/third-parties`

常见第三方服务（GA、GTM、YouTube、Google Maps）不要手写 `<Script>`，用官方封装的包——它已经处理好了加载时机、去重、懒加载：

```bash
pnpm add @next/third-parties@latest next@latest
```

> 官方标注该库为 **experimental**，建议装 `latest` 或 `canary`。

### Google Analytics 4

```tsx
// app/layout.tsx
import { GoogleAnalytics } from '@next/third-parties/google'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
      <GoogleAnalytics gaId="G-XYZ" />
    </html>
  )
}
```

发送事件（需要客户端组件）：

```tsx
// app/components/event-button.tsx
'use client'

import { sendGAEvent } from '@next/third-parties/google'

export function EventButton() {
  return (
    <button onClick={() => sendGAEvent('event', 'buttonClicked', { value: 'xyz' })}>
      发送事件
    </button>
  )
}
```

**页面浏览是自动的**。GA 会在浏览器 history 状态变化时自动记录 pageview，所以客户端路由切换不需要额外配置。前提是 GA 后台的「增强衡量」已开启，且勾选了「基于浏览器历史事件检测的页面变更」。如果手动发 pageview，记得关掉默认的，否则数据会重复。

### Google Tag Manager

```tsx
// app/layout.tsx
import { GoogleTagManager } from '@next/third-parties/google'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <GoogleTagManager gtmId="GTM-XYZ" />
      <body>{children}</body>
    </html>
  )
}
```

发送事件用 `sendGTMEvent({ event: 'buttonClicked', value: 'xyz' })`，需要在客户端组件里调用。

| 选项 | 必需 | 说明 |
|---|---|---|
| `gtmId` | 通常是 | 容器 ID，以 `GTM-` 开头 |
| `gtmScriptUrl` | 否 | 默认 `https://www.googletagmanager.com/gtm.js`，服务端标签托管时改这个 |
| `dataLayer` / `dataLayerName` | 否 | 初始化容器时的 dataLayer 对象与名称（默认 `dataLayer`） |

> 如果已经装了 GTM，**不要再单独装 `<GoogleAnalytics>`**——在 GTM 里配置 GA 即可，否则同一份数据会被上报两次。

### YouTube 嵌入

```tsx
// app/page.tsx
import { YouTubeEmbed } from '@next/third-parties/google'

export default function Page() {
  return <YouTubeEmbed videoid="ogfYd705cRs" height={400} params="controls=0" />
}
```

底层用 `lite-youtube-embed`：先渲染一张缩略图和播放按钮，点击后才真正加载 YouTube 的 iframe。这能省掉一个页面上百 KB 的第三方 JS。其他选项：`width` / `height`（默认 `auto`）、`params`（播放器参数查询串）、`playlabel`（播放按钮的无障碍标签）。

### Google Maps 嵌入

```tsx
// app/page.tsx
import { GoogleMapsEmbed } from '@next/third-parties/google'

export default function Page() {
  return (
    <GoogleMapsEmbed
      apiKey="XYZ"
      height={200}
      width="100%"
      mode="place"
      q="Brooklyn+Bridge,New+York,NY"
    />
  )
}
```

`apiKey` 和 `mode` 必需；`q` / `center` / `zoom` 视模式而定；`loading` 默认 `lazy`，首屏可见的嵌入改成 `eager`。

> 嵌入地图会带上 Google 的 Cookie 和追踪。GDPR 场景下需要先取得用户同意再渲染——常见做法是先用一张静态图占位，用户点击后才换成真正的嵌入。

## 与 CSP 配合

严格 CSP 下，内联脚本和第三方域名都会被拦。两种做法：

### 非严格模式：直接在配置里放行

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
              "connect-src 'self' https://www.google-analytics.com",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

代价：`'unsafe-inline'` 会让 CSP 对 XSS 的防护基本失效。好处：**页面可以保持静态渲染**，能被 CDN 缓存。

### 严格模式：nonce + proxy

nonce 由 proxy 每次请求生成，写进 `Content-Security-Policy` 头，同时放进自定义头 `x-nonce` 供服务端组件读取。proxy 的完整写法见第 16 章，CSP 相关的部分是这样：

```ts
// proxy.ts —— 只保留 CSP 相关逻辑
import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  // 每次请求生成一个不可预测的 nonce
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'

  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self' 'nonce-${nonce}';
    object-src 'none';
    base-uri 'self';
  `.replace(/\s{2,}/g, ' ').trim()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}
```

```tsx
// app/page.tsx —— 服务端组件读 nonce 并传给 <Script>
import { headers } from 'next/headers'
import Script from 'next/script'

export default async function Page() {
  const nonce = (await headers()).get('x-nonce')

  return (
    <Script
      src="https://www.googletagmanager.com/gtag/js"
      strategy="afterInteractive"
      nonce={nonce}
    />
  )
}
```

**框架会自动给以下内容打上 nonce**：React / Next.js 运行时脚本、页面专属 bundle、框架生成的内联样式和脚本、以及显式传了 `nonce` 的 `<Script>`。不需要手工给每个 `<script>` 加。`@next/third-parties` 的 `<GoogleAnalytics>` 也接受 `nonce` 选项。

**代价很重**：nonce 方案要求**所有页面动态渲染**。静态优化和 ISR 被禁用，页面无法被 CDN 缓存，每次请求都要服务端渲染。**PPR 与基于 nonce 的 CSP 不兼容**，因为静态 shell 的脚本拿不到 nonce。另外开发环境必须加 `'unsafe-eval'`——React 用 `eval` 在浏览器里重建服务端错误堆栈，生产环境不需要。

## 常见坑

- **现象**：照着教程用了 `strategy="worker"`，脚本完全不执行。
  **原因**：`worker` 策略不支持 App Router，只能在 `pages/` 用；而且它仍是实验特性，Turbopack 也不支持。
  **解法**：改用 `lazyOnload`，或接受主线程开销用 `afterInteractive`。

- **现象**：`beforeInteractive` 写在某个页面组件里，构建报错。
  **原因**：这个策略的脚本必须放在根布局，因为它需要被注入初始 HTML。
  **解法**：移到 `app/layout.tsx`。

- **现象**：`onLoad` 加在 `beforeInteractive` 的脚本上，回调从不触发。
  **原因**：`onLoad` / `onError` 不能与 `beforeInteractive` 一起使用，而且这三个回调都只在客户端组件里生效。
  **解法**：改用 `onReady`，并确保所在文件是 `'use client'`。

- **现象**：内联脚本不执行。
  **原因**：缺少 `id`，框架无法追踪和优化它。
  **解法**：加 `id="..."`。

- **现象**：GA 的数据比实际访问量翻倍。
  **原因**：同时装了 `<GoogleTagManager>` 和 `<GoogleAnalytics>`，两边都在上报；或者手动发了 pageview 又没关掉默认的。
  **解法**：只用其中一个。已经用 GTM 就在 GTM 里配 GA。

- **现象**：加了 CSP 之后，页面白屏，控制台一堆 CSP 报错。
  **原因**：`script-src` 没放行 `'unsafe-eval'`（开发环境需要），或者漏了第三方域名；用 nonce 方案时忘了把 nonce 加到 `script-src`。
  **解法**：开发环境补 `'unsafe-eval'`；按报错里提到的指令逐条补域名。

- **现象**：用了 nonce 之后，构建产物全是动态渲染，CDN 命中率掉到零。
  **原因**：nonce 必须每次请求生成，因此所有页面都得动态渲染，静态优化和 ISR 都失效。
  **解法**：如果业务允许 `'unsafe-inline'`，就回到 `next.config.ts` 里配 CSP，保住静态渲染；否则接受动态渲染的成本。

- **现象**：`@next/third-parties` 里的 `<GoogleMapsEmbed>` 被合规检查指出问题。
  **原因**：嵌入会带上第三方 Cookie 和追踪。
  **解法**：先用静态占位图，取得同意后再渲染组件。

- **现象**：同一个脚本在多次路由切换后被注入了好几遍。
  **原因**：脚本放在了会被卸载重建的组件里，且用的是原生 `<script>` 标签而非 `next/script`。
  **解法**：改用 `next/script`——框架保证同一脚本只加载一次。

## 旧写法 vs 新写法

| 场景 | 旧 | 新（16.3） |
|---|---|---|
| 脚本加载 | `<script>` 标签手写 | **`next/script` 的 `<Script>`** |
| 首屏关键脚本 | `strategy="beforeInteractive"` 放 `_document.js` | 放**根布局** |
| 第三方服务 | 手写脚本片段 | **`@next/third-parties`** |
| `worker` 策略 | 在 `pages/` 可用 | **App Router 不可用，Turbopack 也不支持** |

## API / 配置速查

| Prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `src` | `string` | — | 外部脚本地址；用内联脚本时可不填 |
| `strategy` | `'beforeInteractive' \| 'afterInteractive' \| 'lazyOnload' \| 'worker'` | `'afterInteractive'` | 加载策略 |
| `id` | `string` | — | **内联脚本必需** |
| `onLoad` | `() => void` | — | 仅客户端组件，不能配 `beforeInteractive` |
| `onReady` | `() => void` | — | 仅客户端组件，每次挂载都触发 |
| `onError` | `(e: Error) => void` | — | 仅客户端组件 |
| `nonce` | `string` | — | CSP nonce，自动转发到底层 `<script>` |

| `@next/third-parties/google` 导出 | 用途 |
|---|---|
| `GoogleAnalytics` | GA4（`gaId`） |
| `sendGAEvent` | 发送 GA 事件 |
| `GoogleTagManager` | GTM 容器（`gtmId`） |
| `sendGTMEvent` | 发送 GTM 事件 |
| `YouTubeEmbed` | 轻量 YouTube 嵌入（`videoid`） |
| `GoogleMapsEmbed` | Google Maps 嵌入（`apiKey`、`mode`） |

| 相关配置 | 说明 |
|---|---|
| `experimental.nextScriptWorkers` | 开启 `worker` 策略（Turbopack 不支持） |

## 延伸阅读

- [官方文档：Script 组件 API 参考](https://nextjs.org/docs/app/api-reference/components/script)
- [官方文档：加载与优化脚本](https://nextjs.org/docs/app/guides/scripts)
- [官方文档：优化第三方库](https://nextjs.org/docs/app/guides/third-party-libraries)
- [官方文档：Content Security Policy](https://nextjs.org/docs/app/guides/content-security-policy)
- [Partytown 的取舍说明](https://partytown.qwik.dev/trade-offs)
