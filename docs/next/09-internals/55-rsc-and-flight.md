# 55 · RSC 实现原理与 Flight 协议

> **一句话结论**：React Server Component（RSC）的核心不是"组件在服务端跑"——那叫 SSR，早就有了。RSC 真正解决的问题是：让服务端组件和客户端组件**长在同一棵树里**，服务端那部分以一个可流式、可引用客户端组件的中间表示（Flight payload）传到浏览器，浏览器再把它和客户端组件拼回完整的 React 树。理解 Flight payload 长什么样，RSC 就不再是黑盒。

## 一个具体问题

假设有个页面：顶部是用户名（来自数据库），底部是一个用 `useState` 的计数器按钮。前者不需要客户端 JS，后者必须用客户端 JS。传统做法只能二选一——要么整页 SSR + hydration（计数器也得跟着 hydrate），要么整页 CSR（用户名得等 fetch）。

RSC 让两者共存于同一棵树：

```tsx
// app/page.tsx —— 服务端组件（默认）
import { UserProfile } from './user-profile'
import { Counter } from './counter'

export default function Page() {
  return (
    <>
      <UserProfile />
      <Counter />
    </>
  )
}
```

```tsx
// app/user-profile.tsx —— 服务端组件，能直接 await 数据库
import { db } from '@/lib/db'

export default async function UserProfile() {
  const user = await db.user.findFirst()
  return <h1>欢迎，{user.name}</h1>
}
```

```tsx
// app/counter.tsx —— 客户端组件
'use client'

import { useState } from 'react'

export default function Counter() {
  const [n, setN] = useState(0)
  return <button onClick={() => setN(n + 1)}>点了 {n} 次</button>
}
```

`UserProfile` 在服务端跑、不出现在客户端 bundle 里；`Counter` 在客户端跑、有 hydration。两者被编排进同一棵树交给浏览器。下面讲这个编排是怎么发生的。

## 为什么不能用 JSON 直接序列化

React 元素树不是普通对象，直接 `JSON.stringify` 会丢三样关键东西：

1. **组件类型**。`<Counter />` 序列化后是 `{ type: Counter, props: {...} }`，但 `Counter` 是个函数引用，JSON 把它丢了。客户端怎么知道这个位置该渲染哪个组件？
2. **对客户端组件的引用**。服务端不能把 `Counter` 的函数体发过去（那等于把客户端组件代码塞进服务端响应），但又得告诉客户端"这里用你那边那个叫 Counter 的组件"。
3. **可流式**。服务端可能要等数据库返回，整棵树不能一次序列化完，得边算边发。

Flight 协议就是为这三件事设计的序列化格式。

## Flight payload 长什么样

Flight payload 是一行一行的 JSON-like 记录，每行是一个"模块引用"或"元素"。简化后的样子：

```
0:["$","div",null,{"children":[...]}]
1:["$","h1",null,{"children":"欢迎，Alice"}]
2:["$","$1","counter",null,{"children":...}]
```

逐字段解读：

- `0`、`1`、`2` 是行的 id。客户端靠 id 互相引用，构成一棵树，**不依赖完整的嵌套结构**——这是流式的基础。
- `"div"`、`"h1"` 是宿主元素（host element）的类型，浏览器原生认得。
- `"$1` 这种带 `$` 前缀的，是**对客户端模块的引用**。`1` 对应一个客户端组件清单（client manifest）里的条目。客户端按这个 id 去自己 bundle 里找到 `Counter` 这个组件的实现，再在这里实例化。

所以 Flight 协议的两条关键设计：

| 设计 | 解决什么问题 |
|---|---|
| 用 id 引用而非完整嵌套 | 允许边算边发（流式），服务端组件算完一段就发一段 |
| 用模块引用（`$1`）指向客户端清单 | 服务端不把客户端组件代码发过去，只发一个"在客户端找到这个组件"的指令 |

这就是 RSC 体积优势的来源：**服务端组件的代码永远不进客户端 bundle**。

## 最小可运行示例

下面这段用 `react-server-dom-webpack/server` 把一棵混合树序列化成 Flight payload，再用 `react-dom/client` 的 `createFromFetch` / `createServerReference` 在客户端还原。省略了打包细节，但展示了协议层面发生了什么。

```ts
// server/render-to-flight.ts —— 服务端
import { renderToPipeableStream } from 'react-server-dom-webpack/server'

export function renderApp(res) {
  // Page 是上面那个含 UserProfile（服务端）和 Counter（客户端）的树
  const { pipe } = renderToPipeableStream(<Page />)
  res.setHeader('content-type', 'text/x-component')
  pipe(res)
}
```

```tsx
// client/hydrate.tsx —— 浏览器
import { createFromFetch } from 'react-client'
import { hydrateRoot } from 'react-dom/client'

const flightResponse = createFromFetch(
  fetch('/rsc', { headers: { 'Accept: 'text/x-component' } })
)

// flightResponse 是一个 thenable，resolve 后就是还原出来的 React 树
const tree = flightResponse
hydrateRoot(document.getElementById('root')!, tree)
```

