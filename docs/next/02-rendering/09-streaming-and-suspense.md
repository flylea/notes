# 09 · Streaming 与 Suspense

> **一句话结论**：`loading.tsx` 就是"页面级的 `<Suspense>` 包裹"，它把 fallback 放在路由段的边缘；`<Suspense>` 让你自己决定边界放哪。流式传输在 wire 层就是分块 HTML 加内联脚本续接——边界一解析，React 就流一段 HTML 加一个把占位符换掉的脚本。加边界的代价是它可能真的被用上，所以别加不需要的。

## 最小可运行示例

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react'
import { Revenue } from './revenue'
import { RecentOrders } from './recent-orders'
import { Recommendations } from './recommendations'

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <div className="grid grid-cols-2 gap-4">
        <Suspense fallback={<p>Loading revenue...</p>}>
          <Revenue />
        </Suspense>
        <Suspense fallback={<p>Loading orders...</p>}>
          <RecentOrders />
        </Suspense>
      </div>
      <Suspense fallback={<p>Loading recommendations...</p>}>
        <Recommendations />
      </Suspense>
    </div>
  )
}
```

如果 `Revenue` 200ms 解析、`RecentOrders` 1s、`Recommendations` 3s，用户会看到三块**各自**就绪就出现，互不阻塞。

页面级的做法更省事：

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded mb-4" />
      <div className="h-4 w-full bg-gray-200 rounded mb-2" />
      <div className="h-4 w-full bg-gray-200 rounded mb-2" />
      <div className="h-4 w-2/3 bg-gray-200 rounded" />
    </div>
  )
}
```

`loading.tsx` 放在 `page.tsx` 旁边，Next.js 自动把页面内容包进一个 `<Suspense>`，用这个组件当 fallback。

## `loading.tsx` 与 `<Suspense>` 的边界关系

`loading.tsx` **不是**另一套机制，它就是 `<Suspense>`——只不过边界位置由文件系统约定好了。

在组件层级里，`loading.js` 嵌在 `layout.js` 里面，自动把 `page.js` 及其下所有子节点包进 `<Suspense>`：

```
app/dashboard/
├─ layout.tsx          # 立刻渲染，进静态外壳
├─ loading.tsx         # 作为 Suspense fallback
└─ page.tsx            # 被包在 Suspense 里
```

实际渲染结构等价于：

```tsx
// 等价于 Next.js 内部对 app/dashboard/ 做的事
<Layout>
  <Suspense fallback={<Loading />}>
    <Page />
  </Suspense>
</Layout>
```

所以：

- 布局立刻渲染，成为静态外壳的一部分。
- 骨架屏作为 Suspense fallback 立刻显示。
- 页面组件加载完成后，它的 HTML 替换掉骨架屏。

两者的取舍：

| | `loading.tsx` | `<Suspense>` |
|---|---|---|
| 作用范围 | 整个页面 | 任意组件 |
| 设置方式 | 放一个文件 | 显式包裹组件 |
| 导航行为 | fallback 会被预取，导航即刻响应 | 默认不预取 |
| 最适合 | 数据没回来之前确实没什么可渲染的页面 | 大多数页面，要细粒度控制时 |

**关键约束**：预渲染器遇到动态工作时，会**沿着树往上找最近的 Suspense 边界**。如果找不到，构建会以 blocking route 错误失败。树高处的 `loading.tsx` 是一个合法边界，框架找到它就停下——但代价是整页退化成整页骨架，而不是细粒度流式。

所以官方建议：**把 `<Suspense>` 放在靠近动态访问的地方**。

## 为什么这样设计：wire 层到底发生了什么

理解流式传输的物理形态，很多"为什么这样"的问题会自动有答案。

浏览器请求一个页面时，**两条流**协同工作。

### HTML 流

React 的服务端渲染器按 `<Suspense>` 边界切分，产出渐进的 HTML 分块。页面的静态部分（布局、导航、Suspense fallback）先渲染好、立刻发出去。

某个边界的内容就绪时（比如一个异步服务端组件解析了），React 会流过去三段东西：

1. 该边界完成后的 HTML；
2. 一个内联 `<script>`，把 fallback 的 DOM 节点换成新内容；
3. 另一个内联脚本，携带组件 payload，供 React 之后 hydration。

浏览器执行这个替换是**即时的**——不用等页面的 JS bundle 加载完，也不用等 hydration 完成。这才是用户"看到"的东西：页面一段一段地画出来。

### 组件 payload

组件 payload 是组件树的序列化表示，React 用它来 hydration 和处理客户端更新。首次加载时它内嵌在 HTML 流里（就是上面第三段脚本）；**客户端导航**时只请求 payload（带 `rsc: 1` 请求头），完全不传 HTML，React 用它就地更新组件树。

### 在 Network 面板里看真实的分块

