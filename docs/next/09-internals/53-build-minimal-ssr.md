# 53 · 从零实现最小 SSR

> **一句话结论**：服务端渲染（Server-Side Rendering, SSR）不是什么框架魔法，它只需要三样东西——`renderToString` 把组件树变成 HTML 字符串、一个 HTML 模板把字符串和客户端脚本拼起来、`hydrateRoot` 在浏览器里接管已经存在的 DOM。整个过程不到 60 行代码，理解了它，Next.js 的渲染管线就只剩下"工程化"的部分。

## 先看问题，不看定义

一个 Dashboard 页面要展示"当前用户最近的 5 个订单"。如果全部在客户端渲染（Client-Side Rendering, CSR），用户打开页面会经历这么一段：

```
浏览器请求 HTML
  → 服务器返回一个空壳：<div id="root"></div>
  → 浏览器下载 JS（假设 300KB gzip）
  → 浏览器解析并执行 JS
  → React 渲染出"加载中"骨架
  → useEffect 触发 fetch('/api/orders')
  → 等一个网络往返
  → 渲染出订单列表
```

用户在**第二个网络往返结束前**看不到任何真实内容。这段时间里页面是白的，或者只有一个转圈的图标。三个具体后果：

1. **首屏时间被拉长**。关键渲染路径变成了 `HTML → JS → fetch → 渲染`，串行四步。
2. **搜索引擎和社交爬虫拿到的是空 HTML**。它们大多不执行 JS，抓到的 `<div id="root"></div>` 里什么都没有，页面等于不存在。
3. **每个页面都要写一套"加载中"状态**。数据获取逻辑和 UI 逻辑耦合在组件里。

SSR 把第一步和第三步对调：**服务器先把数据取好、把组件渲染成 HTML，再把完整 HTML 发给浏览器**。浏览器收到的第一个字节里就有订单列表。

```
浏览器请求 HTML
  → 服务器取数据 → renderToString → 返回完整 HTML
  → 用户立刻看到内容（虽然还不能点）
  → 浏览器下载 JS → hydrateRoot 接管 → 可交互
```

## 最小可运行示例

四个文件：一个组件、两个入口、一个模板。全部是 TypeScript。

```tsx
// src/App.tsx
import { useState } from 'react'

export type Post = { id: string; title: string }

export default function App({ posts }: { posts: Post[] }) {
  const [likes, setLikes] = useState(0)

  return (
    <main>
      <h1>文章列表</h1>
      <button onClick={() => setLikes(likes + 1)}>点赞（{likes}）</button>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </main>
  )
}
```

服务端入口只做一件事：把 props 渲染成字符串。

```tsx
// src/entry-server.tsx
import { renderToString } from 'react-dom/server'
import App, { type Post } from './App'

export function render(posts: Post[]): string {
  return renderToString(<App posts={posts} />)
}
```

客户端入口也只做一件事：把这份 HTML 接管过来。

```tsx
// src/entry-client.tsx
import { hydrateRoot } from 'react-dom/client'
import App, { type Post } from './App'

declare global {
  interface Window {
    __POSTS__: Post[]
  }
}

const container = document.getElementById('root')
if (!container) throw new Error('找不到 #root 容器')

hydrateRoot(container, <App posts={window.__POSTS__} />)
```

HTML 模板留两个占位：一个放渲染结果，一个放数据。

```html
<!-- index.html -->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>手写 SSR</title>
  </head>
  <body>
    <div id="root"><!--app-html--></div>
    <!--app-data-->
    <script type="module" src="/src/entry-client.tsx"></script>
  </body>
</html>
```

服务器把三者拼起来：

```ts
// server.ts
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { render } from './src/entry-server'
import type { Post } from './src/App'

const posts: Post[] = [
  { id: '1', title: '手写 SSR' },
  { id: '2', title: 'hydration 到底在做什么' },
]

const template = readFileSync(new URL('./index.html', import.meta.url), 'utf-8')

// 把 < 转义成 \u003c，避免数据里的 "</script>" 提前闭合内联脚本
function serializeForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

createServer((req, res) => {
  const appHtml = render(posts)
  const dataScript = `<script>window.__POSTS__ = ${serializeForScript(posts)}</script>`

  const html = template
    // 用函数形式的 replace，避免替换串里的 $ 被当成特殊模式
    .replace('<!--app-html-->', () => appHtml)
    .replace('<!--app-data-->', () => dataScript)

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}).listen(3000, () => {
  console.log('http://localhost:3000')
})
```

