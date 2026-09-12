# 56 · 从零实现 Streaming SSR

> **一句话结论**：Streaming SSR 的全部秘密在于——HTML 不是一次性吐完的，而是边算边发。`<Suspense>` 在服务端就是"流式分块边界"：被它包住的子树还没准备好时，服务器先吐一个占位（fallback），等数据回来再吐一段内联 `<script>` 把真实内容塞进 DOM。整个过程对最终 HTML 的结构是透明的，浏览器拿到的依然是一份完整文档。

## 为什么要流式

非流式 SSR 的请求处理大概长这样：

```
请求进来
  → 服务器取所有数据（可能要 800ms，因为要等最慢的那个）
  → renderToString 整棵树（必须等数据全到才能跑）
  → 一次性返回完整 HTML
```

问题：**用户在 800ms 内什么都看不到**。首屏时间被"最慢的数据"拖累。这叫 waterfall——快的部分等慢的部分。

流式改的恰恰是这一句"必须等数据全到才能跑"。被 `<Suspense>` 包住的子树，服务器会先吐它 的 fallback（"加载中…"），把已经算好的部分先发出去，等慢数据回来再补一个 `<template>` + `<script>` 把真实内容换进去。浏览器在**第一个 chunk 到达时**就开始渲染。

## 最小可运行示例

```tsx
// app/dashboard/page.tsx —— 服务端组件
import { Suspense } from 'react'
import { Orders } from './orders'
import { Summary } from './summary'

export default function Page() {
  return (
    <div>
      {/* 立即可渲染的部分 */}
      <Summary />

      {/* 慢的部分用 Suspense 包起来 */}
      <Suspense fallback={<div>订单加载中…</div>}>
        <Orders />
      </Suspense>
    </div>
  )
}
```

```tsx
// app/dashboard/orders.tsx —— 服务端组件，慢数据源
import { db } from '@/lib/db'

export default async function Orders() {
  const orders = await db.order.findMany({ take: 5 }) // 假设 800ms
  return (
    <ul>
      {orders.map((o) => (
        <li key={o.id}>{o.name}</li>
      ))}
    </ul>
  )
}
```

这本身就是完整可用的 Next.js 流式渲染。`loading.tsx` 文件的本质就是给整页 `page.tsx` 套一个 `<Suspense>`——所以 `loading.tsx` 和手写 `<Suspense>` 是同一套机制。

## 协议层发生了什么

服务器吐出的流分多段。第一段是已经算好的 HTML + 占位：

```html
<div>
  <h1>本月概览</h1>
  <div>订单加载中…</div>
</div>
```

`Orders` 算完时，服务器接着吐一段补充。React 用 `<template>` + 内联 `<script>` 的方式把内容插回原位：

```html
<div hidden id="B:1">
  <ul><li>订单 A</li><li>订单 B</li></ul>
</div>
<script>
  $RC("B:1", "S:1")   // 把上面那个 hidden 块替换到占位的位置
</script>
```

要点：

- **占位位置在 HTML 里是固定的**。替换靠 id 匹配（`S:1` 是占位的锚点，`B:1` 是真实内容的容器），不依赖 DOM 重排。
- **替换用内联 `<script>`，不是 React 运行时**。浏览器在解析到这段 script 时就立刻执行替换，不用等 JS bundle 解析完。这就是为什么流式首屏可以很快——真实内容出现在 hydrate 之前。
- **慢请求把链路拉长，但不阻塞首屏**。第一个 chunk 立刻可见，慢内容后补。

## 手写：脱离 Next.js 看机制

```ts
// server/stream.ts —— Node http 服务
import { renderToPipeableStream } from 'react-dom/server'
import http from 'http'

http.createServer((req, res) => {
  const { pipe } = renderToPipeableStream(<App />, {
    bootstrapModules: ['/client.js'],   // hydrate 脚本，最后才发
    onShellReady() {
      res.setHeader('content-type', 'text/html')
      pipe(res)                          // shell 一好就开流
    },
    onError(err) {
      console.error(err)
      res.statusCode = 500
    },
  })
}).listen(3000)
```