用一个脚本读原始分块，比 `curl` 可靠（`curl` 自己有缓冲行为）：

```js
// stream-observer.mjs
const res = await fetch('https://streaming-demo.labs.vercel.dev/suspense-demo', {
  headers: { 'Accept-Encoding': 'identity' }, // 关掉压缩，否则分块会被压缩层缓冲
})

const reader = res.body.getReader()
const decoder = new TextDecoder()
let i = 0
const start = Date.now()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  console.log(`\nchunk ${i++} (+${Date.now() - start}ms)\n`)
  console.log(decoder.decode(value))
}
```

一个有两个兄弟 Suspense 边界的页面，输出大致是：

```text
chunk 0 (+0ms)    # 静态外壳：<head>、CSS、nav、fallback 骨架、
                  # <template id="B:0"> 和 <template id="B:1"> 占位符、引导脚本
chunk 1 (+170ms)  # 组件 payload（self.__next_f.push），供 hydration
chunk 2 (+1000ms) # 天气组件：payload + <div hidden id="S:0">（替换 B:0）
chunk 3 (+3000ms) # 分析面板：payload + <div hidden id="S:1">（替换 B:1）
```

`<template id="B:0">` 就是 Suspense fallback 的占位符。边界解析时，React 流过去一个 `<div hidden id="S:0">`，里面是完成的 HTML，外加一个把它换进页面的脚本。时间戳显示每个边界独立解析。

同一页面用爬虫的 User-Agent 再请求一次，行为完全不同：`fetch` 会一直阻塞到整页渲染完成（约 3 秒），然后 body 一次性到达，没有分阶段的 `+1000ms` / `+3000ms`。这就是爬虫的特殊处理——服务端等完整渲染，发一份完整文档，而不是流式发送。

### 边界也是 hydration 的单位

流式传输顺带带来 selective hydration：React 把 hydration 拆成按边界独立的任务，并优先处理用户正在交互的那部分。没有 Suspense 边界，React 会一次性阻塞地 hydration 整页；有了边界，hydration 被切成小块、让出主线程，交互响应（INP）明显更好。

### 推深动态访问

这是让静态外壳变大的核心手法，适用于 `params`、`searchParams`、`cookies()`、`headers()` 和数据获取：**如果在布局或页面顶层 `await` 其中任何一个，它下面的一切都变成动态的、无法进静态外壳**。

把 promise 往下传，让真正需要的组件在边界内部解析：

```tsx
// app/dashboard/layout.tsx
import { Suspense } from 'react'
import { Nav } from './nav'
import { UserMenu } from './user-menu'
import { cookies } from 'next/headers'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies() // 启动工作，但先不 await

  return (
    <div>
      <Nav>
        <Suspense fallback={<p>Loading user...</p>}>
          <UserMenu cookiePromise={cookieStore} />
        </Suspense>
      </Nav>
      {children}
    </div>
  )
}
```

`<Nav>` 和 `{children}` 都进了静态外壳，因为布局里没有任何 await。只有 `<UserMenu>` 在解析 cookie promise 时挂起。如果改成顶层 `await cookies()`，整个布局连同它的所有子节点都被挡在预渲染之外。

也可以就地用 `.then()` 展开 promise，让子组件拿到普通值而不是 promise：

```tsx
// app/shop/[category]/page.tsx
<Suspense fallback={<p>Loading products...</p>}>
  {params.then(({ category }) => (
    <ProductGrid category={category} />
  ))}
</Suspense>
```

这样 `ProductGrid` 保持简单（收 `string` 而不是 `Promise`），同时 params 的访问仍被推迟到边界内部。

### 嵌套边界做渐进揭示

边界可以嵌套，形成分层的加载体验。比如商品页：先出头部，再出商品详情，最后出评论。

```tsx
// app/product/[id]/page.tsx
import { Suspense } from 'react'
import { ProductDetails } from './product-details'
import { Reviews } from './reviews'

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div>
      <h1>Product</h1>
      <Suspense fallback={<p>Loading product details...</p>}>
        <ProductDetails id={id} />
        <Suspense fallback={<p>Loading reviews...</p>}>
          <Reviews productId={id} />
        </Suspense>
      </Suspense>
    </div>
  )
}
```

外层边界在 `ProductDetails` 解析前显示"Loading product details..."；它一解析，内层边界才可见，显示"Loading reviews..."直到 `Reviews` 解析。这就是渐进揭示。

## 骨架屏设计原则

骨架屏不只是"占位"，它直接影响 CLS。

- **尺寸必须对齐**。fallback 被真实内容替换时浏览器会重排。骨架和最终内容尺寸不一致，周围布局就会跳。卡片网格的骨架要用和最终卡片一样的宽高。
- **用固定或 `min-height` 容器把空间预留出来**。内容到达之前，空间就已经占好。
- **fallback 本身要轻**。它是静态外壳的一部分，会被立刻发出，别在里面塞数据请求。
- **别在 fallback 里放 LCP 元素**。见下面"什么时候不该用 Suspense"。

