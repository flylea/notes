# 22 · 懒加载与动态导入

> **一句话结论**：`next/dynamic` 本质是 `React.lazy()` + `<Suspense>` 的组合，用来把**客户端组件**和第三方库从首屏 bundle 里拆出去，等真正需要时再下载。它只对客户端组件有意义——服务端组件本身就自动代码分割了；`ssr: false` 更是**只能用在客户端组件里**，写在服务端组件会直接报错。

## 最小可运行示例

```tsx
// app/page.tsx
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

// 独立的客户端 bundle，首屏就加载
const Chart = dynamic(() => import('../components/chart'))

// 点击后才加载
const HeavyModal = dynamic(() => import('../components/heavy-modal'))

export default function Page() {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <Chart />
      <button onClick={() => setOpen(true)}>打开</button>
      {open && <HeavyModal />}
    </div>
  )
}
```

`HeavyModal` 对应的 JS **不会**进入首屏 bundle——用户不点按钮就永远不下载。

## `next/dynamic` 与 `React.lazy` 的关系

`next/dynamic` 是 `React.lazy()` 和 `Suspense` 的**组合封装**，在 `app` 和 `pages` 目录下行为一致。区别在于：

| | `React.lazy()` | `next/dynamic` |
|---|---|---|
| 加载中 UI | 必须自己包 `<Suspense fallback={...}>` | 可以用 `loading` 选项，也可包 `Suspense` |
| 关闭 SSR | 不支持 | 支持 `ssr: false` |
| 具名导出 | 需要 `.then(mod => ({ default: mod.X }))` | 同样需要，或返回 `mod.X` |
| 适用对象 | 任何组件 | 主要面向客户端组件 |

两种写法都能用。用 `React.lazy` 时 `Suspense` 是必须的：

```tsx
// app/page.tsx
'use client'

import { lazy, Suspense } from 'react'

const Chart = lazy(() => import('../components/chart'))

export default function Page() {
  return (
    <Suspense fallback={<p>加载中…</p>}>
      <Chart />
    </Suspense>
  )
}
```

用 `next/dynamic` 可以省掉 `Suspense`：

```tsx
// app/page.tsx
'use client'

import dynamic from 'next/dynamic'

const Chart = dynamic(() => import('../components/chart'), {
  loading: () => <p>加载中…</p>,
})
```

## 三种使用形态

### 形态一：立即加载，但在独立 bundle 里

```tsx
// app/page.tsx
'use client'

import dynamic from 'next/dynamic'

const ComponentA = dynamic(() => import('../components/a'))

export default function Page() {
  // 首屏渲染，但代码在另一个 chunk 里
  return <ComponentA />
}
```

意义：把这块代码从主 bundle 里拆出去，让首屏主 bundle 更小。代价是多一次请求——所以只对「体积够大、又不是立即需要」的组件值得。

### 形态二：按需加载

```tsx
// app/page.tsx
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const ComponentB = dynamic(() => import('../components/b'))

export default function Page() {
  const [showMore, setShowMore] = useState(false)

  return (
    <div>
      {showMore && <ComponentB />}
      <button onClick={() => setShowMore(!showMore)}>展开</button>
    </div>
  )
}
```

这是收益最大的一种：**条件不成立时，代码永远不下载**。典型场景是弹窗、抽屉、富文本编辑器、图表、代码高亮。

### 形态三：只在客户端加载（`ssr: false`）

```tsx
// app/components/client-only-widget.tsx
'use client'

import dynamic from 'next/dynamic'

const ComponentC = dynamic(() => import('./c'), { ssr: false })

export default function ClientOnlyWidget() {
  return <ComponentC />
}
```

`ssr: false` 让这个组件**完全不参与服务端预渲染**，只在浏览器里渲染。

它解决什么：组件依赖 `window`、`document`、`localStorage`，或者第三方库在服务端会崩。不用它就得写 `typeof window !== 'undefined'` 的判断，而且 SSR 和客户端渲染结果不一致还会导致 hydration 错误。

> **关键约束**：`ssr: false` **只能用在客户端组件里**。写在服务端组件里会报错——官方提示是「请把它移进客户端组件」。这是为什么上面的示例包了一层 `'use client'` 的文件。

## 边界：什么时候不该用

`next/dynamic` 不是「性能开关」，它有明确的适用边界。

### 服务端组件不需要它

> 服务端组件**默认就自动代码分割**。

服务端组件的代码根本不发送到浏览器，它只产出 RSC payload。所以对一个服务端组件用 `next/dynamic`，省不下任何客户端字节。

更麻烦的是：**当服务端组件动态导入一个客户端组件时，自动代码分割目前不被支持**。

