# 07 · Server / Client Components

> **一句话结论**：`app/` 下的组件默认是服务端组件，只有加了 `"use client"` 的组件才会进客户端包；这个指令是**模块图的边界**而不是单个组件的标签，一旦标记，它 import 进来的整棵子树都在客户端。判断标准只有一条：这个组件需不需要浏览器状态。

## 最小可运行示例

```tsx
// app/[id]/page.tsx
// 默认是服务端组件：可以直接 await 数据、读数据库、用密钥
import LikeButton from '@/app/ui/like-button'
import { getPost } from '@/lib/data'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await getPost(id)

  return (
    <main>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
      {/* 只有需要点击交互的这一小块是客户端组件 */}
      <LikeButton likes={post.likes} />
    </main>
  )
}
```

```tsx
// app/ui/like-button.tsx
'use client' // 必须在所有 import 之前

import { useState } from 'react'

export default function LikeButton({ likes }: { likes: number }) {
  const [count, setCount] = useState(likes)

  return <button onClick={() => setCount(count + 1)}>{count} 个赞</button>
}
```

这个文件同时演示了两件事：数据在服务端取（`await getPost`），交互在客户端做（`useState`）。两边的边界就是 `<LikeButton>` 这一行。

## 什么时候用哪种组件

判断依据是**运行环境的能力差异**，不是"哪个更先进"。

用**客户端组件**，当组件需要：

- 状态与事件处理（`useState`、`onClick`、`onChange`）
- 生命周期逻辑（`useEffect`）
- 只有浏览器才有的 API（`localStorage`、`window`、`navigator.geolocation`）
- 自定义 hook

用**服务端组件**，当组件需要：

- 就近访问数据库或内部服务
- 使用 API key、token 等不能暴露给客户端的密钥
- 减少发往浏览器的 JavaScript 体积
- 改善 First Contentful Paint（FCP），渐进地把内容流给客户端

有一条容易忽略的中间地带：**浏览器原生行为不需要客户端组件**。`<details>` 自己会开合，`<form action={serverAction}>` 能直接提交，`<video controls>` 能播放——这些都不需要写 `"use client"`。只有需要"随时间变化的浏览器状态"时才真的需要客户端组件，比如受控输入框、实时筛选、拖拽手柄。

## 为什么这样设计：两棵树，一次序列化

要理解边界，先要理解服务端到底交付了什么。

**服务端**，React 按路由段（layout / page，以及平行路由的每个槽位，无论是否展示）分块渲染：

- 服务端组件被渲染成一种特殊数据格式，叫 **RSC Payload**（React Server Component Payload）。它包含：服务端组件的渲染结果、客户端组件该渲染在哪的占位符及其 JS 文件引用、以及从服务端组件传给客户端组件的 props。
- 客户端组件和这份 Payload 一起被预渲染成 HTML。

**客户端首次加载**时，三样东西依次起作用：**HTML** 立刻显示一份不可交互的预览；**RSC Payload** 用来协调（reconcile）客户端与服务端两棵组件树；**JavaScript** 用来 hydration，把事件处理器挂到 DOM 上。**后续客户端导航**时，只请求 RSC Payload（带 `rsc: 1` 请求头），完全不传 HTML，客户端组件在浏览器里整体重新渲染。

| | 服务端 | 浏览器 |
|---|---|---|
| 服务端组件 | 是 | **否** |
| 客户端组件 | 是 | 是 |

"客户端组件"这个词容易误导：它**也**在服务端渲染一次，只是它的代码同时会进浏览器——所以一个 `'use client'` 组件里的 `console.log`，直接访问页面时会先在终端打印、再在浏览器控制台打印。而服务端组件的代码永远不到浏览器。"服务端渲染"描述的是 HTML 怎么产生的（构建期 SSG / 后台 ISR / 请求期 SSR）；"服务端组件"描述的是组件代码在哪跑、要不要发到浏览器。这是两件不同的事。

### `"use client"` 的传播规则

`"use client"` 声明的是**服务端模块图与客户端模块图之间的边界**。

一旦某个文件被标记，**它 import 的所有模块、以及它直接渲染的组件，都会被纳入客户端包**。所以你不必给每个想在客户端跑的组件都加指令。