用 React DevTools 可以在开发时手动切换 Suspense 边界，检查各个 fallback 的实际效果。

## 与 `error.tsx` 的边界嵌套关系

这两类边界解决不同的问题，在组件层级里是**层层相套**的：

| 边界 | 兜住什么 | 包裹范围 |
|---|---|---|
| `error.js` | 渲染期抛出的未捕获异常 | 包住同段的 `loading.js`、`not-found.js`、`page.js`，以及嵌套的 `layout.js` |
| `loading.js` | 异步工作完成前的等待 | 包住同段的 `not-found.js`、`page.js`，以及嵌套的 `layout.js` |

两个关键点：

- **`error.js` 不包同段的 `layout.js` 和 `template.js`**（它包的是**下面**层级的布局）。要处理根布局的错误，用 `global-error.js`。
- **`loading.js` 也不包同段的 `layout.js`、`template.js`、`error.js`**。

后者带来一个高频坑：**布局里读未缓存/运行期数据时，同段的 `loading.js` 不会为它显示 fallback**。因为 `loading.js` 在 `layout.js` 里面，包不到它。没有 Cache Components 时，导航会一直阻塞到布局渲染完；有 Cache Components 时，框架会给你一个构建期错误，引导你把这段访问包进它自己的 `<Suspense>`，或者把取数从 `layout.js` 挪进 `page.js`。

### 流式过程中的错误恢复

流已经开始之后组件抛错，最近的 `error.js` 边界会接住它，用错误 UI 替换掉那个失败的组件，**页面其余部分保持完好**——只有出错的那一段被换掉。

但 HTTP 状态码改不了了。首块发出时 `200 OK` 已经定型，后面的错误只能在流式 HTML 内部处理。这是下一节那些"什么时候不该用 Suspense"建议的根源。

## 什么时候不该用 Suspense

`<Suspense>` 不是免费的。每个边界都是潜在的阻塞点，而且它在 HTTP 层有不可逆的后果。

**内容太短，不值得**。如果异步工作 20ms 就完成了，加边界只会让 React 多走一遍替换流程，用户看到一次无意义的闪烁。判断标准：这段等待**是否长到值得显示 fallback**。

**会闪烁**。fallback 一闪而过比不显示更糟。这类情况下宁可让内容晚一点整体出现，也别让骨架屏闪一下。骨架和内容尺寸差得远时，闪烁之外还会叠加布局跳动。

**SEO 敏感的内容要放在边界外**。这是最重要的一条。流开始后：

- `notFound()` 无法再返回 404 状态码，Next.js 改为往流式 HTML 里注入 `<meta name="robots" content="noindex">`，防止搜索引擎索引。
- `redirect()` 无法再返回 HTTP 重定向头，退化成客户端跳转。
- 想要真正的 404 状态码，`notFound()` 必须放在**任何 await 和任何 Suspense 边界之前**。

```tsx
// app/post/[slug]/page.tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { PostContent } from './post-content'

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const exists = await checkSlugExists(slug) // 快速存在性检查
  if (!exists) notFound() // 真正的 404，在任何 Suspense 边界之前

  return (
    <Suspense fallback={<p>Loading post...</p>}>
      <PostContent slug={slug} />
    </Suspense>
  )
}
```

**LCP 元素不该在边界里**。hero 图、主标题、商品主图如果在 Suspense 边界内部，就得等边界内容替换完才能绘制，直接拖慢 LCP。而且揭示本身在客户端也有成本——React 会随边界 HTML 流一个小内联脚本，内容要等这个脚本执行才出现。

所以：

- LCP 元素放在边界**外面或上面**，让它成为静态外壳的一部分。
- 图片用 `next/image` 的 `preload` prop，往 `<head>` 注入 `<link rel="preload">`，让浏览器从第一块就开始抓图。注意它控制的是**何时抓取**，不是何时绘制——图片在边界里仍然要等替换。
- 文字类的 LCP 元素直接放在边界外渲染。

**需要真实状态码的合规/分析场景**。如果业务要求 404 必须是 404（合规、监控、分析），就不能让检查发生在流开始之后。可以把检查放到 `proxy` 里——它在页面渲染之前运行，HTTP 状态码还可控。或者按上面的写法把检查提到所有边界之前。

## 常见坑

- **现象**：布局里读 `cookies()`，同目录的 `loading.tsx` 不生效，导航卡住直到布局渲染完。
  **原因**：`loading.js` 嵌在 `layout.js` **内部**，包不到同段的布局。层级决定了它无法为布局的异步工作提供 fallback。
  **解法**：给布局里那段运行期访问单独包一个 `<Suspense>` 并提供 fallback；或者把取数从 `layout.js` 挪进 `page.js`，让 `loading.js` 能覆盖到。开启 Cache Components 后框架会直接给你构建期错误提示。

