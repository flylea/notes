# 03 · 链接与导航

> **一句话结论**：导航永远优先用 `<Link>`，它会**在链接进入视口时自动预取**（仅生产环境）——静态路由预取整条路由，动态路由只预取到最近的 `loading.tsx` 边界，没有 `loading.tsx` 就完全跳过；需要编程式跳转、读 URL、做 pending 反馈时再用 `useRouter` / `usePathname` / `useSearchParams` / `useLinkStatus`，这四个都**只能在客户端组件里用**。

## 最小可运行示例

```tsx
// app/ui/nav-links.tsx
'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

export function NavLinks() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <nav>
      <Link className={pathname === '/' ? 'active' : ''} href="/">
        Home
      </Link>
      <Link className={pathname === '/blog' ? 'active' : ''} href={`/blog?${searchParams}`}>
        Blog
      </Link>
    </nav>
  )
}
```

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react'
import { NavLinks } from '@/app/ui/nav-links'

export default function Page() {
  return (
    <Suspense fallback={<p>…</p>}>
      <NavLinks />
    </Suspense>
  )
}
```

那个 `Suspense` 不是可选项。`useSearchParams` 在预渲染时会把**它往上最近的一层 Suspense 边界以内的客户端组件树**改为客户端渲染，生产构建下缺少边界会直接失败。

## prefetch 的默认行为与触发条件

`<Link>` 的 `prefetch` 默认值是 `"auto"`（等价于 `null`），含义是"看路由类型决定"：

| 路由类型 | 自动预取的行为 | 客户端缓存 TTL |
|---|---|---|
| 静态路由 | 预取**完整路由**（含数据） | 5 分钟（`staleTimes.static`） |
| 动态路由 + 有 `loading.tsx` | 预取**到最近的 loading 边界为止**（布局 + 骨架） | 默认关闭（`staleTimes.dynamic`） |
| 动态路由 + 无 `loading.tsx` | **不预取** | — |

触发时机有两类：

- **进入视口**（初次渲染或滚动进来）。这是主力路径。
- **hover**。如果此时预取的数据已经过期，Next.js 会重新预取一次。

预取有一个**调度队列**：视口内的链接 → 有用户意图的（hover / touch）→ 更新的替换更旧的 → 滚出视口的丢弃。这个队列是为了防止"一屏 200 个链接"同时打满网络。

**自动预取只在生产环境生效。** `next dev` 下没有预取，所以"本地感觉慢"不代表线上慢，反过来也不成立。

### 手动控制

把预取推迟到 hover，只预热用户大概率会点的链接：

```tsx
// app/ui/hover-prefetch-link.tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'

export function HoverPrefetchLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  const [active, setActive] = useState(false)

  return (
    <Link
      href={href}
      // false = 不预取；hover 后切成 null = 恢复默认（按路由类型预取）
      prefetch={active ? null : false}
      onMouseEnter={() => setActive(true)}
    >
      {children}
    </Link>
  )
}
```

`prefetch` 的三种取值：`"auto"` / `null`（默认，按路由类型）、`true`（静态和动态都预取完整路由）、`false`（进入视口和 hover 都永不预取）。

也可以主动预热视口外的路由：在客户端组件里 `const router = useRouter()`，然后 `router.prefetch('/pricing')`。它接受第二个参数 `{ onInvalidate }`——框架判断"预取数据已陈旧"时回调（每次预取最多一次），用它重新预热。

### 增量预取 / 部分预取

开启 `partialPrefetching`（依赖 Cache Components）后，预取模型从"整页 or 不预取"变成**每条路由一个 App Shell**：多个指向同一路由的链接共用同一个 shell，只发一次请求；未缓存的数据在导航后于 shell 的 `<Suspense>` 边界内流式补上。这属于另一个主题，本文不展开：

- [Adopting Partial Prefetching](https://nextjs.org/docs/app/guides/adopting-partial-prefetching)
- [Optimizing prefetching](https://nextjs.org/docs/app/guides/optimizing-prefetching)

## useRouter / usePathname / useSearchParams

三个都从 `next/navigation` 导入（**不是** `next/router`，那是 Pages Router 的），且都只在客户端组件可用。

```tsx
// app/ui/actions.tsx
'use client'

import { useRouter } from 'next/navigation'

