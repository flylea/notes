# 06 · 布局与模板

> **一句话结论**：选 `layout` 还是 `template`，只看一件事——**这段 UI 跨导航时要不要保留状态**。`layout` 不重新渲染，`useState`、DOM、滚动位置全都留住；`template` 在**自己那一层段变化时拿到一个新 key，整棵子树重新挂载**，状态清空、`useEffect` 重跑、DOM 重建。需要"每次进来都是干净的"，用 `template`；其余情况一律 `layout`。

## 最小可运行示例

```tsx
// app/layout.tsx —— 根布局，必须含 <html> 和 <body>
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-CN">
      <body>
        <header>站点头部</header>
        {children}
      </body>
    </html>
  )
}
```

```tsx
// app/blog/layout.tsx —— 嵌套布局，只包住 /blog 及其子路由
export default function BlogLayout({ children }: LayoutProps<'/blog'>) {
  return (
    <section>
      <nav>博客导航</nav>
      {children}
    </section>
  )
}
```

```tsx
// app/blog/template.tsx —— 每次进入 /blog 下的新段都重新挂载
export default function BlogTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-in">{children}</div>
}
```

```tsx
// app/blog/[slug]/page.tsx
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  return <article>{slug}</article>
}
```

嵌套关系是：`RootLayout` → `BlogLayout` → `BlogTemplate` → `Page`。父布局通过 `children` 包住子布局。

## 嵌套布局：父包子的三种写法

**方式一：目录嵌套**（最常见）。`app/blog/layout.tsx` 自动包住 `app/blog/**` 下的所有页面。

**方式二：路由组造出并列的多个布局**。同一层级可以放多个 `layout.tsx`，各自管一批路由：

```
app/(shop)/layout.tsx        → 包住 /cart、/products
app/(marketing)/layout.tsx   → 包住 /、/about
```

**方式三：多个根布局**。任何**上面没有 `layout.js`** 的布局就是根布局。用路由组或直接省略顶层 `app/layout.js` 都能造出来：

```
app/(shop)/layout.tsx        → /cart 的根布局，自带 <html>
app/(marketing)/layout.tsx   → /about 的根布局，自带 <html>
```

跨根布局导航会**整页加载**——因为两个 `<html>` 文档之间没法做客户端过渡。这是选型时最容易被忽略的代价。

根布局的两条硬规则：

- 必须定义 `<html>` 和 `<body>`。
- **不要手动加 `<title>`、`<meta>` 等 `<head>` 标签**，用 Metadata API（它会处理流式传输和 `<head>` 去重）。

根布局还可以放在动态段下面，做国际化：

```
app/[lang]/layout.tsx        # /zh、/en 各自一个根布局
```

在根布局**之前**的动态段叫**根参数（root parameters）**，可以在任意服务端组件里通过 `next/root-params` 读到。

## `layout` vs `template`：为什么会有两个

`template` 的实现方式很朴素——**给它一个每次段变化都变的 key**：

```
<Layout>
  {/* template 拿到一个唯一 key */}
  <Template key={routeParam}>{children}</Template>
</Layout>
```

React 的 key 一换，整棵子树就当新组件处理：`useState` 归零、`useEffect` 清理后重跑、DOM 节点全部重建。这就是两者全部差异的来源。

| | `layout` | `template` |
|---|---|---|
| key | 稳定 | 每次该段（含动态参数）变化就换 |
| 导航时是否重新渲染 | **否**，客户端缓存复用 | **是**，重新挂载 |
| 客户端组件状态 | 保留 | **重置** |
| `useEffect` | 不重跑 | 重跑（先清理再执行） |
| DOM | 复用 | **重建** |
| 包裹范围 | `template` / `error` / `loading` / `not-found` / `page` | `error` / `loading` / `not-found` / `page`（**不包**同段的 `layout`） |

精确的重挂载规则（容易记错，值得单独记）：

- 只在**自己那一层的段**变化时重挂载。`/blog` → `/blog/first-post` 会让 `app/blog/template.tsx` 重挂载，但 `app/template.tsx`（根级）不动。
- **search params 变化不触发重挂载**。`?sort=asc` → `?sort=desc` 只换查询串，段没变。
- 深层段导航不会让高层的 template 重挂载。

`template` 的三个适用场景：

