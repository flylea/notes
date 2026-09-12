# 58 · 客户端组件与 hydration 原理

> **一句话结论**：`"use client"` 不是"这个组件只在客户端跑"，而是"这条指令之上的子树**允许**在客户端运行、会进客户端 bundle"。服务端照样会把它的初始 HTML 渲染出来；hydration 是"服务端 HTML + 客户端 JS"两份描述**对账**的过程，对账失败就叫 hydration mismatch。理解这条边界和这次对账，hydration 报错就不再是玄学。

## `"use client"` 在编译期被处理成什么

源码里 `"use client"` 是个指令。打包器（Turbopack/webpack）扫到它时做的事是：

1. 把这个文件（及其 import 的子树）标记为"客户端模块"，会进客户端 bundle。
2. 在服务端组件引用它的地方，把它换成一个**客户端引用**（client reference）——一个稳定的 id，序列化进 RSC payload 时是 `["$","$1",...]`（见 [第 55 章](./55-rsc-and-flight.md)）。
3. 客户端 bundle 里保留它的真实实现，运行时按 id 配对。

所以服务端组件**不持有**客户端组件的代码，只持有一个 id 引用。这就是为什么客户端组件代码不进服务端响应、服务端组件代码不进客户端 bundle。

## 服务端会渲染客户端组件吗

会。这是最大的认知误区。`"use client"` 不阻止服务端渲染——服务端照样会调用客户端组件的渲染函数，产出初始 HTML。

```tsx
// app/counter.tsx —— 客户端组件
'use client'
import { useState } from 'react'

export default function Counter({ initial = 0 }: { initial?: number }) {
  const [n, setN] = useState(initial)
  return <button onClick={() => setN(n + 1)}>点了 {n} 次</button>
}
```

```tsx
// app/page.tsx —— 服务端组件
import Counter from './counter'

export default function Page() {
  return <Counter initial={42} />   // 服务端渲染出 <button>点了 42 次</button>
}
```

服务端把 `Counter` 渲染成 `<button>点了 42 次</button>`，写进 HTML。客户端 JS 加载后，`hydrateRoot` 不会重新渲染——它**对账**：拿 React 树重新算一次，看和服务端 HTML 是否一致。一致就只在 DOM 上挂事件（attach handler），不一致就报 hydration mismatch。

为什么要对账而不是直接覆盖？因为 hydration 前的 HTML 已经显示给用户了，重渲染会清屏闪烁；对账只在 DOM 上"打补丁"，保留已有内容。

## hydration mismatch 的成因

服务端渲染结果与客户端首次渲染结果不一致。常见来源：

```tsx
'use client'
import { useState } from 'react'

export default function Bad() {
  const [now] = useState(() => Date.now())   // 服务端一个值、客户端另一个
  return <time>{now}</time>
}
```

服务端渲染时取了一个时间戳 `T1`，写进 HTML；客户端 hydrate 时再调 `Date.now()` 得到 `T2`，两者不等 → mismatch。

```tsx
'use client'
export default function Bad2() {
  return <div>{typeof window !== 'undefined' ? 'client' : 'server'}</div>
  // 服务端渲染 'server'，客户端 hydrate 时 'client' → mismatch
}
```

```tsx
'use client'
export default function Bad3() {
  return <div>{Math.random()}</div>   // 每次都不一样
}
```

共同点：**渲染结果依赖了在服务端和客户端不一样的值**——时间、随机数、`window`/`document` 的存在。

## React 19 对 hydration 的改进

React 19 / 19.2 在 hydration 行为上有两个值得知道的改进：

1. **更宽松的 mismatch 处理**：过去任何 mismatch 都会让 React 抛弃整个子树重渲染。React 19 对一些"客户端专属"的属性（比如 `className` 因样式系统不同导致的差异）能做更细粒度的对账，避免整树重渲染。
2. **`useEffectEvent` / `<Activity>`** 等新能力让"客户端专属逻辑"有更合适的归宿，减少靠 `typeof window` 这种 hack 做客户端检测的需求。

但**根因没变**：渲染结果不该依赖服务端和客户端不同的值。

## 正确写法：把不稳定的值推迟到 effect