关键点：**客户端不需要拿到服务端组件的代码**，它只需要 Flight payload + 自己那份客户端组件清单（client manifest）。打包器（Turbopack/webpack）在构建时生成这两份清单，运行时按 id 配对。

## 服务端组件能传给客户端组件什么

这是 RSC 最容易踩的边界。规则只有一条：**props 必须可序列化**。可序列化的有：

- 基本类型：`string` / `number` / `boolean` / `null` / `undefined`
- 普通对象和数组
- `Date`、`Map`、`Set`、`TypedArray`、`ArrayBuffer`、`Promise`

**不可序列化的**：类实例（除了上面列的内置类型）、函数引用、Symbol、`Error`（除特定子类型）。

一个高频错误：把一个服务端组件当成回调传给客户端组件：

```tsx
// app/page.tsx —— 报错
import Sidebar from './sidebar' // 客户端组件

export default function Page() {
  return <Sidebar onOpen={() => fetch('/api/log')} />
  //                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                 函数过不了服务端/客户端边界
}
```

正确做法是让客户端组件自己定义行为，或者用 Server Action（见 [第 13 章](../02-rendering/13-server-actions.md) 和 [第 57 章](./57-build-server-actions.md)）：

```tsx
// app/page.tsx —— 正确
import Sidebar from './sidebar'
import { logOpen } from './actions' // "use server"

export default function Page() {
  return <Sidebar onOpen={logOpen} />
}
```

Server Action 是个**特殊的可序列化引用**——客户端拿到的是一个 action id，调用时发 POST 回服务端执行。它绕开了"函数不能过边界"的限制，但代价是每次调用都是一个网络请求。

## 客户端组件怎么"反向"传东西给服务端组件

不能。服务端组件渲染时客户端组件还没跑，客户端拿不到 props 往上传。这就是为什么 RSC 树里**信息流是单向的**：服务端 → 客户端。客户端要影响服务端，只能通过：

- 路由（导航触发新一轮服务端渲染）
- Server Action（发请求触发服务端逻辑）
- 表单提交（Server Action 的退化形式）

这条约束是 RSC 一切设计的源头，理解它，后面 Server Actions、缓存、revalidation 的设计动机就都通了。

## 常见坑

- **现象**：服务端组件里 `import` 了一个第三方库，库体积被算进客户端 bundle。
  **原因**：该库被某个客户端组件（直接或间接）引用了。RSC 的体积优化只对**纯服务端**子树生效，一旦进入客户端子树，引用链就跟着进 bundle。
  **解法**：检查引用链，把客户端不需要的部分用动态 import 或拆到服务端专用模块里。

- **现象**：报错 `Functions cannot be passed directly to Client Components`。
  **原因**：把函数当 props 传过了边界（见上文）。
  **解法**：改用 Server Action，或把逻辑移到客户端组件内部。

- **现象**：服务端组件 `await` 数据后，整页要等最慢的那个请求。
  **原因**：服务端组件默认串行 await。
  **解法**：用 `Promise.all` 并行，或用 `<Suspense>` 包裹慢请求做流式（见 [第 09 章](../02-rendering/09-streaming-and-suspense.md) 和 [第 56 章](./56-build-streaming-ssr.md)）。

- **现象**：客户端组件里 `useState` 的初值和服务端渲染时不一致，hydration 警告。
  **原因**：服务端组件渲染出的 HTML 与客户端首次渲染结果不同。
  **解法**：初值应来自 props（由服务端组件传入），而不是客户端随机生成的值。

## 旧写法 vs 新写法

| 场景 | 旧（Pages Router / 无 RSC） | 新（App Router + RSC） |
|---|---|---|
| 服务端取数据 | `getServerSideProps` 在页面级 | 服务端组件内部直接 `await` |
| 服务端组件代码 | 进客户端 bundle | **不进**客户端 bundle |
| 服务端/客户端混合 | 难，要么全 SSR 要么拆成两套 | 同一棵树共存 |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md)。

## API / 配置速查

| API | 来源 | 作用 |
|---|---|---|
| `renderToPipeableStream` | `react-server-dom-webpack/server` | 服务端把树序列化成 Flight payload 流 |
| `createFromFetch` | `react-client` | 客户端从 fetch 响应还原成 React 树 |
| `"use client"` | 指令 | 标记客户端组件边界 |
| `"use server"` | 指令 | 标记 Server Action 模块 |

## 延伸阅读

- [官方文档：Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [官方文档：Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary)
- [React 文档：Server Components](https://react.dev/reference/rsc/server-components)
- [官方文档：How Revalidation Works](https://nextjs.org/docs/app/guides/how-revalidation-works)