- **需要让 `useEffect` 在每次导航时重新同步**（比如上报页面浏览、重建订阅）。
- **需要清空子客户端组件的状态**（比如一个不该记住上次输入的搜索框）。
- **改变框架的默认行为**。最典型的是 Suspense 边界：`layout` 里的 Suspense 边界只在首次加载时显示 fallback，`template` 里的则**每次导航都会显示**。

**为什么默认是 `layout` 而不是 `template`**：客户端过渡的价值就在于"只换该换的部分"。如果每层都重挂载，导航就退化成了整页刷新——状态全丢、DOM 全重建、滚动位置重置。所以框架选了 `layout` 作默认，把"要重置"这种少数需求交给显式的 `template`。

## 在布局中读取 `params`

`params` 是 Promise，布局可以 `async`：

```tsx
// app/dashboard/[team]/layout.tsx
export default async function Layout(props: LayoutProps<'/dashboard/[team]'>) {
  const { team } = await props.params

  return (
    <section>
      <h1>Welcome to {team}'s Dashboard</h1>
      <main>{props.children}</main>
    </section>
  )
}
```

客户端组件不能 `async`，用 `use()`：

```tsx
// app/dashboard/[team]/team-badge.tsx
'use client'

import { use } from 'react'

export default function TeamBadge({ params }: { params: Promise<{ team: string }> }) {
  const { team } = use(params)
  return <span>{team}</span>
}
```

`LayoutProps<'/dashboard'>` 是全局助手类型，会把 `children`、`params`、以及命名槽位（`app/dashboard/@analytics` → `props.analytics`）一并推出来。类型由 `next dev` / `next build` / `next typegen` 生成，无需 import。

**布局拿不到的东西**（都是"不重新渲染"的直接后果）：

| 想要的东西 | 布局里能拿到吗 | 替代方案 |
|---|---|---|
| `searchParams` prop | **不能** | `page` 的 `searchParams`，或客户端组件里的 `useSearchParams()` |
| 当前 pathname | **不能** | 客户端组件里的 `usePathname()` |
| 向 `children` 传数据 | **不能** | 各自取数 + `fetch` 自动去重，或用 React `cache` |
| 子段的信息 | 不能 | `useSelectedLayoutSegment(s)` |

## 布局去重与增量预取

**布局在客户端是被缓存的。** 导航时框架不会重新向服务端请求布局，它复用了缓存里的结果。这既是性能优势，也是上面那些限制的根因——框架通过"限制布局访问请求对象"来防止有人在布局里跑慢代码，把每一次导航都拖慢。

`layout` 不能给 `children` 传数据，但这不意味着要重复取数——假设 `@/app/lib/data` 里有个 `getUser(id)`：

```tsx
// app/dashboard/layout.tsx
import { getUser } from '@/app/lib/data'
import { UserName } from '@/app/ui/user-name'

export default async function Layout({ children }: LayoutProps<'/dashboard'>) {
  const user = await getUser('1')
  return (
    <>
      <nav>
        <UserName name={user.name} />
      </nav>
      {children}
    </>
  )
}
```

```tsx
// app/dashboard/page.tsx
import { getUser } from '@/app/lib/data'
import { UserName } from '@/app/ui/user-name'

export default async function Page() {
  const user = await getUser('1') // 同一次渲染里，这个 fetch 会被去重
  return <h1>Welcome {user.name}</h1>
}
```

Next.js 的 `fetch` 在**同一次渲染内自动去重**；非 `fetch` 的数据源用 React 的 `cache` 包一层。这样布局和页面各写各的，不会有额外网络开销。

**增量预取**的角度看：客户端缓存**按路由段为 key**。从 `/dashboard/settings` 跳到 `/dashboard/analytics` 时，父布局 `/dashboard` 直接复用，只有叶子页面需要重新获取。这就是"布局不重新渲染"带来的实际收益——布局越大越深，省得越多。详细机制见 [`03-linking-and-navigation.md`](./03-linking-and-navigation.md)。

## 用 `<Activity>` 保持 UI 状态

开启 `cacheComponents` 后，Next.js 在**路由级别自动使用** React 的 `<Activity>`：导航时不再卸载页面，而是用 `display: none` 把它藏起来。因为 DOM 节点还在文档里，所以 **React 状态和 DOM 状态都被保留**：

- 表单输入到一半的草稿
- 滚动位置
- 展开的 `<details>` 元素
- 视频播放进度