关键在 `onShellReady`：它表示"外壳已经算完、可以开始发了"。在这之前不流式——因为外壳还没成，浏览器不知道往哪儿塞。这正是 Next.js `loading.tsx` / `error.tsx` 存在的根因：**外壳（layout）必须同步且稳定**，它是后续流式替换的锚点。

## 嵌套 Suspense

```tsx
<Suspense fallback={<div>外层占位</div>}>
  <SlowA />
  <Suspense fallback={<div>内层占位</div>}>
    <SlowB />
  </Suspense>
</Suspense>
```

每层 Suspense 都是独立的流式分块边界。`SlowA` 和 `SlowB` 谁先回来谁先补，互不等待。Next.js 会为每层生成独立的 `B:` / `S:` id 对。

## 什么时候不该用 Suspense

- **内容极短**：一个标题加一行字，用流式反而因为 chunk 拆分增加开销。
- **内容会闪烁**：fallback 一闪而过比一直转圈更难看。如果数据通常 50ms 内回，不如直接同步渲染。
- **SEO 敏感且内容在 fallback 里**：爬虫不执行内联替换 script 的行为可能因实现而异。重要 SEO 内容应直接同步渲染，不要靠 Suspense 后补。
- **替代内容会被布局**：真实内容比 fallback 高很多时，回流会让用户难受。给 fallback 一个预留高度的骨架。

## 常见坑

- **现象**：流式开了，首屏还是慢。
  **原因**：外壳（layout）里有慢的同步请求。外壳不算完，流根本不开。
  **解法**：把慢请求移到 `<Suspense>` 包裹的子树里，外壳保持纯同步且极快。

- **现象**：页面看起来"跳"——内容陆续出现，布局在动。
  **原因**：fallback 没给真实内容预留尺寸。
  **解法**：给 fallback 一个等高的骨架（`<div style={{minHeight: 200}} />`），占住空间。

- **现象**：流式内容在 hydrate 后才出现。
  **原因**：忘了 `renderToPipeableStream`（流式）而用了 `renderToString`（同步，不分块）。
  **解法**：手写服务时用 `renderToPipeableStream`；用 Next.js 时它自动处理。

- **现象**：报错 `Suspense boundary ... did not complete`。
  **原因**：被 Suspense 包的子树抛了错，且该层没有 `error.tsx` 兜住。
  **解法**：在合适的层级放 `error.tsx`（或用嵌套 `<Suspense>` + 错误捕获组件）。见 [第 14 章](../02-rendering/14-error-handling.md)。

## 旧写法 vs 新写法

| 场景 | 旧（无流式 SSR） | 新（Streaming SSR） |
|---|---|---|
| 首屏 | 等最慢的数据 | 何时算好何时发 |
| 慢数据 | 阻塞整页 | 只阻塞自己的 chunk |
| 实现复杂度 | `renderToString` 简单 | `renderToPipeableStream` + 边界约定 |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md)。

## API / 配置速查

| API | 来源 | 作用 |
|---|---|---|
| `renderToPipeableStream` | `react-dom/server` | 把树序列化成可流式 HTML |
| `<Suspense>` | `react` | 声明流式分块边界 |
| `loading.tsx` | 文件约定 | 给 page 套 Suspense 的语法糖 |
| `error.tsx` | 文件约定 | 给 Suspense 子树兜错 |

## 延伸阅读

- [官方文档：Streaming](https://nextjs.org/docs/app/guides/streaming)
- [官方文档：Loading UI](https://nextjs.org/docs/app/getting-started/error-handling)
- [B站《Next简明教程》Streaming - 1-3](https://www.bilibili.com/video/BV1CXE963EqU/)