用 Vite 起前端资源、用 `tsx` 起这个服务器：

```bash
# package.json 的 scripts（节选）
pnpm add react react-dom
pnpm add -D vite @vitejs/plugin-react tsx typescript
pnpm vite dev          # 提供 /src/entry-client.tsx 的转译产物
pnpm tsx server.ts     # 启动 SSR 服务
```

打开 `http://localhost:3000`：**查看网页源代码**，订单列表已经在 HTML 里了——不是执行 JS 之后才出现的。这就是 SSR 的全部效果。

## 内部机制

### wire 层看到的东西

先看这个服务器实际发出去的响应，比任何描述都直接：

```text
# curl -i http://localhost:3000 的真实响应（节选）
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Date: Sat, 12 Sep 2026 06:00:00 GMT
Connection: keep-alive
Transfer-Encoding: chunked

<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>手写 SSR</title>
  </head>
  <body>
    <div id="root"><main><h1>文章列表</h1><button>点赞（<!-- -->0<!-- -->）</button>
    <ul><li>手写 SSR</li><li>hydration 到底在做什么</li></ul></main></div>
    <script>window.__POSTS__ = [{"id":"1","title":"手写 SSR"},{"id":"2","title":"hydration 到底在做什么"}]</script>
    <script type="module" src="/src/entry-client.tsx"></script>
  </body>
</html>
```

三个细节值得注意。

**`Transfer-Encoding: chunked` 出现了，但这里并不是流式。** Node.js 的 `http` 模块在不知道 `Content-Length` 时会用分块编码，`res.end(html)` 一次性写完只是"一个分块"。分块传输编码（chunked transfer encoding）是流式的**前提**，不是流式本身——要真的边渲染边发，得用 `renderToPipeableStream`，见 [56](./56-build-streaming-ssr.md)。

**HTML 里混进了 `<!-- -->`。** 这些注释节点是 React 的文本边界标记，见下一节。

**数据脚本排在应用脚本前面。** 顺序不能反。`entry-client.tsx` 是 `type="module"`，模块脚本默认延迟执行（相当于 `defer`），理论上不会抢跑；但如果换成普通 `<script>`，它会在解析到标签时立刻执行，那时 `window.__POSTS__` 还不存在，hydration 就会用 `undefined` 渲染——一个典型的 mismatch。**把数据脚本放在应用脚本之前**是这类手写 SSR 必须守的规则。

### `renderToString` 到底产出了什么

```ts
// node_modules/react-dom/server 的类型签名（节选）
renderToString(reactNode: ReactNode, options?: { identifierPrefix?: string }): string
```

它的输入是 React 元素树，输出是一段 HTML 字符串。注意输出的**只有字符串**——没有组件类型信息、没有 props、没有事件处理器、没有 state。`<button onClick={...}>` 渲染出来的 HTML 里，`onClick` 完全消失了：

```html
<!-- renderToString 的实际输出（格式化后） -->
<main>
  <h1>文章列表</h1>
  <button>点赞（<!-- -->0<!-- -->）</button>
  <ul>
    <li>手写 SSR</li>
    <li>hydration 到底在做什么</li>
  </ul>
</main>
```

`<!-- -->` 是 React 插入的文本边界注释。因为服务端渲染是"一次成型"的字符串拼接，它需要这些标记来记住"这里有两个相邻的文本节点"，否则 `{"点赞（"}{likes}{"）"}` 三段文本在 HTML 里会粘成一个文本节点，客户端再渲染时就对不上了。

**关键结论**：服务端产出的是一张"照片"，不是"活体"。它长得对，但不会动。

### hydration 是把照片变成活体

`hydrateRoot` 做的事情和 `createRoot` 长得很像，但语义完全不同：

| | `createRoot` | `hydrateRoot` |
|---|---|---|
| 前提 | 容器是空的 | 容器里已经有服务端渲染的 HTML |
| DOM 操作 | **创建**所有节点 | **复用**已有节点，不重建 |
| 内容不一致时 | 不存在这个问题 | 报 hydration mismatch，回退成客户端渲染 |

`hydrateRoot` 的工作流程是：

