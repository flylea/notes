# 46 · Notes App F：国际化与主题

> **一句话结论**：locale 走**路由段**（`app/[lang]/`），用 `next/root-params` 免掉 prop drilling；深色模式的**无闪烁**只有两条路——**首屏前执行的内联脚本**（读 localStorage）或**服务端读 cookie 直接渲染 class**。用 `useEffect` 切换主题必然闪一下，因为 effect 在浏览器首次绘制之后才跑。

## 最小可运行示例

```
app/
├─ [lang]/
│  ├─ layout.tsx              # 根布局，<html lang> 从这里取
│  ├─ dictionaries.ts
│  ├─ dictionaries/
│  │  ├─ zh.json
│  │  └─ en.json
│  ├─ page.tsx
│  └─ notes/
│     └─ page.tsx
└─ proxy.ts
```

```json
// app/[lang]/dictionaries/zh.json
{
  "common": {
    "appName": "笔记",
    "signIn": "登录",
    "signOut": "退出",
    "theme": { "light": "浅色", "dark": "深色", "system": "跟随系统" }
  },
  "notes": {
    "listTitle": "全部笔记",
    "new": "新建",
    "empty": "还没有笔记",
    "deleteConfirm": "确定删除这条笔记？"
  }
}
```

```json
// app/[lang]/dictionaries/en.json
{
  "common": {
    "appName": "Notes",
    "signIn": "Sign in",
    "signOut": "Sign out",
    "theme": { "light": "Light", "dark": "Dark", "system": "System" }
  },
  "notes": {
    "listTitle": "All notes",
    "new": "New",
    "empty": "No notes yet",
    "deleteConfirm": "Delete this note?"
  }
}
```

```ts
// app/[lang]/dictionaries.ts
import { lang } from 'next/root-params'
import { notFound } from 'next/navigation'

const dictionaries = {
  zh: () => import('./dictionaries/zh.json').then((m) => m.default),
  en: () => import('./dictionaries/en.json').then((m) => m.default),
}

export type Locale = keyof typeof dictionaries

export const locales = Object.keys(dictionaries) as Locale[]
export const defaultLocale: Locale = 'zh'

export function hasLocale(value: string): value is Locale {
  return value in dictionaries
}

// 不需要 import 'server-only'：next/root-params 在客户端组件里 import 会在构建期直接失败
export async function getDictionary() {
  const locale = await lang()
  if (!hasLocale(locale)) notFound()
  return dictionaries[locale]()
}
```

```tsx
// app/[lang]/layout.tsx
import { notFound } from 'next/navigation'
import { getDictionary, hasLocale, locales } from './dictionaries'

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<'/[lang]'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary()

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        {/* 无闪烁主题：见下文 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme');var d=s==='dark'||(s!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <header>{dict.common.appName}</header>
        {children}
      </body>
    </html>
  )
}
```

```tsx
// app/[lang]/notes/page.tsx
import { getDictionary } from '../dictionaries'

export default async function NotesPage() {
  const dict = await getDictionary()

  return <h1>{dict.notes.listTitle}</h1>
}
```

注意 `NotesPage` **没有接收 `params`**。它需要的只是字典，而字典自己知道当前 locale。这就是 `next/root-params` 的价值：省掉了 `params` 从布局到页面到每个深层组件的透传。

## 为什么 locale 走路由段

三种 i18n 组织方式的对比：

| 方式 | URL | SEO | 缓存 | 复杂度 |
|---|---|---|---|---|
| **路由段** `/zh/notes` | 显式 | 每种语言独立索引 | 每种语言独立预渲染 | 低 |
| 子域名 `zh.example.com` | 显式 | 独立索引 | 独立 | 高（DNS、证书、cookie 跨域） |
| Cookie / Header | 隐式 | **差**，同一 URL 多份内容 | 无法静态化 | 中 |

**路由段赢在缓存**。`/zh/notes` 和 `/en/notes` 是两个不同的 URL，各自可以独立预渲染、独立进 CDN、独立失效。用 cookie 判断语言时，同一个 URL 对不同用户返回不同内容——要么放弃缓存，要么加上 `Vary: Cookie`（几乎等于放弃 CDN 命中率）。

`generateStaticParams` 返回所有 locale，构建期就把每种语言渲染好：

```ts
// app/[lang]/layout.tsx
export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}
```

**在 Cache Components 下这是硬要求**：根参数必须至少有一个值，否则构建失败。所以 `generateStaticParams` 不是可选的优化，是必需的声明。