```tsx
// app/page.tsx —— 服务端组件
import dynamic from 'next/dynamic'

// 这里的收益很有限，且自动代码分割不生效
const ClientThing = dynamic(() => import('../components/client-thing'))

export default function Page() {
  return <ClientThing />
}
```

如果目标是拆分某个客户端组件，**应该从客户端组件那一层去 `dynamic()` 它**。

### 动态导入服务端组件时，拆的是子节点

```tsx
// app/page.tsx
import dynamic from 'next/dynamic'

// 服务端组件
const ServerComponent = dynamic(() => import('../components/server-component'))

export default function Page() {
  return <ServerComponent />
}
```

这种情况下**被懒加载的不是服务端组件本身**，而是它的客户端子组件。附带的好处是：在服务端组件里用时，静态资源（如 CSS）会被预加载。

### 收益判断

| 情况 | 用 `next/dynamic` |
|---|---|
| 大体积客户端组件，首屏不需要 | ✅ 值得 |
| 条件渲染的弹窗 / 编辑器 / 图表 | ✅ 值得 |
| 依赖 `window` 的组件 | ✅ 用 `ssr: false` |
| 小的客户端组件 | ❌ 多一次请求，可能更慢 |
| 服务端组件 | ❌ 无收益 |
| 首屏必现的关键组件 | ❌ 反而拖慢 LCP |

判断标准很朴素：**拆分省下的字节，是否大于多出来的那次请求成本**。一个 3KB 的组件拆出去，在慢网络下可能比不拆还慢。

## 懒加载第三方库

不需要组件包装时，直接在事件里 `await import()`：

```tsx
// app/page.tsx
'use client'

import { useState } from 'react'

const names = ['Tim', 'Joe', 'Bel', 'Lee']

export default function Page() {
  const [results, setResults] = useState<unknown>()

  return (
    <div>
      <input
        type="text"
        placeholder="搜索"
        onChange={async (e) => {
          const { value } = e.currentTarget
          // 用户开始输入后才下载 fuse.js
          const Fuse = (await import('fuse.js')).default
          const fuse = new Fuse(names)
          setResults(fuse.search(value))
        }}
      />
      <pre>结果：{JSON.stringify(results, null, 2)}</pre>
    </div>
  )
}
```

这是把「库」而不是「组件」拆出去——适合那种只在特定交互路径上用到的库（模糊搜索、Markdown 渲染、日期格式化、CSV 导出）。

### 具名导出

`import()` 的默认导出可以直接用；要拿具名导出就得在 `.then` 里挑出来：

```tsx
// app/components/hello.tsx
'use client'

export function Hello() {
  return <p>Hello!</p>
}
```

```tsx
// app/page.tsx
import dynamic from 'next/dynamic'

const Hello = dynamic(() => import('../components/hello').then((mod) => mod.Hello))

export default function Page() {
  return <Hello />
}
```

## Magic Comments

`next/dynamic` 之外，动态 `import()` 支持一批控制打包器行为的注释。它们**只对动态表达式生效**，静态 `import x from 'y'` 上写没用。

### 跳过打包

```ts
// 完全跳过打包，保留原样的 import，运行时才解析
const runtime = await import(/* webpackIgnore: true */ 'runtime-module')

// Turbopack 专属变体
const plugin = await import(/* turbopackIgnore: true */ pluginPath)
```

用途：模块在构建时不存在、只在部署环境里存在（插件系统、平台注入的运行时模块）。

### 抑制构建错误

```ts
// 模块不存在时不在构建期报错，运行时才抛 MODULE_NOT_FOUND
const feature = await import(/* turbopackOptional: true */ './optional-feature')
```

用途：可选依赖、插件系统、渐进迁移中还没创建的文件。

| 注释 | webpack | Turbopack |
|---|---|---|
| `webpackIgnore: true` | 支持 | 支持 |
| `turbopackIgnore: true` | 不支持 | 支持 |
| `turbopackOptional: true` | 不支持 | 支持 |
| `webpackOptional: true` | **不支持** | **不支持** |

> Turbopack 下不要用 `webpackOptional`，它不存在。需要这个能力就用 `turbopackOptional`。Turbopack 成为默认打包器的变更见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 2 条。

## 图片懒加载

图片的懒加载走的是**浏览器原生能力**，不需要 `next/dynamic`。`next/image` 的 `loading` 默认就是 `lazy`：

```tsx
// app/page.tsx
import Image from 'next/image'

export default function Page() {
  return (
    <>
      {/* 首屏主图：立即加载 */}
      <Image src="/hero.png" alt="主视觉" width={1200} height={630} loading="eager" />

      {/* 首屏之外的图：默认 lazy，进入视口附近才请求 */}
      <Image src="/gallery-1.png" alt="" width={800} height={600} />
    </>
  )
}
```