1. 在浏览器里把 `<App posts={window.__POSTS__} />` **再渲染一遍**，得到一棵虚拟 DOM 树。
2. 沿着真实的 DOM 树和这棵虚拟树**同步往下走**，逐个节点比对：类型对不对、属性对不对、文本对不对。
3. 比对通过就"认领"这个 DOM 节点（不做任何 DOM 操作），并把事件监听器、state、ref 挂上去。
4. 比对失败就报错，并在最坏情况下丢弃服务端 HTML、整棵重新渲染。

所以 hydration 的本质是**用一次完整的客户端渲染换取 DOM 复用**。它省下的不是 CPU，而是"重建 DOM 导致的闪烁和布局抖动"——用户不会看到内容被替换的过程。

这也解释了一个反直觉的现象：**hydration 之前页面是可见但不可交互的**。HTML 已经在那儿了，所以用户能看、能滚动、能选中文字；但 `onClick` 还没挂上去，所以点按钮没反应。这就是所谓"uncanny valley"（恐怖谷）——看起来能用，实际不能用。这是 SSR 固有的代价，不是 bug。

### 为什么数据要内联到 HTML 里

看上面那个客户端入口：`<App posts={window.__POSTS__} />`。这份 `posts` 数据是从 HTML 里的内联脚本读出来的，**不是重新请求的**。

原因是 hydration 要求两边渲染结果一致。如果服务端用真实数据渲染了 5 条订单，而客户端在 hydration 时手上没有数据、只能渲染 0 条，两边就对不上，React 会报错并丢掉服务端 HTML。

所以 SSR 必须有一步**数据脱水（dehydrate）**：服务端把取好的数据序列化进 HTML；客户端在 hydration 前把它读出来**注水（hydrate）**回去。整个链条是：

```
服务端：取数据 → renderToString(data) → 把 data 序列化进 <script>
客户端：读 <script> 里的 data → hydrateRoot(<App posts={data} />)
```

Next.js 里这一步就是 RSC Payload 和 `self.__next_f.push(...)` 那串内联脚本——只不过它序列化的不只是数据，还有整棵服务端组件树。见 [55 RSC 实现原理与 Flight 协议](./55-rsc-and-flight.md)。

### 为什么纯 SSR 不需要额外的 payload

一个容易困惑的点：既然 Next.js 要传 RSC Payload，为什么手写 SSR 只传了数据就够了？

因为**纯 SSR 里客户端有完整的组件代码**。`entry-client.tsx` 里 `import App from './App'`——`App` 的实现被一起打包发给了浏览器。客户端能自己把组件树渲染一遍，只需要数据就能对齐。

而 RSC 的前提是**客户端根本没有服务端组件的代码**（不打包、不发送）。既然客户端渲染不出这棵树，服务端就必须把这棵树的"渲染结果 + 客户端组件的引用"序列化过去。这就是 payload 存在的原因，也是 Flight 协议要解决的问题。

### `renderToString` 的三个硬限制

这不是"实现得不够好"，是它的设计边界：

| 限制 | 后果 |
|---|---|
| **不支持流式** | 必须等整棵树渲染完才能返回第一个字节。任何一个慢查询都拖住整个响应 |
| **不等待数据** | 它同步返回字符串。React 19 起服务端组件可以是 `async` 的，`renderToString` 渲染不了 |
| **Suspense 支持有限** | 组件挂起时，`renderToString` **立刻输出它的 fallback**，然后在客户端补上。官方文档的原文是 "If a component suspends, `renderToString` immediately sends its fallback as HTML" |

第三点在 React 官方文档里被明确列为 Pitfall：

> `renderToString` does not support streaming or waiting for data. See the alternatives.

官方给的替代方案是：

| 场景 | Node.js | Web Streams 运行时（Deno / 边缘） |
|---|---|---|
| 请求期流式渲染 | `renderToPipeableStream` | `renderToReadableStream` |
| 构建期静态预渲染 | `prerenderToNodeStream` | `prerender` |

这四个 API 的分工见 [54 从零实现 SSG 与 ISR](./54-build-ssg-and-isr.md) 和 [56 从零实现 Streaming SSR](./56-build-streaming-ssr.md)。

### hydration 的真实成本

把 hydration 拆开看，它到底花了什么：

| 环节 | 成本 |
|---|---|
| 下载组件代码 | 整棵树的 JS 都要发到浏览器，**包括只在服务端需要的那部分** |
| 解析 + 编译 JS | 300KB gzip 的 React 应用通常要几十到上百毫秒 |
| 再渲染一遍整棵树 | 和客户端渲染的渲染成本一样，CPU 全额付出 |
| 遍历 DOM 做比对 | 每个节点一次类型/属性检查 |
| 挂载事件与状态 | 创建 fiber、绑定监听器、分配内存 |