保留上限是 **3 条路由**，超出后最旧的一条被驱逐，下次进入是全新状态。

在 Cache Components 之前，想在页面之间保持状态得把 state 提升到共享布局，或引入外部 store；现在框架直接做了。

**代价是"什么都保留"**，所以有些状态需要主动重置。用 `useLayoutEffect` 的清理函数——组件被隐藏时它会同步执行：

```tsx
// app/ui/settings-dropdown.tsx
'use client'

import { useState, useLayoutEffect } from 'react'

export function SettingsDropdown() {
  const [isOpen, setIsOpen] = useState(false)

  useLayoutEffect(() => {
    return () => setIsOpen(false) // 被隐藏时收起
  }, [])

  return (
    <div>
      <button onClick={() => setIsOpen((o) => !o)}>选项</button>
      {isOpen && <ul>{/* … */}</ul>}
    </div>
  )
}
```

判断标准是"这是不是用户主动设置的视图状态"：

| 状态 | 处理 |
|---|---|
| 侧边栏展开的分区、FAQ 手风琴、筛选面板 | **保留**（用户主动设的视图） |
| 点击才出现的下拉菜单、弹出框 | **重置**（瞬态交互） |
| 搜索框草稿、未提交的表单 | **保留**（这是最大的体验收益） |
| 提交成功后的提示消息 | **重置**（换上下文后是陈旧信息） |

重置表单的另一种写法是用 callback ref：

```tsx
// app/ui/contact-form.tsx
export function ContactForm() {
  return (
    <form
      ref={(form) => {
        // 组件被隐藏时执行清理
        return () => form?.reset()
      }}
    >
      <input name="email" />
      <button type="submit">发送</button>
    </form>
  )
}
```

另一个坑是**跨用户的状态泄漏**：Activity 保留本地状态，包括在用户切换之后。用户 A 写的草稿不该让用户 B 看到。退出登录用 `window.location.href` 触发整页重载，或按用户 ID 重置：

```tsx
// app/ui/user-scoped-form.tsx
'use client'

import { useState, useEffect, useRef } from 'react'

export function UserScopedForm({ userId }: { userId: string | null }) {
  const [draft, setDraft] = useState('')
  const lastUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastUserIdRef.current !== null && lastUserIdRef.current !== userId) {
      setDraft('') // 用户变了，清空草稿
    }
    lastUserIdRef.current = userId
  }, [userId])

  return <textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
}
```

**`bfcacheId` 是最后的兜底手段。** `useRouter().bfcacheId` 是一个跟着段走的标识：push / replace 导航时它变，浏览器前进/后退、`router.refresh()`、只改查询串时它不变。所以把它当 `key` 用，就能实现"新导航重置、后退恢复"：

```tsx
// app/example/page.tsx
'use client'

import { useRouter } from 'next/navigation'

export default function Page() {
  const { bfcacheId } = useRouter()
  return <form key={bfcacheId}>{/* … */}</form>
}
```

官方明确说这是**迁移工具**：新代码优先在事件处理器里显式重置（比如 `onSubmit`），或从数据里派生 key（比如服务端给的草稿 id）。

## 常见坑

- **现象**：`app/dashboard/layout.tsx` 里访问 `searchParams`，永远是 `undefined`。
  **原因**：布局跨导航不重新渲染，拿到 `searchParams` 必然过期，所以框架**不提供**这个 prop。
  **解法**：在 `page.tsx` 里读 `searchParams` 往下传，或在客户端组件里用 `useSearchParams()`。

- **现象**：搜索框的输入在切换标签页后还留着，但产品要求"每次进来都是空的"。
  **原因**：`layout` 保状态——这正是它的默认行为。
  **解法**：把这部分 UI 挪进 `template.tsx`，它会重新挂载；或用 `key` 手动重置。

- **现象**：在 `app/template.tsx`（根级）加了个入场动画，结果每次点任何链接整个页面都重建，明显变卡。
  **原因**：`template` 的 key 一换就重挂载整棵子树。放在根级等于给每次导航都加一次全树重建。
  **解法**：把 `template` 下移到真正需要重置的那一层段，别放在根。