```tsx
// app/ui/counter-panel.tsx
'use client'

import { useState } from 'react'
// 这个文件里 import 的所有东西都会进客户端包
import { formatNumber } from '@/lib/format'

export default function CounterPanel() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <p>{formatNumber(count)}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  )
}
```

**传播范围不包括**通过 `children` 或其他 props 传进来的服务端组件。那些组件没有被 import 进客户端的模块图——它们在服务端渲染好，把渲染结果交给客户端组件。

实践中这意味着：想控制包体积，就把 `'use client'` 加到**具体的交互组件**上，而不是给一大片 UI 打标记。

```tsx
// app/layout.tsx
import Search from './ui/search' // 客户端组件
import Logo from './ui/logo' // 服务端组件

// Layout 默认是服务端组件
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav>
        <Logo />
        <Search />
      </nav>
      <main>{children}</main>
    </>
  )
}
```

这里的 `<Logo>` 不会因为和 `<Search>` 是兄弟节点就被拉进客户端包。

### 过边界的两条通道：代码走 import，数据走 props

- **代码**通过 import 跨越。客户端组件 import 什么，什么就进客户端包。
- **数据**通过 props 跨越，且必须可序列化。

props 的序列化能力来自 React 的 RSC 序列化规则：

| 可以过线 | 不能过线 |
|---|---|
| 原始类型：`string`、`number`、`bigint`、`boolean`、`undefined`、`null` | 普通函数（未标记 `'use server'`、也非从客户端模块导出的） |
| `Date`、`Map`、`Set`、`TypedArray`、`ArrayBuffer` | 类本身，以及任何类的实例（上述内置类型除外） |
| 由对象字面量创建、属性可序列化的普通对象 | 带 null prototype 的对象 |
| 数组、`String` | 未用 `Symbol.for` 注册到全局 registry 的 symbol |
| `Promise`（配合 `use` 读取） | `URL` 实例 |
| Server Functions（以引用形式） | |
| JSX 元素 | |

这里有两个反直觉的点值得记住。

**第一，`Date` 是能过线的。** 网上常见"Date 过不了边界"的说法是错的——`Date`、`Map`、`Set` 都在 React 明确支持的清单里。真正过不去的是**类实例**：`new UserClass()` 这类对象不行，而 `Date` 是 React 单独列出的内置类型。

**第二，函数不是绝对不能过。** 普通函数传过去会抛错（`onClick` 这种事件处理器就过不去），但标记了 `'use server'` 的 **Server Function** 以引用形式过线。麻烦在于——函数在类型上区分不出是不是 Server Function，所以 Next.js 的 TypeScript 插件定了一条规则：**prop 名是 `action` 或以 `Action` 结尾**的函数 prop 才放行，其他函数 prop 一律报错。

```tsx
// app/client-component.tsx
'use client'

export default function ClientComponent({
  updateItemAction, // 名字以 Action 结尾，TS 插件放行
}: {
  updateItemAction: (formData: FormData) => void
}) {
  return <form action={updateItemAction}>{/* ... */}</form>
}
```

### 组合模式：服务端组件当 `children` 传给客户端组件

这是整个模型里最有用的一个技巧。**你可以把服务端组件作为 prop 传给客户端组件**，从而在客户端组件内部嵌进服务端渲染的 UI。

典型场景：一个用客户端状态控制显隐的 `<Modal>`，里面装一个在服务端取数据的 `<Cart>`。

```tsx
// app/ui/modal.tsx
'use client'

import { useState, type ReactNode } from 'react'

export function Modal({
  title,
  children,
}: {
  title: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  if (!open) return null

  return (
    <div role="dialog">
      <header>
        {title}
        <button onClick={() => setOpen(false)}>Close</button>
      </header>
      {children}
    </div>
  )
}
```

```tsx
// app/page.tsx
import { Cart } from '@/app/ui/cart' // 服务端组件
import { Modal } from '@/app/ui/modal' // 客户端组件

export default function Page() {
  return (
    <Modal title={<div>Your cart</div>}>
      <Cart />
    </Modal>
  )
}
```

`<Cart>` 在服务端提前渲染好，`<Modal>` 只拿到它的渲染结果，永远拿不到它的代码。

为什么会这样？因为 React 区分两个概念：

