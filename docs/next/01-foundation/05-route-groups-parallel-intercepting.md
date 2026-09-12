# 05 · 路由组 / 平行 / 拦截路由

> **一句话结论**：`(group)` 只影响布局嵌套、不进 URL；`@slot` 让同一个布局同时渲染多个互不干扰的子页面，每个槽位有独立的 `loading.tsx` / `error.tsx`，而且 **16 起每个槽位必须显式提供 `default.js`，否则构建失败**；`(.)` / `(..)` / `(...)` 拦截路由负责"URL 变了、但渲染在上一层"，和 `@slot` 组合就是可分享链接的模态框。

## 最小可运行示例：可分享链接的登录模态框

这套组合解决的是四个具体问题：模态框内容**能通过 URL 分享**、刷新页面**不丢失上下文**、浏览器后退**关闭模态框**而不是跳走、前进**重新打开**。

目录结构：

```
app/
├─ layout.tsx                     # 渲染 @auth 槽位
├─ login/page.tsx                 # /login 完整页面（直接访问时）
├─ @auth/
│  ├─ default.tsx                 # 槽位无匹配时渲染 null
│  ├─ (.)login/page.tsx           # 拦截 /login，渲染成模态框
│  └─ [...catchAll]/page.tsx      # 其它路由下把模态框关掉
└─ ui/
   ├─ login.tsx                   # 纯服务端组件，无 'use client'
   └─ modal.tsx                   # 模态框外壳，客户端组件
```

```tsx
// app/login/page.tsx
import { Login } from '@/app/ui/login'

export default function Page() {
  return <Login />
}
```

```tsx
// app/@auth/default.tsx
export default function Default() {
  return null
}
```

```tsx
// app/@auth/(.)login/page.tsx
import { Modal } from '@/app/ui/modal'
import { Login } from '@/app/ui/login'

export default function Page() {
  return (
    <Modal>
      <Login />
    </Modal>
  )
}
```

```tsx
// app/@auth/[...catchAll]/page.tsx
export default function CatchAll() {
  return null
}
```

```tsx
// app/layout.tsx
import Link from 'next/link'

export default function RootLayout({
  auth,
  children,
}: {
  auth: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <nav>
          <Link href="/login">打开登录框</Link>
        </nav>
        <div>{auth}</div>
        <div>{children}</div>
      </body>
    </html>
  )
}
```

```tsx
// app/ui/modal.tsx
'use client'

import { useRouter } from 'next/navigation'

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  return (
    <div role="dialog" aria-modal="true">
      <button onClick={() => router.back()}>关闭</button>
      <div>{children}</div>
    </div>
  )
}
```

`app/ui/login.tsx` 导出 `<Login />`（一个普通服务端组件）。把 `<Modal>` 外壳和模态框内容分开，是为了让**内容本身保持服务端组件**——表单、数据获取都不用为了放进模态框而降级成客户端组件。

行为分两条路径：

- **客户端导航**（点 `<Link href="/login">`）：URL 变成 `/login`，但渲染的是 `@auth` 槽位里的拦截版本 → 模态框浮在当前页面上。
- **硬导航**（刷新页面、或直接粘贴 `/login`）：拦截不生效，走 `app/login/page.tsx` 的完整页面。

这就是拦截路由的设计目的——**同一个 URL，两条渲染路径**。

## 路由组 `(group)`

把文件夹名包在括号里，它就**不进入 URL**。

| 路径 | URL |
|---|---|
| `app/(marketing)/page.tsx` | `/` |
| `app/(shop)/cart/page.tsx` | `/cart` |
| `app/blog/_components/Post.tsx` | 不产生路由 |

三类典型用途：**按团队/业务线组织路由**（`(marketing)`、`(shop)`、`(admin)` 各管一摊）、**定义多个根布局**（`app/(shop)/layout.tsx` 与 `app/(marketing)/layout.tsx` 各自是根布局，互不嵌套）、**让一部分路由共享布局而另一部分不共享**（组内放一个 `layout.tsx`，组外不受影响）。

三条硬约束：

- **不同组里的路由不能解析到同一个 URL。** `(marketing)/about/page.js` 和 `(shop)/about/page.js` 都是 `/about`，直接报错。
- **跨根布局导航会触发整页加载。** 从 `app/(shop)/layout.tsx` 下的 `/cart` 跳到 `app/(marketing)/layout.tsx` 下的 `/blog`，是完整的浏览器导航，不是客户端过渡。**这条只对"多个根布局"成立**，普通路由组之间没这个问题。
- **用了多个根布局又没有顶层 `layout.js` 时，首页必须落在某个组里**，比如 `app/(marketing)/page.tsx`。