原理上两者完全不同：

| | 图片懒加载 | 组件懒加载 |
|---|---|---|
| 机制 | 浏览器原生 `loading="lazy"` | 打包器代码分割 + 动态 `import()` |
| 触发条件 | 距视口达到计算距离 | 代码路径被执行到 |
| 网络行为 | 元素始终在 DOM 里，只是延迟请求 | chunk 文件延迟下载并执行 |
| 对 SEO | 无影响（`<img>` 在 HTML 里） | 无影响（组件懒加载与爬虫无关） |

图片懒加载不涉及 JS bundle，所以「首屏图片记得设 `loading="eager"` 或 `preload`」和「组件懒加载」是两件独立的事。第 20 章讲了 `next/image` 的完整 prop。

## 常见坑

- **现象**：在服务端组件里写 `dynamic(() => import('./x'), { ssr: false })`，构建报错。
  **原因**：`ssr: false` 只允许在客户端组件里使用。
  **解法**：把 `dynamic()` 那行移进一个 `'use client'` 的文件，从服务端组件里引用那个文件。

- **现象**：对服务端组件用了 `next/dynamic`，首屏 JS 一点没少。
  **原因**：服务端组件的代码本来就不发送到浏览器，服务端组件动态导入客户端组件时自动代码分割也不生效。
  **解法**：把 `dynamic()` 下沉到客户端组件那一层。

- **现象**：拆了一堆小组件之后，页面反而变慢了。
  **原因**：每个动态导入都是一次额外请求，HTTP 往返成本可能大于省下的字节。
  **解法**：只拆体积明显大、且非首屏必需的组件；小组件保持静态导入。

- **现象**：`dynamic(() => import('./x'))` 拿到 `undefined`，组件渲染不出来。
  **原因**：`x` 是具名导出，而 `dynamic` 默认取 `default`。
  **解法**：写成 `dynamic(() => import('./x').then((mod) => mod.X))`。

- **现象**：用 `next/dynamic` 时忘了写 `loading`，页面上出现一块空白。
  **原因**：`next/dynamic` 没有内置默认的 loading UI。
  **解法**：加 `loading: () => <Skeleton />`，或用 `<Suspense fallback={...}>` 包起来。

- **现象**：给静态 `import` 加了 `/* webpackIgnore: true */`，完全没效果。
  **原因**：Magic Comments 只对动态表达式生效。
  **解法**：改成动态 `import()`。

- **现象**：Turbopack 下 `/* webpackOptional: true */` 不生效。
  **原因**：这个注释 webpack 和 Turbopack 都不支持。
  **解法**：用 `/* turbopackOptional: true */`。

- **现象**：把首屏必现的组件拆出去后，LCP 变差了。
  **原因**：多了一次请求往返，首屏渲染被延后。
  **解法**：首屏关键路径上的组件保持静态导入；懒加载只用在「条件渲染」或「视口外」的东西上。

- **现象**：`ssr: false` 的组件在页面上闪一下才出现。
  **原因**：它完全不参与服务端预渲染，服务端返回的 HTML 里没有它。
  **解法**：这是设计使然。为它预留占位空间（固定高度或骨架屏），避免出现布局偏移。

## API / 配置速查

| `dynamic()` 选项 | 类型 | 说明 |
|---|---|---|
| `ssr` | `boolean` | `false` 时跳过服务端预渲染，**仅客户端组件可用** |
| `loading` | `() => ReactNode` | 加载中渲染的 UI |
| `suspense` | `boolean` | 是否用 `Suspense` 包裹（配合 `loading` 使用） |

| Magic Comment | webpack | Turbopack | 用途 |
|---|---|---|---|
| `webpackIgnore: true` | ✅ | ✅ | 跳过打包 |
| `turbopackIgnore: true` | ❌ | ✅ | 跳过打包 |
| `turbopackOptional: true` | ❌ | ✅ | 抑制解析错误 |
| `webpackOptional: true` | ❌ | ❌ | 不存在 |

| 相关 API | 用途 |
|---|---|
| `React.lazy()` + `<Suspense>` | 不依赖 Next.js 的等价方案 |
| `await import('lib')` | 按需加载库 |
| `next/image` 的 `loading` | 图片的原生懒加载 |

## 延伸阅读

- [官方文档：Lazy Loading 指南](https://nextjs.org/docs/app/guides/lazy-loading)
- [官方文档：Image 组件](https://nextjs.org/docs/app/api-reference/components/image)
- [React 文档：lazy](https://react.dev/reference/react/lazy)
- [React 文档：Suspense](https://react.dev/reference/react/Suspense)
- [MDN：Lazy loading](https://developer.mozilla.org/docs/Web/Performance/Lazy_loading)