## Proxy：把无 locale 的请求重定向过去

```ts
// proxy.ts
import { NextResponse, type NextRequest } from 'next/server'
import { match } from '@formatjs/intl-localematcher'
import Negotiator from 'negotiator'

const LOCALES = ['zh', 'en']
const DEFAULT_LOCALE = 'zh'

function getLocale(request: NextRequest): string {
  const headers = Object.fromEntries(request.headers.entries())
  const languages = new Negotiator({ headers }).languages()
  try {
    return match(languages, LOCALES, DEFAULT_LOCALE)
  } catch {
    // Negotiator 可能返回 '*' 之类的伪语言，match 会抛错
    return DEFAULT_LOCALE
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const hasLocale = LOCALES.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
  )
  if (hasLocale) return

  const locale = getLocale(request)
  request.nextUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`
  return NextResponse.redirect(request.nextUrl)
}

export const config = {
  matcher: [
    // 跳过 API、静态资源、带扩展名的文件
    '/((?!api|_next|.*\\..*).*)',
  ],
}
```

**这里 Proxy 用重定向而不是重写（rewrite）**，是有意的：

- **重定向**（`NextResponse.redirect`）：浏览器地址栏变成 `/zh/notes`。URL 显式携带语言，可以被分享、被搜索引擎索引、被 CDN 缓存。
- **重写**（`NextResponse.rewrite`）：地址栏还是 `/notes`，服务端内部渲染 `/zh/notes`。用户看不到语言，URL 也就无法区分语言——回到「一个 URL 多份内容」的老问题。

重定向的代价是**多一次往返**。只在首次访问（URL 里没有 locale）时发生，之后链接都带 locale，可以接受。

**Proxy 里只做 locale 判断，不查数据库。** 这个 matcher 会匹配几乎所有页面请求，包括 `Link` 的预取。见 [44 章](./44-notes-app-auth.md) 的同一条原则。

## 无闪烁深色模式

### 为什么 `useEffect` 必然闪

React 的渲染顺序是：

```
服务端渲染 HTML → 浏览器解析并首次绘制 → 下载 JS → hydration → 执行 useEffect
```

`useEffect` 在**首次绘制之后**才执行。如果主题类名（`<html class="dark">`）是在 effect 里加的，用户会看到：

1. 首屏按浅色绘制（SSR 输出里没有 `dark` 类）
2. 几毫秒到几百毫秒后，effect 加上 `dark` 类
3. 页面闪一下变成深色

这个闪烁在慢网络、低端设备上尤其明显。**问题的本质是「主题状态在客户端，但首屏渲染在服务端」**。解法必须让主题在**首次绘制之前**就确定。

### 方案 A：首屏前执行的内联脚本（localStorage）

把一段同步内联脚本放在 `<head>` 里。解析器执行它时，`<body>` 还没开始渲染，所以 `classList.toggle` 在首次绘制前就生效了。

```tsx
// app/[lang]/layout.tsx（片段）
<html lang={lang} suppressHydrationWarning>
  <head>
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var s=localStorage.getItem('theme');var d=s==='dark'||(s!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`,
      }}
    />
  </head>
  <body>{children}</body>
</html>
```

这段脚本必须满足四个条件：

| 条件 | 原因 |
|---|---|
| 放在 `<head>`，不是 `<body>` 末尾 | 保证在首次绘制前执行 |
| **同步**，不能有 `async` / `defer` | 异步脚本会被推迟到绘制之后 |
| 包在 `try/catch` 里 | 隐私模式下 `localStorage` 访问会抛异常，不能让整个页面白屏 |
| 用 `matchMedia` 兜底 | 用户选「跟随系统」时（localStorage 里没有值），要和系统偏好一致 |

**`suppressHydrationWarning` 是必需的**。服务端渲染出的 `<html>` 没有 `dark` 类，而脚本加上之后客户端 DOM 有——React 的 hydration 对比会认为不一致并报警告。这个属性只作用于**该元素自身的一层**，不会掩盖子树的真实问题，是官方为这类「客户端脚本有意修改根元素」场景提供的出口。

**为什么用 `classList.toggle` 而不是 `classList.add`**：脚本可能在客户端导航时被再次执行（取决于路由结构），`toggle` 带布尔第二参数是幂等的，`add` 也是——但 `toggle` 能同时处理「要变浅色」的情况（第二参数为 `false` 时移除类）。

### 方案 B：服务端读 cookie

如果主题存在 cookie 里，服务端渲染时就能知道该输出哪个 class——**连内联脚本都不需要**。

```tsx
// app/[lang]/layout.tsx（片段）
import { cookies } from 'next/headers'

export default async function RootLayout({
  children,
  params,
}: LayoutProps<'/[lang]'>) {
  const { lang } = await params
  const theme = (await cookies()).get('theme')?.value
  const isDark = theme === 'dark'

  return (
    <html lang={lang} className={isDark ? 'dark' : undefined}>
      <body>{children}</body>
    </html>
  )
}
```

代价和收益都要说清楚：

| | 方案 A（localStorage + 内联脚本） | 方案 B（cookie + 服务端渲染） |
|---|---|---|
| 首屏闪烁 | 无 | **无** |
| 是否需要内联脚本 | 是 | **否** |
| 是否需要 `suppressHydrationWarning` | 是 | 否 |
| 首屏 HTML 是否可 CDN 缓存 | **是**（与用户无关） | **否**（每个主题一份，且依赖 cookie） |
| 读取 `cookies()` 的后果 | 无 | **整页退化为请求期渲染** |
| 切换主题的延迟 | 立即（本地写入） | 需要一次服务端往返 |
| 「跟随系统」 | 天然支持 | 需要额外判断，且服务端拿不到系统偏好 |

**方案 B 的隐藏成本是它杀死了静态渲染**。读 `cookies()` 会让页面在请求期执行——这一页永远进不了静态外壳，CDN 也没法缓存。对于一个笔记应用（私人数据本来就不缓存）这可以接受；对于一个营销首页，这个代价太高。

**本项目的选择：方案 A**。它把主题这个纯客户端偏好留在客户端，首屏 HTML 对所有用户一致，静态外壳得以保留。代价是一段内联脚本和一个 `suppressHydrationWarning`——这两者都是可控的。

### 切换主题

```tsx
// components/theme-toggle.tsx
'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // 这里读 localStorage 而不是在渲染时读——服务端没有 localStorage。
    // mounted 保证首次渲染的输出和服务端一致，避免 hydration 不匹配
    const stored = localStorage.getItem('theme') as Theme | null
    setTheme(stored ?? 'system')
    setMounted(true)
  }, [])

  function apply(next: Theme) {
    setTheme(next)
    localStorage.setItem('theme', next)

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = next === 'dark' || (next === 'system' && prefersDark)
    document.documentElement.classList.toggle('dark', dark)
  }

  // 未挂载前渲染一个占位，避免按钮文字在 hydration 时跳变
  if (!mounted) return <div className="h-8 w-24" aria-hidden />

  return (
    <div className="flex gap-1">
      {(['light', 'dark', 'system'] as const).map((t) => (
        <button
          key={t}
          onClick={() => apply(t)}
          aria-pressed={theme === t}
          className="rounded px-2 py-1 text-xs aria-pressed:bg-slate-200"
        >
          {t}
        </button>
      ))}
    </div>
  )
}
```

`mounted` 那个标志不是仪式感。首次渲染（hydration 那一帧）必须和服务端输出**完全一致**，而服务端读不到 `localStorage`。跳过这一帧、在 effect 之后再渲染真实状态，是避免 hydration mismatch 的标准做法。

用 Tailwind 的话，`darkMode: 'class'` 配置让 `dark:` 前缀绑定到 `<html class="dark">` 上。Tailwind v4 里这个配置走 CSS 的 `@custom-variant`，不是 `tailwind.config.js`——见 [18 CSS 方案](../04-styling-assets/18-css-solutions.md)。

## 语言切换器

```tsx
// components/locale-switcher.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function LocaleSwitcher({ current }: { current: string }) {
  const pathname = usePathname()

  return (
    <nav className="flex gap-2 text-sm">
      {(['zh', 'en'] as const).map((locale) => {
        // 把路径第一段替换成目标 locale
        const segments = pathname.split('/')
        segments[1] = locale
        const href = segments.join('/') || `/${locale}`

        return (
          <Link
            key={locale}
            href={href}
            aria-current={locale === current ? 'true' : undefined}
            className="aria-[current]:font-semibold"
          >
            {locale}
          </Link>
        )
      })}
    </nav>
  )
}
```

这个组件必须是客户端组件，因为要用 `usePathname()`。但它很小——只是几个 `<Link>`，不会把字典拖进客户端 bundle。

**不要把整个布局变成客户端组件来做这件事**。布局变客户端意味着 `getDictionary()` 的结果要序列化过线，字典体积直接进 bundle。

## 字典组织：扁平还是嵌套

两种组织方式：

```json
// 按页面/功能分组的嵌套结构
{
  "notes": {
    "listTitle": "全部笔记",
    "empty": "还没有笔记"
  }
}
```

```json
// 扁平的 key
{
  "notes.listTitle": "全部笔记",
  "notes.empty": "还没有笔记"
}
```

**选嵌套。** 理由：

1. **类型可推导**。`dict.notes.listTitle` 的路径由 JSON 结构决定，TS 能逐层推导。扁平 key 需要字符串解析才能做类型检查。
2. **不会重复前缀**。扁平结构里每个 key 都要手写 `notes.`，改名时容易漏。
3. **字典本身可读**。嵌套结构打开就知道有哪些模块。

代价是**访问深层的写法更长**，以及嵌套 JSON 的 TS 类型在很深的层级上会变慢。三层以内完全没问题。

**字典文件的加载方式**用动态 `import()`：

```ts
// app/[lang]/dictionaries.ts
const dictionaries = {
  zh: () => import('./dictionaries/zh.json').then((m) => m.default),
  en: () => import('./dictionaries/en.json').then((m) => m.default),
}
```

这样打包器可以**为每种语言单独切一个 chunk**，不会把五种语言的字典全部塞进同一个包。虽然字典在服务端执行、不进客户端 bundle，但按需加载仍然能减少服务端的模块加载开销。

**校验字典完整性**：不同语言的 key 必须一致。用 Zod 校验一次：

```ts
// scripts/check-dictionaries.ts
import zh from '../app/[lang]/dictionaries/zh.json'
import en from '../app/[lang]/dictionaries/en.json'
import { z } from 'zod'

// 以中文为基准，用它的结构校验其他语言
function shape(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return typeof value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, shape(v)])
  )
}

const schema = z.record(z.string(), z.unknown())

if (JSON.stringify(shape(zh)) !== JSON.stringify(shape(en))) {
  console.error('字典结构不一致：zh 与 en 的 key 集合不同')
  process.exit(1)
}

console.log('字典结构一致')
```

把这段挂到 CI 里。漏翻译的 key 在运行时表现为 `undefined` 被渲染成空字符串——很难发现，但一个结构比对就能拦住。

## 常见坑

- **现象**：深色模式首屏会闪一下白（或黑）。
  **原因**：主题类名在 `useEffect` 里设置。effect 在首次绘制之后才执行。
  **解法**：把主题判断放进 `<head>` 里的**同步内联脚本**，或者在服务端读 cookie 直接渲染 class。见本章「无闪烁深色模式」。

- **现象**：控制台报 hydration 错误，说 `<html>` 的 `class` 不一致。
  **原因**：内联脚本在客户端给 `<html>` 加了 `dark` 类，而服务端输出没有。
  **解法**：给 `<html>` 加 `suppressHydrationWarning`。它只抑制该元素**自身一层**的警告，不会掩盖子树的真实问题。

- **现象**：内联脚本报 `SecurityError: The operation is insecure`，页面直接白屏。
  **原因**：Safari 隐私模式或某些浏览器设置下访问 `localStorage` 会抛异常。
  **解法**：整段脚本包在 `try/catch` 里。失败时退化为「跟随系统偏好」（`matchMedia` 不依赖 localStorage）。

- **现象**：加了 `app/[lang]/` 之后构建失败，提示根参数缺少 `generateStaticParams`。
  **原因**：Cache Components 下每个根参数**必须至少有一个值**，否则构建失败。
  **解法**：在根布局导出 `generateStaticParams`，返回所有 locale。

- **现象**：所有页面的 `lang` 属性都是默认值，切换语言后没变。
  **原因**：根布局里用了硬编码的 `lang="zh"`，或者 `params` 忘了 `await`。
  **解法**：`const { lang } = await params`，`params` 在 16 里是 Promise。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条。

- **现象**：`next/root-params` 在 Server Action 或 Route Handler 里调用报错。
  **原因**：根参数 getter 只能在**服务端组件和服务端工具函数**里用，不支持 Server Actions、Route Handlers 和客户端组件。
  **解法**：在 action 里需要 locale 时，把它作为参数显式传进来（从渲染它的组件里取）。Route Handler 支持计划在未来版本提供。

- **现象**：`Negotiator` + `match` 在 `Accept-Language` 缺失或异常时抛错。
  **原因**：`Negotiator` 可能返回 `'*'` 这类伪语言标签，`match` 无法匹配任何 locale 会抛异常。
  **解法**：把 `match` 包进 `try/catch`，失败时返回默认 locale。

- **现象**：多语言站点的首页 `/` 返回 404。
  **原因**：所有页面都放在 `app/[lang]/` 下，`app/` 根目录没有 `page.tsx`。
  **解法**：这是预期的——`proxy.ts` 会把 `/` 重定向到 `/zh`。确认 matcher 没有把根路径排除掉，以及 `matcher` 里的正则没有意外匹配到 `/`。

- **现象**：中文文案里有 `{}`、`%s` 之类的占位符，插值时报错或原样输出。
  **原因**：JSON 字典只是字符串，没有插值能力。
  **解法**：在应用层做插值——要么把文案拆成前后两段（`dict.notes.countPrefix` + 数字 + `dict.notes.countSuffix`），要么用支持 ICU MessageFormat 的库（`next-intl`、`@formatjs/intl-messageformat`）。中文和英文的语序不同，**不要用字符串拼接**，用完整句子 + 命名占位符。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| locale 传递 | 逐层透传 `params.lang` | **`next/root-params` 的 `lang()` getter** |
| 读取路由参数 | `params.lang`（同步） | `(await params).lang` |
| 根参数预渲染 | 可选优化 | **Cache Components 下必需** |
| 中间件 | `middleware.ts` | **`proxy.ts`** |
| 主题初始化 | `useEffect` 里设置（会闪） | **`<head>` 内联脚本** 或服务端读 cookie |
| 语言判断 | `Accept-Language` 直接解析 | `Negotiator` + `@formatjs/intl-localematcher` |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 1、7 条。

## API / 配置速查

| API | 签名 | 说明 |
|---|---|---|
| `lang()` | `() => Promise<string>` | 从 `next/root-params` 导入；导出名由目录名 `[lang]` 决定 |
| `hasLocale(value)` | `(v: string) => v is Locale` | 类型守卫，配合 `notFound()` 使用 |
| `generateStaticParams()` | `() => Promise<{ lang: string }[]>` | 根参数**必须**至少有一个值 |
| `Negotiator` | `new Negotiator({ headers }).languages()` | 解析 `Accept-Language` |
| `match(langs, locales, default)` | `(string[], string[], string) => string` | 来自 `@formatjs/intl-localematcher` |
| `suppressHydrationWarning` | JSX 属性 | 抑制该元素**自身一层**的 hydration 警告 |
| `document.documentElement.classList.toggle(cls, force)` | — | 内联脚本里设置主题，幂等 |
| `matchMedia('(prefers-color-scheme: dark)')` | `MediaQueryList` | 系统主题偏好，不依赖存储 |

| 无闪烁主题方案 | 内联脚本 | 首屏 HTML 可缓存 | 读 `cookies()` |
|---|---|---|---|
| A：localStorage + `<head>` 脚本 | 需要 | **是** | 否 |
| B：cookie + 服务端渲染 | 不需要 | 否（每主题一份） | **是，整页退化** |
| `useEffect` 里设置 | — | 是 | 否 | **会闪，不可用** |

| 组件 | 为什么必须是客户端组件 |
|---|---|
| `ThemeToggle` | 需要 `localStorage` / `matchMedia` / 事件处理器 |
| `LocaleSwitcher` | 需要 `usePathname()` |
| 布局 / 页面 | **不应**是客户端组件，否则字典要过线 |

## 延伸阅读

- [官方文档：Internationalization](https://nextjs.org/docs/app/guides/internationalization)
- [官方文档：`next/root-params`](https://nextjs.org/docs/app/api-reference/functions/next-root-params)
- [官方文档：`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)
- [官方文档：Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [官方示例：i18n routing](https://github.com/vercel/next.js/tree/canary/examples/i18n-routing)
- [next-intl 官方文档](https://next-intl.dev)
- [Tailwind CSS：Dark mode](https://tailwindcss.com/docs/dark-mode)
- [MDN：`prefers-color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
- [MDN：`suppressHydrationWarning`](https://react.dev/reference/react-dom/components/common#suppressing-unavoidable-hydration-mismatch-errors)