- **现象**：布局里 `await cookies()`，导航时骨架屏一直不出现。
  **原因**：`loading.tsx` 在组件层级中位于 `layout.js` **之下**，它给不了布局本身的 fallback。未开 Cache Components 时导航会一直阻塞到布局渲染完。
  **解法**：把布局里的运行时数据访问包进它自己的 `<Suspense>`，或把未缓存的数据获取从 `layout.js` 挪到 `page.js`。

  ```tsx
  // app/dashboard/layout.tsx
  import { Suspense } from 'react'
  import { NavSkeleton } from './nav-skeleton'
  import { DashboardNav } from './dashboard-nav'

  export default function Layout({ children }: LayoutProps<'/dashboard'>) {
    return (
      <>
        <Suspense fallback={<NavSkeleton />}>
          <DashboardNav />
        </Suspense>
        <main>{children}</main>
      </>
    )
  }
  ```

  开启 Cache Components 后，`loading.js` 只是普通 Suspense 边界，布局里的未缓存访问**必须**显式包 Suspense，否则构建期直接报错引导你修。

- **现象**：想在布局里把 `user` 传给 `children`，发现没有通道。
  **原因**：`children` 是已经渲染好的 React 节点，不是可以注参的函数。
  **解法**：各自取数，靠 `fetch` 自动去重或 React `cache` 消除重复开销。

- **现象**：在根布局里手写了 `<title>` 和 `<meta>`，和 Metadata API 的输出打架。
  **原因**：Metadata API 会自己管理 `<head>` 并做去重，手写会冲突。
  **解法**：删掉手写的标签，用 `export const metadata` 或 `generateMetadata`。

- **现象**：加了 Cache Components 后，用户切换账号还能看到上一个人的表单草稿。
  **原因**：`<Activity>` 保留本地组件状态，props 变了也不会重置已有的 `useState`。
  **解法**：退出登录用 `window.location.href` 整页重载；或在用户 ID 变化时显式清空；或直接 `<Form key={userId} />`。

## 旧写法 vs 新写法

| 场景 | 旧（13/14） | 新（16.3） |
|---|---|---|
| 布局读 `params` | `params.team` 同步访问 | **`await params`** |
| 布局 props 类型 | 手写 `{ children, params: { team: string } }` | **`LayoutProps<'/dashboard/[team]'>`** |
| 跨导航保持页面状态 | 提升 state 到布局 / 外部 store | **Cache Components + `<Activity>` 自动保持** |
| 页面级重置状态 | 手动 `key` 或 `useEffect` | 优先在事件处理器里重置，`bfcacheId` 兜底 |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 3、7、18 条。

## API / 配置速查

| | `layout.tsx` | `template.tsx` |
|---|---|---|
| Props | `children`、`params`(Promise)、命名槽位 | `children` |
| 类型助手 | `LayoutProps<'/route'>` | 无 |
| 导航时重新渲染 | 否 | 是（本层段变化时） |
| 状态 / DOM | 保留 | 重建 |
| 是否可 `async` | 是 | 是（默认服务端组件） |
| 包裹同段 `layout` | — | **不包裹** |
| 根布局要求 | 必须含 `<html>`、`<body>` | 无此约束 |

| 能力 | 位置 | 说明 |
|---|---|---|
| 布局客户端缓存 | 框架内建 | 导航时复用，不重新请求 |
| `fetch` 去重 | 同一次渲染内 | 布局与页面重复请求同一 URL 只发一次 |
| React `cache` | 非 `fetch` 数据源 | 手动包裹实现去重 |
| `<Activity>` | Cache Components 开启后自动 | 路由级保留状态，上限 3 条路由 |
| `bfcacheId` | `useRouter()` | push/replace 时变，back/forward 时不变 |

## 延伸阅读

- [官方文档：Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages)
- [官方文档：layout.js](https://nextjs.org/docs/app/api-reference/file-conventions/layout)
- [官方文档：template.js](https://nextjs.org/docs/app/api-reference/file-conventions/template)
- [官方文档：loading.js](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
- [官方文档：Route Groups（多个根布局）](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups)
- [官方文档：Preserving UI state](https://nextjs.org/docs/app/guides/preserving-ui-state)
- [官方文档：`useRouter`（bfcacheId）](https://nextjs.org/docs/app/api-reference/functions/use-router)
- [React 文档：`<Activity>`](https://react.dev/reference/react/Activity)
- [React 文档：`cache`](https://react.dev/reference/react/cache)