export function Actions() {
  const router = useRouter()
  return (
    <>
      <button onClick={() => router.push('/dashboard')}>去 Dashboard</button>
      <button onClick={() => router.push('/dashboard', { scroll: false })}>就地切换</button>
      {/* 重新请求当前路由：重跑 Server Components，保留 useState 和滚动位置 */}
      <button onClick={() => router.refresh()}>刷新</button>
    </>
  )
}
```

`useRouter()` 的完整方法：

| 方法 | 签名 | 说明 |
|---|---|---|
| `push` | `(href, { scroll?, transitionTypes? })` | 客户端跳转，**压入**历史栈 |
| `replace` | `(href, { scroll?, transitionTypes? })` | 客户端跳转，**替换**当前历史条目 |
| `refresh` | `()` | 重新请求当前路由，清空该路由的客户端缓存，**不动服务端缓存** |
| `prefetch` | `(href, { onInvalidate? })` | 手动预取 |
| `back` / `forward` | `()` | 历史前进/后退 |
| `bfcacheId` | `string` | 当前段的不透明标识，可用于 `key`（见第 06 章） |

`refresh()` 只清**客户端缓存**。要让服务端缓存的数据失效，得用 `revalidatePath` / `revalidateTag`。

`usePathname()` 返回当前 URL 的路径字符串（不含 query）：

| URL | 返回值 |
|---|---|
| `/` | `'/'` |
| `/dashboard?v=2` | `'/dashboard'` |
| `/blog/hello-world` | `'/blog/hello-world'` |

`useSearchParams()` 返回**只读**的 `URLSearchParams` 实例，用 `get()` / `has()` / `getAll()` / `toString()` 读。要改 query 就把当前值合并后走 `router.push` 或 `<Link>`：

```tsx
// app/ui/sort.tsx
'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

export function Sort() {
  const pathname = usePathname()
  const params = new URLSearchParams(useSearchParams().toString())
  params.set('sort', 'desc')
  return <Link href={`${pathname}?${params.toString()}`}>按时间倒序</Link>
}
```

**选型判据**：需要用它**加载数据**（分页、数据库过滤）→ 用服务端 `page` 的 `searchParams` prop；只在客户端用（过滤一份已经拿到的列表）→ 用 `useSearchParams()`。布局拿不到 `searchParams`，因为布局跨导航不重新渲染。

## useLinkStatus 做 pending UI

`useLinkStatus` 从 `next/link` 导入，返回 `{ pending: boolean }`，用来给点击的链接加**行内**反馈。

```tsx
// app/ui/loading-indicator.tsx
'use client'

import { useLinkStatus } from 'next/link'

export default function LoadingIndicator() {
  const { pending } = useLinkStatus()
  return <span aria-hidden className={`link-hint ${pending ? 'is-pending' : ''}`} />
}
```

```tsx
// app/shop/layout.tsx
import Link from 'next/link'
import LoadingIndicator from './ui/loading-indicator'

export default function Layout({ children }: LayoutProps<'/shop'>) {
  return (
    <div>
      <Link href="/shop/electronics" prefetch={false}>
        Electronics <LoadingIndicator />
      </Link>
      {children}
    </div>
  )
}
```

使用限制（踩错就白写）：

- 必须放在 `<Link>` 的**后代组件**里，放外面拿不到链接的导航状态。
- 它最有用的场景是 `prefetch={false}`，或者目标路由是动态的且没有 `loading.js`。
- 如果路由**已经被预取**，pending 阶段会被跳过——`pending` 一直是 `false`。
- 连续快速点多个链接时，只有**最后一个**链接的 pending 状态会显示。
- Pages Router 下不支持，永远返回 `{ pending: false }`。
- 行内指示器容易引起布局抖动：用固定尺寸、始终渲染、只切换 opacity 的元素，别在 pending 时才插入节点。

官方给的防抖做法是"初始 100ms 延迟 + 初始 `opacity: 0`"，这样只有导航真的慢时才显示提示：

```css
/* app/globals.css */
.link-hint {
  display: inline-block;
  width: 0.6em;
  height: 0.6em;
  border-radius: 9999px;
  background: currentColor;
  opacity: 0;
  visibility: hidden; /* 占位但不显示 */
}
.link-hint.is-pending {
  visibility: visible;
  animation: fadeIn 200ms ease 100ms forwards; /* 100ms 延迟 = 快导航时不闪 */
}
```

先判断是否真的需要它：目标路由是静态且已预取 → pending 会被跳过；路由有 `loading.js` → 已经有路由级 fallback 了。`useLinkStatus` 是"发现某次跳转确实慢"之后的临时补丁，根因还是补预取或补 `loading.js`。

## View Transitions

React 19.2 引入的 `<ViewTransition>` 在 App Router 里**开箱可用，无需任何配置**——路由导航本身就是 React Transition，所以动画会自动激活。

```tsx
// app/photo/[id]/page.tsx
import { Suspense, ViewTransition } from 'react'