- **owner**：源码里写下这个子元素 JSX 的那个组件。这里是 `Page`，它同时"拥有" `Modal` 和 `Cart`。
- **parent**：渲染树里直接包含这个子节点的组件。这里是 `Modal`，它是 `Cart` 的父节点。

`Cart` 的 owner 是服务端组件，所以它在服务端渲染。`Modal` 只是 parent，所以它拿到的是 `Cart` 的输出而不是 `Cart` 的代码。这个区分让客户端组件能展示一个它从未 import 过的服务端组件。

同样的技巧用在 context 上。React context 在服务端组件里不支持，所以把 provider 做成接收 `children` 的客户端组件：

```tsx
// app/theme-provider.tsx
'use client'

import { createContext } from 'react'

export const ThemeContext = createContext({})

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>
}
```

用法是把它包在布局里：`<html><body><ThemeProvider>{children}</ThemeProvider></body></html>`。provider 要**尽量放深**——只包 `{children}` 而不是整个 `<html>`，这样 Next.js 还能把 `html`、`body` 这些静态部分优化掉。

### 第三方库只在客户端跑时的处理

第三方组件依赖 `useState` 之类的客户端能力、但没写 `"use client"` 时，直接在服务端组件里用它，Next.js 不知道它需要客户端环境，会报错。

在客户端组件里用是没问题的：

```tsx
// app/gallery.tsx
'use client'

import { useState } from 'react'
import { Carousel } from 'acme-carousel'

export default function Gallery() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div>
      <button onClick={() => setIsOpen(true)}>View pictures</button>
      {/* 可以，因为 Carousel 被用在客户端组件内部 */}
      {isOpen && <Carousel />}
    </div>
  )
}
```

想在服务端组件里直接用，就包一层自己的客户端组件：

```tsx
// app/carousel.tsx
'use client'

import { Carousel } from 'acme-carousel'

export default Carousel
```

```tsx
// app/page.tsx
import Carousel from './carousel'

export default function Page() {
  return <Carousel />
}
```

这个 wrapper 模式同样适用于你自己写的共享组件——不必给每个用了 `useState` 的共享组件加指令，包一层就好。

> 如果你是**库作者**：在依赖客户端能力的入口文件上直接加 `"use client"`，用户就能在服务端组件里 import 你的组件而不用自己包 wrapper。注意某些打包器会把这个指令 tree-shake 掉，需要在构建配置里显式保留。

### 防止服务端代码泄漏到客户端

JS 模块可以被服务端和客户端共享，所以有可能把服务端代码误 import 进客户端。下面这个函数含一个绝不该出现在客户端的密钥：

```ts
// lib/data.ts
export async function getData() {
  const res = await fetch('https://external-service.com/data', {
    headers: {
      authorization: process.env.API_KEY,
    },
  })

  return res.json()
}
```

Next.js 只把 `NEXT_PUBLIC_` 前缀的环境变量打进客户端包，其他变量会被替换成空字符串。所以这个函数即使被 import 到客户端也不会正常工作——但这是"静默失效"，不是"报错拦截"，风险仍然存在。加上 `import 'server-only'` 就能把它变成构建期错误：

```ts
// lib/data.ts
import 'server-only'

export async function getData() {
  const res = await fetch('https://external-service.com/data', {
    headers: {
      authorization: process.env.API_KEY,
    },
  })

  return res.json()
}
```

现在一旦有客户端组件 import 这个模块，构建直接失败。对应的 `client-only` 包用来标记只含客户端逻辑的模块（比如访问 `window` 的代码）。两个包在 Next.js 里都是**可选安装**——Next.js 内部自行处理这两个 import 以给出更清晰的报错，NPM 上的包内容并不会被使用。

```bash
pnpm add server-only
```

## 常见坑

- **现象**：在服务端组件里写 `onClick` 或 `useState`，报错说只能在客户端组件里用。
  **原因**：服务端组件的代码根本不会到浏览器，浏览器事件与状态无从挂载。这不是配置问题，是模型约束。
  **解法**：把需要交互的那一小块抽成单独文件加 `"use client"`，服务端组件只负责取数据并把它渲染出来。先试一件事：确认这个交互真的需要浏览器状态——`<details>`、`<form action>`、`<video controls>` 都不需要。