注意第三行：**hydration 需要客户端把整棵组件树重新渲染一遍**。这意味着服务端渲染省下的渲染 CPU，客户端要再付一次。SSR 真正赚到的是**首屏可见时间**，不是总计算量。

这个"重复渲染"是所有 SSR 框架的结构性成本，也是 React Server Components 要解决的问题：**如果客户端根本没有服务端组件的代码，它就不需要再渲染那一部分**。RSC 把这个成本从"整棵树"砍到"只有客户端组件那一小片"——这是 [55](./55-rsc-and-flight.md) 的核心动机。

hydrate 的另一个成本是时机。在 hydration 完成之前：

- `onClick` 之类的处理器不存在，点击没反应。
- `useState` 的初始值已定，但 `setState` 不会触发更新。
- 浏览器原生的行为**照常工作**：`<details>` 能展开、`<a>` 能跳转、`<form>` 能提交、CSS `:hover` 有效。

最后一条是重要线索。Next.js 文档里反复强调"原生行为不需要客户端组件"（见 [07 Server / Client Components](../02-rendering/07-server-client-components.md)），根源就在这里：这些能力由浏览器实现，不依赖 hydration。

## 手写实现 ↔ Next.js 对应机制

手写的每一步在 Next.js 里都有对应物，只是被自动化了：

| 手写实现 | Next.js 16 里的对应物 |
|---|---|
| `renderToString(<App />)` | App Router 内部的 `react-server-dom-webpack` + `renderToPipeableStream`（见 [56](./56-build-streaming-ssr.md)） |
| `index.html` 模板 | `app/layout.tsx`（根布局，必须含 `<html>` 和 `<body>`） |
| 手动 `readFileSync` 模板 | 路由段的 `layout.tsx` / `page.tsx` 自动组装 |
| `<script>window.__POSTS__ = ...</script>` | RSC Payload 内联脚本 + `self.__next_f.push(...)` |
| `createServer` 手写路由分发 | `proxy.ts` → 路由匹配 → 渲染管线（见 [60 请求生命周期总览](./60-request-lifecycle.md)） |
| `hydrateRoot(container, <App />)` | `app-bootstrap.ts` 里框架自己的 `hydrateRoot` 调用 |
| 手动调 `fetch` 取数据 | 服务端组件里直接 `await`，配合 `'use cache'` / `cacheLife` |
| 自己保证两边数据一致 | 框架保证：HTML 和 RSC Payload 是同一次渲染的两个产物 |
| 没有的东西 | 路由、代码分割、预取、缓存、失效、流式、PPR |

最后一行是这个练习的意义所在：**SSR 本身很小，Next.js 的价值在于把 SSR 放进一整套缓存与路由体系里**。

### SSR 换来了什么，又付出了什么

一次交换，不是白拿：

| 指标 | CSR | SSR（`renderToString`） |
|---|---|---|
| TTFB | 快（静态壳立刻返回） | **慢**（要等数据取完 + 整棵树渲染完） |
| 首屏内容可见（FCP / LCP） | 慢 | **快** |
| 可交互时间（TTI） | 接近首屏 | 等于首屏 + hydration 时间 |
| 服务器成本 | 几乎为零（静态托管） | 每请求一次渲染，CPU 随流量线性增长 |
| 爬虫可见内容 | 不可见 | 可见 |

第二行和第一行是同一个东西的两面：SSR 把"等数据"从浏览器搬到了服务器，所以浏览器的首屏变快了，但服务器返回第一个字节变慢了。

这个取舍在 Next.js 里被进一步细化了：**不必整页二选一**。静态部分构建期就渲染好（TTFB 接近 CDN）、缓存部分按 `cacheLife` 定期重建、只有真正每请求不同的部分才走请求期渲染，而且它可以流式补上，不阻塞前面的内容。这就是 Cache Components 的模型，见 [08 渲染策略总览](../02-rendering/08-rendering-strategies.md) 和 [11 缓存模型 Cache Components](../02-rendering/11-cache-components.md)。

## 常见坑