**和私有文件夹 `_folder` 的区别**：`_folder` 是"完全排除出路由"，`(group)` 是"参与路由但不出现在 URL 里"。前者用来放实现细节，后者用来重组路由结构。详见 [`02-file-conventions.md`](./02-file-conventions.md)。

## 平行路由 `@slot`

`@folder` 定义一个**具名槽位**，它作为 prop 传给共享的父布局。

```
app/dashboard/
├─ layout.tsx
├─ @team/{loading,error,page}.tsx
├─ @analytics/{loading,error,page}.tsx
└─ page.tsx
```

```tsx
// app/dashboard/layout.tsx
export default function Layout({
  children,
  team,
  analytics,
}: {
  children: React.ReactNode
  team: React.ReactNode
  analytics: React.ReactNode
}) {
  return (
    <div className="grid">
      <div>{children}</div>
      <aside>{team}</aside>
      <aside>{analytics}</aside>
    </div>
  )
}
```

关键性质：

- **槽位不是路由段，不影响 URL。** `app/dashboard/@analytics/views/page.tsx` 对应的 URL 是 `/dashboard/views`，`@analytics` 不出现在路径里。
- **`children` 是一个隐式槽位**，不需要建文件夹。`app/dashboard/page.js` 等价于 `app/dashboard/@children/page.js`。
- **同一层级不能混用静态和动态槽位。** 槽位与 `page` 共同构成该段的最终页面，所以**如果一个槽位是动态渲染的，同层所有槽位都必须是动态的**。

### 每个槽位独立的 loading / error

槽位可以独立流式渲染，所以 `loading.tsx` 和 `error.tsx` 是**按槽位生效**的：

```tsx
// app/dashboard/@analytics/error.tsx
'use client'

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return <button onClick={() => retry()}>分析模块加载失败，重试</button>
}
```

同一个槽位目录下再放一个 `loading.tsx` 返回骨架屏即可。这让"侧边栏挂了但主内容还能看"成为可能——错误边界是隔离的，一个槽位抛错不会带走整页。

### `default.js` 是必需的

`default.js` 定义"**硬导航时该槽位渲染什么**"。

软导航（客户端跳转）时，Next.js 会记住每个槽位的活动状态：跳到 `/settings` 时 `@team` 渲染它的 `settings` 页，`@analytics` 保持当前页面不动。但**整页刷新后框架恢复不了这个状态**，此时未匹配的槽位就渲染 `default.js`。

```
app/dashboard/
├─ layout.tsx
├─ @team/settings/page.tsx
├─ @analytics/page.tsx
├─ @analytics/default.tsx        # 刷新 /settings 时渲染它
└─ page.tsx
```

**16 起这是硬约束**：具名槽位缺少 `default.js` 时，框架**直接报错并要求你补上**才能继续，构建会失败。

想恢复旧版的 404 行为，就让 `default.js` 调用 `notFound()`：

```tsx
// app/dashboard/@analytics/default.tsx
import { notFound } from 'next/navigation'

export default function Default() {
  notFound()
}
```

`children` 也是隐式槽位，同样需要 `default.js`（内容返回 `null` 即可）——**不给的话该路由会返回 404**。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 11 条。

### 读取槽位当前的活动段

`useSelectedLayoutSegment` / `useSelectedLayoutSegments` 接受一个 `parallelRouteKey`，用来读某个槽位内部的活动段：

```tsx
// app/dashboard/layout.tsx
'use client'

import { useSelectedLayoutSegment } from 'next/navigation'

export default function Layout({ analytics }: { analytics: React.ReactNode }) {
  // 访问 /dashboard/views 时（槽位内是 @analytics/views），segment === 'views'
  const segment = useSelectedLayoutSegment('analytics')
  return <>{analytics}</>
}
```

### 条件渲染不是权限控制

用平行路由按角色渲染不同界面很常见：

```tsx
// app/dashboard/layout.tsx
import { checkUserRole } from '@/lib/auth'

export default function Layout({ user, admin }: { user: React.ReactNode; admin: React.ReactNode }) {
  const role = checkUserRole()
  return role === 'admin' ? admin : user
}
```