export default async function PhotoPage(props: PageProps<'/photo/[id]'>) {
  const { id } = await props.params

  return (
    <Suspense
      fallback={
        <ViewTransition exit="slide-down" default="none">
          <PhotoSkeleton />
        </ViewTransition>
      }
    >
      <ViewTransition enter="slide-up" default="none">
        <PhotoContent id={id} />
      </ViewTransition>
    </Suspense>
  )
}
```

**激活条件**：只有 `<Suspense>`、Transition（`useTransition`、导航）、`useDeferredValue` 会触发 `<ViewTransition>` 动画。普通 `setState` **不会**触发。

给导航加方向感，用 `transitionTypes`（`<Link>` 的该 prop 从 v16.2.0 起提供，`router.push` / `router.replace` 也支持）：

```tsx
// app/photo/[id]/page.tsx
import Link from 'next/link'
import { ViewTransition } from 'react'

export function BackLink() {
  return (
    <Link href="/" transitionTypes={['nav-back']}>
      ← 返回图库
    </Link>
  )
}

export function Content({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'none' }}
      exit={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'none' }}
      default="none"
    >
      {children}
    </ViewTransition>
  )
}
```

两个必须记住的约束：

- **包装器放在每个 `page.tsx` 里，不要放在 `layout.tsx`**。布局跨导航持续存在，`enter` / `exit` 在那里永远不会触发。
- 浏览器自带的**后退/前进按钮不带 transition type**，所以方向性滑动不会播放（共享元素 morph 仍然有效，因为那是靠 `name` 配对的）。

## 滚动行为

三件不同的事，别混在一起：

1. **客户端过渡默认会滚动到页面顶部。** 用 `scroll={false}`（`<Link>`）或 `router.push(href, { scroll: false })` 关掉。`<Link>` 的 `scroll` prop **默认是 `true`**。
2. **sticky / fixed 头部遮挡内容。** 框架在找滚动目标时会跳过 sticky/fixed 元素，所以标题被盖住。解法是 CSS，不是 JS——在滚动容器上写 `html { scroll-padding-top: 64px; }`（值等于头部高度）。

3. **平滑滚动不再被自动覆盖（16 的行为变更）。** 以前 Next.js 在每次 SPA 导航时会把 `scroll-behavior` 临时改成 `auto`、导航完再改回来，保证跳转是"瞬时置顶"而不是一路滑上去。这个操作在每次导航开始时都要做样式重算，代价不低。16 起**默认不再覆盖**你的 `scroll-behavior`。

   如果你确实想要旧行为（导航时抑制平滑滚动），显式声明：

   ```tsx
   // app/layout.tsx
   export default function RootLayout({ children }: LayoutProps<'/'>) {
     return (
       <html lang="zh-CN" data-scroll-behavior="smooth">
         <body>{children}</body>
       </html>
     )
   }
   ```

   不加这个属性、又在 CSS 里写了 `scroll-behavior: smooth`，开发时会出现 `missing-data-scroll-behavior` 提示。

   详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 17 条。

## 常见坑

- **现象**：生产构建报 `Missing Suspense boundary with useSearchParams`，本地 `next dev` 却一切正常。
  **原因**：`next dev` 按需渲染，`useSearchParams` 不会挂起；生产构建下静态页面里调用它必须被 Suspense 包住，否则无法完成预渲染。
  **解法**：把用到 `useSearchParams` 的客户端组件（或它的父组件）包进 `<Suspense>`，给一个稳定的 fallback。

- **现象**：本地开发感觉每次点击都很慢，怀疑预取没生效。
  **原因**：**自动预取只在生产环境运行**。
  **解法**：用 `next build && next start` 验证，不要在 `next dev` 下判断预取性能。

- **现象**：`usePathname()` / `useSearchParams()` 报 "You're importing a component that needs `usePathname`. This React Hook only works in a Client Component"。
  **原因**：这两个 hook 在服务端组件里被调用了。
  **解法**：在文件顶部加 `'use client'`，或把读 URL 的逻辑抽到一个小的客户端组件里，再让服务端组件引用它。

- **现象**：加了 `<ViewTransition enter="slide-up">` 但完全没有动画。
  **原因**：包装器放在了 `layout.tsx` 里。布局在导航间持续存在，`enter` / `exit` 不会触发；也可能是普通 `setState` 触发的变化——那本来就不激活动画。
  **解法**：把包装器移到 `page.tsx`；由状态驱动的动画改用 `useTransition` / `useDeferredValue` 包裹。

- **现象**：动画期间点击链接没反应。
  **原因**：过渡运行时 `::view-transition` 覆盖层会捕获指针事件。
  **解法**：`::view-transition { pointer-events: none; }`，并且别给用户会快速点击的元素命名（命名参与者在过渡期间仍会被命中测试跳过）。

- **现象**：给链接加了动画后，开了"减少动态效果"的用户反馈头晕。
  **原因**：方向性位移是动效敏感最主要的触发因素。
  **解法**：加媒体查询兜底：`@media (prefers-reduced-motion: reduce) { ::view-transition-old(*), ::view-transition-new(*), ::view-transition-group(*) { animation-duration: 0s !important; } }`

- **现象**：链接进视口就触发了埋点，用户其实没点。
  **原因**：页面/布局在预取时也会执行。带副作用的代码写在组件体里，预取就会跑一遍。
  **解法**：把副作用挪进 `useEffect`，或挪到由客户端组件触发的 Server Action 里。

## 旧写法 vs 新写法

| 场景 | 旧（13/14） | 新（16.3） |
|---|---|---|
| `useRouter` 导入来源 | `next/router`（App Router 下错误） | **`next/navigation`** |
| 取 pathname | `router.pathname` | **`usePathname()`** |
| 取 query | `router.query` | **`useSearchParams()`** 或 page 的 `searchParams` prop |
| 路由事件 | `router.events` | 组合 `usePathname` + `useSearchParams` |
| 导航方向动画 | 无 | **`transitionTypes`**（v16.2.0 起） |
| 平滑滚动覆盖 | 自动覆盖 `scroll-behavior` | **默认不覆盖**，需 `<html data-scroll-behavior="smooth">` |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 17、18 条。

## API 速查

| `<Link>` prop | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `href` | `string \| object` | 必填 | 目标路径，可带 `#hash` |
| `replace` | `boolean` | `false` | 替换历史条目而非新增 |
| `scroll` | `boolean` | `true` | `false` 时不滚动到页面顶部 |
| `prefetch` | `boolean \| "auto" \| null` | `"auto"` | 见上文预取表 |
| `onNavigate` | `(e) => void` | — | 仅客户端导航时触发，可 `e.preventDefault()` 取消 |
| `transitionTypes` | `string[]` | — | 传给 `React.addTransitionType`，供 `<ViewTransition>` 区分动画 |