- **现象**：某个不存在的详情页返回 200，只在页面内容里显示 404，搜索引擎抓走了。
  **原因**：`notFound()` 在流开始之后才触发。此时 `200 OK` 已经发出，状态码改不了，Next.js 只能注入 `noindex` 缓解。
  **解法**：把存在性检查提到所有 `await` 和 Suspense 边界之前。需要绝对可靠的话，把检查放进 `proxy`。

- **现象**：加了 `<Suspense>` 之后页面变慢，或者 hero 图的 LCP 指标反而变差。
  **原因**：边界是潜在的阻塞点。React 在慢网络或繁忙 CPU 下可能真的回退到 fallback；LCP 元素在边界里则要等替换完成才能绘制，还要等那个内联脚本执行。
  **解法**：把 LCP 元素移到边界外或边界上方。只在确实有异步工作时加边界。给 LCP 图片加 `preload`。

- **现象**：骨架屏一闪而过，观感比不加还差。
  **原因**：异步工作完成得太快，fallback 只显示了很短一瞬。
  **解法**：这段内容不需要边界，去掉它。或者把 fallback 换成更轻的东西（比如什么都不显示、只留预留空间），避免视觉闪烁。

- **现象**：本地开发时流式效果正常，部署到自托管环境后所有分块一次性到达。
  **原因**：任何位于服务器和客户端之间、会缓冲响应的层都会抹掉流式的收益——Nginx 等反向代理默认就缓冲，某些 CDN 也会缓冲整个响应，Gzip/Brotli 压缩需要攒够数据才 flush，AWS Lambda 需要显式开启 response streaming 模式。
  **解法**：Nginx 加 `X-Accel-Buffering: no` 响应头；确认 CDN 的流式支持；检查压缩层是否及时 flush；确认 serverless 平台开启了流式。另外 Safari/WebKit 会缓冲到收到 1024 字节，所以极小的演示页面看不出效果，真实应用不受影响。

- **现象**：用 `curl` 测试流式，看起来完全没流。
  **原因**：`curl` 默认缓冲输出。加 `-N` 可以关掉，但它仍然依赖换行符来 flush 行——不含换行的分块看起来还是卡住。
  **解法**：用上面那个 Node 脚本读 `res.body` 的 reader，并带 `Accept-Encoding: identity` 关掉压缩。或者在 Chrome DevTools 里看文档请求的 Timing 分解：TTFB 早、Content Download 阶段很长，就说明在流式传输。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 页面级加载态 | `loading.tsx` | `loading.tsx`（不变），但 Cache Components 下布局里的运行期访问会报错，必须显式包 `<Suspense>` |
| 组件级加载态 | `<Suspense>` | 不变，但推荐放到**靠近运行期访问**的位置，而不是树的高处 |
| 动态访问 | 顶层 `await cookies()` 即可 | 把 promise 往下传，在边界内部 await，否则外壳无法预渲染 |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 3 条（缓存模型变化直接影响哪些内容能进静态外壳）。

## API / 配置速查

| 项 | 说明 |
|---|---|
| `loading.tsx` | 页面级 Suspense 包裹，fallback 会被预取 |
| `<Suspense fallback>` | 组件级边界，每个边界独立流式解析 |
| `error.tsx` | 包住同段 `loading` / `not-found` / `page` / 嵌套 `layout`；不包同段 `layout`、`template` |
| `global-error.tsx` | 处理根布局错误，必须自带 `<html>` 和 `<body>` |
| `next/image` 的 `preload` | 往 `<head>` 注入 `<link rel="preload">`，控制抓取时机而非绘制时机 |

| 流开始后失效的能力 | 替代行为 |
|---|---|
| 404 状态码 | 注入 `<meta name="robots" content="noindex">` |
| HTTP 重定向头 | 退化为客户端跳转 |

| 流式受影响的环节 | 处理方式 |
|---|---|
| Nginx 反向代理 | `X-Accel-Buffering: no` |
| CDN | 确认供应商的流式支持 |
| 压缩层 | 确认及时 flush |
| Serverless（如 Lambda） | 显式开启 response streaming |
| Safari / WebKit | 缓冲到 1024 字节，真实应用无影响 |

## 延伸阅读

- [官方文档：Streaming](https://nextjs.org/docs/app/guides/streaming)
- [官方文档：`loading.js`](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
- [官方文档：Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data)
- [官方文档：`error.js`](https://nextjs.org/docs/app/api-reference/file-conventions/error)
- [React 文档：`<Suspense>`](https://react.dev/reference/react/Suspense)
- [RSC Explorer](https://rscexplorer.dev/) —— 交互式查看组件 payload 格式与分块还原过程