**两个槽位都会在服务端渲染**，与布局最终返回哪一个无关。`@admin/page.tsx` 的数据请求对每个用户都会执行，输出也会进到发给浏览器的响应里。所以**鉴权必须写在槽位内部**（页面的数据层），不能靠布局"不渲染它"来挡。

## 拦截路由 `(.)` / `(..)` / `(...)`

拦截路由让你**在当前布局里渲染另一个路由的内容**，URL 照常更新。

| 约定 | 含义 |
|---|---|
| `(.)folder` | 拦截**同一层级**的段 |
| `(..)folder` | 拦截**上一层级**的段 |
| `(..)(..)folder` | 拦截**上两层**的段 |
| `(...)folder` | 从**根 `app` 目录**拦截 |

**层级按路由段计算，不按文件系统计算。** `@slot` 不是段，所以它**不计入层级**——这就是为什么拦截路由几乎总和平行路由一起出现。以本节的登录框为例：`@auth` 在根层级（它本身不是段），`app/login` 也是根层级的段，两者同级 → 用 `(.)`。

### 关闭模态框

两种关法，各有用途。`router.back()` 适合"打开动作本身就是一次导航"的场景：

```tsx
// app/ui/modal.tsx
'use client'

import { useRouter } from 'next/navigation'

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  return <button onClick={() => router.back()}>关闭</button>
}
```

但如果用户是**直接访问** `/login`（硬导航）进来的，后退会退出站点，此时应该用 `<Link href="/">`。

用 `<Link>` 关闭时有个陷阱：客户端导航到不再匹配该槽位的路由时，**槽位里原来的内容会继续显示**。所以要么给根路径写一个返回 `null` 的 `@auth/page.tsx`，要么（更省事）用 catch-all 兜住所有情况：

```tsx
// app/@auth/[...catchAll]/page.tsx
export default function CatchAll() {
  return null
}
```

### 拦截路由的边界

- **硬导航一定不拦截。** 刷新、直接输入 URL、从外部站点点进来，都会走真实路由。这是特性不是 bug——否则模态框内容就没有可分享的独立 URL 了。
- **拦截路由不能跨根布局。** 它依赖"当前布局"的存在，跳出去就无从谈起。
- `(..)` 往上数的单位是**段**，不是目录层数。数错一层，拦截就不生效（表现为直接跳到完整页面）。

## 与 `<Activity>` 配合保持 UI 状态

开启 Cache Components 后，Next.js 在路由级别自动使用 React 的 `<Activity>`：导航时不再卸载页面，而是把 DOM 用 `display: none` 隐藏，**React 状态和 DOM 状态都被保留**——表单草稿、滚动位置、展开的 `<details>`、视频播放进度。

对平行路由和模态框的意义是：用户在某个槽位里填了一半的表单，跳到别处再回来，输入还在。保留上限是 **3 条路由**，超出后最旧的会被驱逐并以全新状态重渲染。

有些状态需要主动重置（比如"点了才展开的下拉菜单"不该跨导航保持打开）。官方给的方案是用 `useLayoutEffect` 的清理函数，在组件被隐藏**之前**同步重置，避免旧状态闪一下：

```tsx
// app/ui/settings-dropdown.tsx
'use client'

import { useState, useLayoutEffect } from 'react'

export function SettingsDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  useLayoutEffect(() => {
    return () => setIsOpen(false) // 被隐藏时收起
  }, [])
  return <button onClick={() => setIsOpen((o) => !o)}>选项</button>
}
```

完整的状态保留策略（表单、对话框、用户切换、全局样式）见官方 Preserving UI state 指南（链接在延伸阅读）。

## 常见坑

- **现象**：加了 `@modal` 槽位后构建失败，提示需要 `default.js`。
  **原因**：16 起所有具名槽位必须显式提供 `default.js`，否则框架拒绝继续。
  **解法**：给每个 `@slot` 目录加一个 `default.js`。模态框类槽位返回 `null`；想保留旧版 404 行为就调用 `notFound()`。

- **现象**：刷新页面后返回 404，但客户端导航时一切正常。
  **原因**：缺的是 `children` 槽位的 `default.js`。`children` 是隐式槽位，不建 `@children` 文件夹，但同样需要 fallback。
  **解法**：在路由段目录下加 `default.tsx`，返回 `null` 或合适的内容。