| Hook | 导入自 | 返回 | 客户端组件限定 |
|---|---|---|---|
| `useRouter` | `next/navigation` | 路由对象 | 是 |
| `usePathname` | `next/navigation` | `string` | 是 |
| `useSearchParams` | `next/navigation` | 只读 `URLSearchParams` | 是 |
| `useLinkStatus` | `next/link` | `{ pending: boolean }` | 是（且必须在 `<Link>` 内） |

`onNavigate` 只在**同源的客户端导航**时触发：Ctrl/Cmd + 点击、外部 URL、带 `download` 的链接都只走 `onClick`，不触发 `onNavigate`。

## 延伸阅读

- [官方文档：Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating)
- [官方文档：`<Link>` 组件](https://nextjs.org/docs/app/api-reference/components/link)
- [官方文档：Prefetching](https://nextjs.org/docs/app/guides/prefetching)
- [官方文档：`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router)
- [官方文档：`usePathname`](https://nextjs.org/docs/app/api-reference/functions/use-pathname)
- [官方文档：`useSearchParams`](https://nextjs.org/docs/app/api-reference/functions/use-search-params)
- [官方文档：`useLinkStatus`](https://nextjs.org/docs/app/api-reference/functions/use-link-status)
- [官方文档：View transitions 指南](https://nextjs.org/docs/app/guides/view-transitions)
- [官方文档：Adopting Partial Prefetching](https://nextjs.org/docs/app/guides/adopting-partial-prefetching)
- [官方错误：missing-data-scroll-behavior](https://nextjs.org/docs/messages/missing-data-scroll-behavior)
- [官方错误：Missing Suspense boundary with useSearchParams](https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout)
- [React 文档：`<ViewTransition>`](https://react.dev/reference/react/ViewTransition)