```tsx
'use client'
import { useState, useEffect } from 'react'

export default function Good() {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => setNow(Date.now()), [])   // 只在客户端跑
  return <time>{now ?? '加载中'}</time>
}
```

服务端和客户端首次渲染都是 `加载中`，对账一致；`now` 只在 effect 里被赋值，是 hydration 之后的更新。

## 一个完整可观察的示例

```tsx
// app/hydration-demo/page.tsx —— 服务端组件
import ClientOnly from './client-only'

export default function Page() {
  return (
    <>
      <div>服务端时间：{new Date().toLocaleString('zh-CN')}</div>
      <ClientOnly />
    </>
  )
}
```

```tsx
// app/hydration-demo/client-only.tsx
'use client'
import { useState, useEffect } from 'react'

export default function ClientOnly() {
  const [ws, setWs] = useState<string>('')
  useEffect(() => {
    setWs(`${window.innerWidth}x${window.innerHeight}`)
  }, [])
  return <div>客户端视口：{ws || '检测中'}</div>
}
```

服务端渲染出：`客户端视口：检测中`。客户端 hydrate 时也是 `检测中`（一致），之后 effect 把真实视口塞进去。`window` 永远不在初次渲染路径上。

## 边界划分的实践原则

| 何时该标 `"use client"` | 为什么 |
|---|---|
| 用了 `useState` / `useReducer` / `useEffect` 等客户端 hook | 服务端没这些概念 |
| 绑了事件（`onClick` 等） | 事件只能在客户端 |
| 用了浏览器 API（`window` / `localStorage` / `navigator`） | 服务端没有 |
| 用了纯客户端库（图表库交互态、拖拽等） | 它们依赖 DOM |

把边界推得尽量高（靠近叶子）而不是根——这样大部分子树留在服务端，不进客户端 bundle，体积才省得下来。

## 常见坑

- **现象**：控制台报 `Hydration failed: server rendered HTML doesn't match`。
  **原因**：渲染依赖了服务端/客户端不同的值（时间、随机数、`window`）。
  **解法**：把这些值推迟到 `useEffect`。

- **现象**：客户端组件引用服务端组件报错。
  **原因**：方向反了。服务端 → 客户端可以，客户端 → 服务端不行（信息流单向，见 [第 55 章](./55-rsc-and-flight.md)）。
  **解法**：把要复用的服务端内容作为 `children` 传给客户端组件。

- **现象**：`useState` 的初值在服务端和客户端不一致。
  **原因**：初值用了不稳定的来源。
  **解法**：初值应来自 props（由服务端组件传入），effect 里再更新。

- **现象**：第三方库报 `window is not defined`。
  **原因**：它被打进了服务端渲染路径。
  **解法**：用 `next/dynamic` 配 `ssr: false` 把它延迟到客户端（见 [第 22 章](../04-styling-assets/22-lazy-loading.md)）。

- **现象**：客户端组件很大，首屏慢。
  **原因**：边界推得太靠近根。
  **解法**：把交互部分抽成小叶子组件标 `"use client"`，外壳留在服务端。

## 旧写法 vs 新写法

| 场景 | 旧（Pages Router） | 新（App Router + RSC） |
|---|---|---|
| 边界 | 几乎所有组件都是"客户端" | 默认服务端，显式标客户端 |
| 服务端渲染客户端组件 | 不存在这个概念 | 会，但只产 HTML 不跑客户端逻辑 |
| 信息流 | 双向 | 服务端 → 客户端单向 |
| 客户端 bundle 体积 | 大 | 小（只含客户端子树） |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md)。

## API / 配置速查

| API | 作用 |
|---|---|
| `'use client'` | 标记客户端组件边界 |
| `hydrateRoot` | 客户端对账 + 挂事件 |
| `useEffect` | 客户端专属副作用 |
| `next/dynamic` + `ssr: false` | 延迟纯客户端组件到客户端 |

## 延伸阅读

- [官方文档：Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [官方文档：Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary)
- [React 文档：Client Components](https://react.dev/reference/rsc/use-client)
- [B站《Next简明教程》hydration - 02](https://www.bilibili.com/video/BV1B3E46sEZ1/)