- **现象**：给某个槽位加了 `cookies()` 之类的动态代码后，同层其它槽位报错。
  **原因**：槽位与 `page` 共同构成最终页面，**同层不能一个静态一个动态**——一个动态，全部动态。
  **解法**：要么把动态访问挪进 `<Suspense>` 边界并开启 Cache Components，要么让该层所有槽位统一动态。

- **现象**：`(marketing)/about/page.tsx` 和 `(shop)/about/page.tsx` 同时存在，构建报路径冲突。
  **原因**：路由组不出现在 URL 里，两个文件解析到同一个 `/about`。
  **解法**：改掉其中一个的路径（比如 `(shop)/shop/about/page.tsx`），或合并成一个页面。

- **现象**：用了多个根布局后，在两组之间跳转整个页面白屏重载。
  **原因**：跨根布局导航无法复用根布局，只能整页加载。
  **解法**：这是预期行为。如果只是想要不同的局部布局，用**嵌套**布局或普通路由组，别用多个根布局。

- **现象**：模态框从列表页打开正常，直接刷新 `/photo/123` 却渲染成了整页。
  **原因**：硬导航不触发拦截路由。
  **解法**：这正是设计目的——`app/photo/[id]/page.tsx` 本来就该是可分享的完整页面。要两个都好看，就把共用内容抽成组件，模态框壳子和整页壳子分别包一层。

- **现象**：用 `<Link href="/">` 关闭模态框，模态框纹丝不动。
  **原因**：客户端导航到不再匹配槽位的路由时，槽位原有内容会保留显示。
  **解法**：加 `@auth/[...catchAll]/page.tsx` 返回 `null`，或给具体路径写 `@auth/page.tsx` 返回 `null`。

- **现象**：用 `role === 'admin' ? admin : user` 做权限隔离，普通用户抓到了管理员数据。
  **原因**：两个槽位都在服务端渲染，被"不渲染"的那个槽位的数据请求照样执行、输出照样进响应体。
  **解法**：把鉴权写进每个槽位自己的页面/数据访问层，布局只决定"给用户看哪个"。

## 旧写法 vs 新写法

| 场景 | 旧（13/14） | 新（16.3） |
|---|---|---|
| 平行路由槽位的 `default.js` | 可省略，缺省时渲染 404 | **必须显式提供**，否则报错/构建失败 |
| 拦截路由的 `params` | 同步对象 | **Promise**，需 `await` |
| 跨导航保持 UI 状态 | 手动提升 state 或用外部 store | **Cache Components + `<Activity>` 自动保持** |
| 动态渲染开关 | `dynamic = 'force-dynamic'` | 优先 `connection()`；Cache Components 下段配置被移除 |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 3、7、11 条。

## API / 配置速查

| 约定 | 作用 | 是否进 URL |
|---|---|---|
| `_folder` | 私有文件夹，整体排除出路由 | 否，且不产生路由 |
| `(group)` | 路由组，组织路由结构 | 否 |
| `@slot` | 平行路由槽位 | 否 |
| `(.)folder` | 拦截同层级段 | 否（是被拦截的路由的 URL） |
| `(..)folder` | 拦截上一层级段 | 否 |
| `(..)(..)folder` | 拦截上两层级段 | 否 |
| `(...)folder` | 从根 `app` 拦截 | 否 |

| 槽位相关文件 | 作用 | 必需 |
|---|---|---|
| `@slot/page.tsx` | 槽位的默认页面 | 否 |
| `@slot/default.tsx` | 硬导航时的 fallback | **是（16 起）** |
| `@slot/loading.tsx` / `error.tsx` | 该槽位独立的加载 UI / 错误边界 | 否 |
| `@slot/layout.tsx` | 槽位内部的共享布局（做 Tab 用） | 否 |

`useSelectedLayoutSegment(parallelRouteKey?)` / `useSelectedLayoutSegments(parallelRouteKey?)` 用来读某个槽位内部的活动段。

## 延伸阅读

- [官方文档：Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups)
- [官方文档：Parallel Routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes)
- [官方文档：Intercepting Routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes)
- [官方文档：default.js](https://nextjs.org/docs/app/api-reference/file-conventions/default)
- [官方文档：Preserving UI state（`<Activity>`）](https://nextjs.org/docs/app/guides/preserving-ui-state)
- [官方文档：Authentication（Data Access Layer）](https://nextjs.org/docs/app/guides/authentication)
- [官方示例：nextgram（平行 + 拦截路由的相册）](https://github.com/vercel-labs/nextgram)