- **现象**：hydration 时报错，控制台说服务端和客户端渲染结果不一致。
  **原因**：两边渲染用了不同的输入。常见来源有三种——服务端用了 `Date.now()` / `Math.random()`（两边值不同）、客户端 hydration 时读不到服务端的数据（脱水/注水漏了）、代码里读了 `typeof window !== 'undefined'` 之类的环境判断并渲染出不同分支。
  **解法**：让**首次渲染**在两边完全确定。时间戳、随机值、`localStorage` 里的值都不能在首次渲染时直接进 JSX——要放进 `useEffect` 里 setState，或者由服务端把值算好脱水下来。React 19 在开发模式下会打印一份 server/client 的**差异对照（diff）**，直接照着改。

- **现象**：数据里的 `</script>` 把内联脚本提前闭合了，页面结构全乱，或者 JSON 解析失败。
  **原因**：HTML 解析器不认识 JS 字符串。它在 `</script>` 处就结束脚本，哪怕这个序列出现在 JSON 字符串里。同理，`<!--` 在部分浏览器里也会影响解析。
  **解法**：序列化进内联脚本前转义：`JSON.stringify(value).replace(/</g, '\\u003c')`。这是最小改动且不破坏 JSON 语义的做法。

- **现象**：用 `String.prototype.replace` 拼 HTML 时，输出里出现了奇怪的 `$&`、`$'` 或整段内容被重复。
  **原因**：`replace(search, replacement)` 在 replacement 是**字符串**时，`$$`、`$&`、`$\``、`$'`、`$n` 都是特殊模式。渲染出的 HTML 或 JSON 数据里恰好含 `$` 就会触发。
  **解法**：替换值用**函数**形式：`.replace('<!--app-html-->', () => appHtml)`。函数返回值不做模式展开。

- **现象**：页面能看见内容，但按钮点了没反应，控制台也没有报错。
  **原因**：客户端脚本没加载成功。可能是打包产物路径不对、`<script>` 的 `type="module"` 被服务端当成普通脚本、或者浏览器在 hydration 完成前就报了一个无关的错误并中断了模块执行。
  **解法**：先看 Network 面板里 entry chunk 是不是 200，再看 Console 有没有模块加载错误。这正是"uncanny valley"——HTML 在、交互不在，一定是脚本侧的问题。

- **现象**：在服务端代码里访问 `window` 或 `document`，服务端直接崩溃。
  **原因**：SSR 的执行环境是 Node.js，没有 DOM。`localStorage`、`window.matchMedia`、`document.cookie` 都不存在。
  **解法**：把这类访问放进 `useEffect`（只在客户端跑），或者用 `typeof window === 'undefined'` 做守卫。Next.js 里 `import 'client-only'` 能让这种误用变成构建期错误。

- **现象**：`useEffect` 在服务端渲染时没有执行，以为是自己写错了。
  **原因**：`useEffect` **本来就不在服务端运行**。它只在浏览器提交（commit）之后执行，这是设计而非缺陷。服务端只有 render 阶段。
  **解法**：需要在服务端做副作用（写日志、埋点）就用框架的 `after()`，或者直接放在渲染逻辑之外。`useLayoutEffect` 在 SSR 期间会给出警告，因为它在服务端无从执行。

- **现象**：服务端组件写成 `async function` 然后交给 `renderToString`，报错说渲染出了 Promise 而不是元素。
  **原因**：`renderToString` 是同步 API，等不了 Promise。React 19 允许 `async` 组件，但那是 RSC 渲染器（`react-server-dom-*`）的能力，不是 `renderToString` 的能力。
  **解法**：把数据在调用 `renderToString` **之前**取好，当 props 传进去——也就是上面示例的做法。要真正的"组件内 `await`"，得换渲染器，见 [55](./55-rsc-and-flight.md)。

- **现象**：每个请求都重新读一遍 HTML 模板文件，QPS 一高磁盘 IO 就上去了。
  **原因**：`readFileSync` 写在了请求处理函数里。
  **解法**：模板是构建期产物，在模块顶层读一次即可（上面的示例就是这么写的）。Next.js 里对应的产物是 `.next/server/app/**` 下预编译好的模块。

- **现象**：一个页面里挂两个 React 根，`useId` 生成的 id 撞车，`<label for>` 指向了错误的输入框。
  **原因**：`useId` 的默认前缀在两个根之间是一样的，两个根各自从 1 开始计数。
  **解法**：给每个根一个不同的 `identifierPrefix`，**服务端 `renderToString` 和客户端 `hydrateRoot` 传同一个值**。这个参数是成对的，只改一边会立刻造成 mismatch。