- **现象**：明明只给一个小组件加了 `"use client"`，客户端包却暴涨。
  **原因**：`"use client"` 标记的是模块图边界。那个文件 import 的所有东西、以及它直接渲染的所有组件都被拉进了客户端包。
  **解法**：顺着那个文件的 import 链往下查，看有没有把大依赖（图表库、编辑器、日期库）带了进来。把重依赖改成 `next/dynamic` 动态导入，或者把不需要交互的部分移回服务端组件、用 `children` 传进去。

- **现象**：把一个 `Date` 从服务端组件传给客户端组件，同事说"Date 不能过边界"，但实测能跑。
  **原因**：`Date`、`Map`、`Set`、`TypedArray`、`ArrayBuffer` 都在 React 明确支持的可序列化类型里。真正过不去的是**类实例**（`new Foo()`）和普通函数。
  **解法**：报错时先看对象是不是自定义类的实例。是的话在服务端转换成普通对象再传：`{ id: user.id, name: user.name }`。

- **现象**：把 `<Menu.Item>` 这类复合组件的静态成员从服务端组件里用，报 "Element type is invalid"。
  **原因**：复合组件用静态属性挂子组件（`Menu.Item`、`Tabs.Panel`），这套写法只在**同一个模块图内**成立。服务端组件 import 客户端组件时拿到的是 client reference 而不是函数，所以 `Menu.Item` 是 `undefined`。
  **解法**：复合客户端组件就只在客户端组件里用；要从服务端组件用它的各个部件，让对方改成具名导出。

- **现象**：服务端组件里用了某个第三方组件，报错说不能用 `useState`。
  **原因**：这个库依赖客户端能力，但没加 `"use client"`，Next.js 不知道它该在客户端跑。
  **解法**：自己包一层客户端 wrapper（`'use client'` + 直接 re-export），然后在服务端组件里 import 这个 wrapper。

- **现象**：客户端组件里 `console.log` 打印了两次，或者 `useEffect` 在首次加载时多跑了一轮。
  **原因**：直接访问页面时，客户端组件先在服务端渲染出 HTML，再在浏览器 hydration 时渲染一次。这不是 bug，是双端渲染的必然结果。
  **解法**：把副作用写成幂等的，或者用 `useEffect` 的正确依赖声明让它在 hydration 后只跑需要跑的那一次。开发模式下 React 的 StrictMode 还会额外跑一次以暴露不纯的副作用。

- **现象**：`process.env.SECRET_KEY` 在客户端组件里读到 `undefined`，但没报错。
  **原因**：只有 `NEXT_PUBLIC_` 前缀的变量会进客户端包，其余被替换成空字符串。所以是静默失效而非显式报错。
  **解法**：在含密钥的模块顶部加 `import 'server-only'`，把这类误用变成构建期错误。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 页面取数据 | `getServerSideProps` / `getStaticProps` 在组件外取好再当 props 传 | **服务端组件里直接 `await`** |
| 客户端取数据 | `useEffect` + `useState` 在挂载后请求 | 服务端取好当 props 传，或传 Promise 给客户端组件用 `use` 读 |
| 客户端标记 | 每个文件都写 `"use client"` | **只在客户端子树的入口写一次** |
| 密钥防泄漏 | 靠代码审查 | `import 'server-only'` 构建期拦截 |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条（请求 API 转异步，直接影响服务端组件里 `params` / `cookies()` 的写法）。

## API / 配置速查

| 项 | 说明 |
|---|---|
| `"use client"` | 标记客户端组件边界，必须位于文件顶部、所有 import 之前 |
| `"use server"` | 标记 Server Function（见 [13 Server Actions](./13-server-actions.md)） |
| 默认组件类型 | 服务端组件（`layout`、`page` 及 `app/` 下所有组件） |
| `import 'server-only'` | 该模块被客户端 import 时构建失败 |
| `import 'client-only'` | 标记只含客户端逻辑的模块 |
| 函数 prop 命名规则 | TS 插件只放行名为 `action` 或以 `Action` 结尾的函数 prop |

序列化能力清单见上文「过边界的两条通道」。

## 延伸阅读

- [官方文档：Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [官方文档：The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary)
- [官方文档：`use client` 指令](https://nextjs.org/docs/app/api-reference/directives/use-client)
- [React 文档：`use client` 与可序列化类型](https://react.dev/reference/rsc/use-client)
- [React 文档：Server Components](https://react.dev/reference/rsc/server-components)