- **现象**：服务端把含 `Date` 的对象内联进 HTML，客户端 hydration 后 `post.createdAt instanceof Date` 是 `false`。
  **原因**：`JSON.stringify` 会把 `Date` 变成 ISO 字符串。客户端读到的是字符串，服务端渲染时用的是 `Date` 对象，两边渲染结果可能不同（比如格式化后的文案不一样）。
  **解法**：明确约定脱水格式——要么两边都用字符串，要么在客户端注水时显式还原：`new Date(raw.createdAt)`。React 自己的序列化器（RSC 用的那个）能识别 `Date` 并保留类型，手写 JSON 不能。

- **现象**：`<div id="root"><!--app-html--></div>` 改成多行缩进后，hydration 开始报错。
  **原因**：HTML 里的换行和缩进会变成真实的文本节点。如果服务端渲染结果的两侧有空白文本节点，而客户端 `hydrateRoot` 渲染的元素树里没有，两边结构就对不上。
  **解法**：容器标签和占位注释之间不要留空白：`<div id="root"><!--app-html--></div>`。React 自己的渲染输出会显式插入 `<!-- -->` 来固定文本边界，手写模板时这条规则要自己守。

## API / 配置速查

| API | 签名 | 环境 | 说明 |
|---|---|---|---|
| `renderToString` | `(reactNode, options?) => string` | Node / 浏览器 | 同步返回 HTML 字符串；**不支持流式、不等待数据**；Suspense 挂起时立刻输出 fallback |
| `renderToPipeableStream` | `(reactNode, options?) => { pipe, abort }` | 仅 Node.js | 流式渲染，见 [56](./56-build-streaming-ssr.md) |
| `renderToReadableStream` | `(reactNode, options?) => Promise<ReadableStream>` | Web Streams（Deno / 边缘） | 流式渲染的 Web Streams 版本 |
| `prerenderToNodeStream` | `(reactNode, options?) => Promise<{ prelude, postponed }>` | 仅 Node.js | 静态预渲染，会等所有数据，见 [54](./54-build-ssg-and-isr.md) |
| `prerender` | 同上，返回 Web Streams | Web Streams | 静态预渲染的 Web Streams 版本 |
| `hydrateRoot` | `(domNode, reactNode, options?) => { render, unmount }` | 仅浏览器 | 接管已有 HTML |
| `createRoot` | `(domNode, options?) => { render, unmount }` | 仅浏览器 | 创建新根，容器必须为空 |

`renderToString` 的 `options` 只有一个字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `identifierPrefix` | `string` | `useId` 生成的 ID 前缀。同页多个根时必须用，且**客户端 `hydrateRoot` 要传同一个值** |

`hydrateRoot` 的 `options`：

| 字段 | 类型 | 说明 |
|---|---|---|
| `onCaughtError` | `(error, errorInfo) => void` | 被错误边界捕获时调用 |
| `onUncaughtError` | `(error, errorInfo) => void` | 抛出且无人捕获时调用 |
| `onRecoverableError` | `(error, errorInfo) => void` | React 自动恢复时调用，含 hydration mismatch |
| `identifierPrefix` | `string` | 必须与服务端一致 |
| `formState` | — | 服务端表单提交产生的表单状态，配合 `useActionState` 的 `permalink` 使用，通常由框架透传 |

## 延伸阅读

- [React 文档：`renderToString`](https://react.dev/reference/react-dom/server/renderToString) —— 官方明确列出的局限与替代方案
- [React 文档：`hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot)
- [React 文档：`renderToPipeableStream`](https://react.dev/reference/react-dom/server/renderToPipeableStream)
- [React 文档：Server Components](https://react.dev/reference/rsc/server-components)
- [官方文档：Rendering Philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy) —— 为什么 Next.js 把静态/动态边界放在组件级
- [官方文档：Streaming](https://nextjs.org/docs/app/guides/streaming)
- [MDN：`Transfer-Encoding`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Transfer-Encoding)
- B站《Next简明教程》2026 夏「传统 SSR - 01」（BV1Xc7Q6LE7N）：<https://www.bilibili.com/video/BV1Xc7Q6LE7N> —— 本章讲解路径参考了这一集，它从"CSR 白屏"切入，再引出 hydration
