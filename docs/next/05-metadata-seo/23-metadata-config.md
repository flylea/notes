# 23 · Metadata 配置式

> **一句话结论**：不依赖请求信息的元数据就用静态 `metadata` 对象，依赖路由参数或数据才用 `generateMetadata`——**两者不能在同一个路由段同时导出**。`title.template` 只对**子**路由段生效，不作用于定义它的那一段；`themeColor` / `colorScheme` / `viewport` 已从 `metadata` 移出，改用独立的 `viewport` 导出。

## 最小可运行示例

```tsx
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | Acme',
    default: 'Acme',
  },
  description: 'Acme 的产品站',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
```

```tsx
// app/about/page.tsx
import type { Metadata } from 'next'

// 继承根布局的 template，最终渲染 <title>关于 | Acme</title>
export const metadata: Metadata = {
  title: '关于',
}

export default function Page() {
  return <h1>关于</h1>
}
```

`metadata` 和 `generateMetadata` **只在服务端组件中支持**。在客户端组件里导出它们不会生效。

## 两个默认标签

即使某个路由完全没定义元数据，Next.js 也总会加上这两个：

```html
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

所以通常不需要手写 viewport 配置——除非你要改默认行为。

## 静态 `metadata`

```tsx
// app/blog/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '博客',
  description: '技术笔记与随笔',
  keywords: ['Next.js', 'React', 'TypeScript'],
  authors: [{ name: 'Acme Team', url: 'https://acme.com' }],
  creator: 'Acme',
  publisher: 'Acme',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <section>{children}</section>
}
```

静态对象的优势是**可以在构建期解析**，不会拖慢渲染。只要元数据不依赖请求信息，就应该用它。

## 动态 `generateMetadata`

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata, ResolvingMetadata } from 'next'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  // params 是 Promise，必须 await
  const { slug } = await params
  const post = await fetch(`https://api.example.com/blog/${slug}`).then((res) =>
    res.json()
  )

  return {
    title: post.title,
    description: post.description,
  }
}

export default async function Page({ params }: Props) {
  const { slug } = await params
  return <article>{slug}</article>
}
```

`params` 和 `searchParams` 在 16 里都是 **Promise**，必须 `await`。这是 16 影响面最广的变更，见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条。

另外 `searchParams` **只在 `page.tsx` 里可用**——`layout.tsx` 拿不到它，因为它不随路由段变化。

### 扩展父级元数据而不是替换

`parent` 参数让你读到父段已解析的元数据，用来做「追加」而不是「覆盖」：

```tsx
// app/blog/[slug]/page.tsx
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params
  const post = await fetch(`https://api.example.com/blog/${slug}`).then((res) =>
    res.json()
  )

  const previousImages = (await parent).openGraph?.images ?? []

  return {
    title: post.title,
    openGraph: {
      // 保留父级已有的图，把这篇的封面插到前面
      images: [post.cover, ...previousImages],
    },
  }
}
```

### 去重：用 `cache` 避免重复请求

`generateMetadata` 和页面经常需要同一份数据。默认情况下两个 `fetch` 会被自动 memoize（相同 URL 与选项），但如果用的是数据库查询或非 `fetch` 的客户端，就需要手动包一层：

```ts
// app/lib/data.ts
import { cache } from 'react'
import { db } from '@/app/lib/db'

// getPost 会被调用两次，但只执行一次
export const getPost = cache(async (slug: string) => {
  return db.query.posts.findFirst({ where: eq(posts.slug, slug) })
})
```

```tsx
// app/blog/[slug]/page.tsx
import { getPost } from '@/app/lib/data'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPost(slug)
  return { title: post.title, description: post.description }
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPost(slug)
  return <div>{post.title}</div>
}
```

### 流式元数据

动态渲染的页面，Next.js 会把元数据**单独流式传输**——`generateMetadata` 解析完成后注入 HTML，不阻塞 UI 渲染。这让可视内容先到达，感知性能更好。

但对**期待元数据在 `<head>` 里的爬虫**（Twitterbot、Slackbot、Bingbot 等），流式元数据会被**禁用**——框架通过 User-Agent 识别它们，改成阻塞式。

想完全关闭流式元数据，用 `next.config.ts` 的 `htmlLimitedBots`：

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  htmlLimitedBots: /.*/,
}

export default nextConfig
```

预渲染页面不走流式——元数据在构建期就解析好了。

## `title` 的三种形态与继承规则

这是元数据里最容易理解错的部分。

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  title: {
    template: '%s | Acme', // 给子段用
    default: 'Acme',       // 本级和未定义 title 的子段用
  },
}
```

| 形态 | 写法 | 作用 |
|---|---|---|
| 字符串 | `title: 'About'` | 本级标题；若父段有 `template`，会被套上 |
| `title.default` | `title: { default: 'Acme' }` | 为未定义 `title` 的**子**段提供回退标题 |
| `title.template` | `title: { template: '%s \| Acme' }` | 为**子**段的标题加前后缀 |
| `title.absolute` | `title: { absolute: 'About' }` | 忽略父段 `template`，直接用这个标题 |

### 四条硬规则

1. **`title.template` 只作用于子路由段，不作用于定义它的那一段。**
   在 `app/layout.tsx` 里定义的 template **不会**应用到同一段的 `app/page.tsx`。

2. **添加 `title.template` 时必须同时设 `title.default`**，否则子段的回退标题无处可来。

3. **在 `page.tsx` 里定义 `title.template` 没有任何效果**——页面是终止段，没有子段可以继承。

4. **如果某个路由既没有 `title` 也没有 `title.default`，`title.template` 不生效。**

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  title: { template: '%s | Acme', default: 'Acme' },
}
```

```tsx
// app/about/page.tsx
// → <title>关于 | Acme</title>
export const metadata: Metadata = { title: '关于' }
```

```tsx
// app/blog/page.tsx
// → <title>Acme</title>（没有自己的 title，取父段 default）
export const metadata: Metadata = {}
```

```tsx
// app/legal/page.tsx
// → <title>法律声明</title>（absolute 忽略 template）
export const metadata: Metadata = { title: { absolute: '法律声明' } }
```

## `metadataBase`：相对 URL 的基准

`openGraph.images`、`alternates.canonical` 这类字段需要**绝对 URL**。用 `metadataBase` 提供基准，就能在子段里写相对路径：

```tsx
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://acme.com'),
  alternates: {
    canonical: '/',
    languages: { 'zh-CN': '/zh-CN', 'en-US': '/en-US' },
  },
  openGraph: { images: '/og-image.png' },
}
```

**没有配 `metadataBase` 却用了相对路径，会导致构建错误。** 这是刻意的——相对 URL 在社交平台抓取时无法解析，早点报错好过线上才发现。

URL 组合的规则偏向「开发者意图」，而不是目录遍历语义：

| 字段值 | 解析结果 |
|---|---|
| `/` | `https://acme.com` |
| `./` | `https://acme.com` |
| `payments` | `https://acme.com/payments` |
| `/payments` | `https://acme.com/payments` |
| `../payments` | `https://acme.com/payments` |
| `https://beta.acme.com/payments` | 原样使用（`metadataBase` 被忽略） |

注意 `../payments` 和 `payments` 结果相同——`metadataBase` 只提供前缀，不做路径回溯。

> 开启 `use cache` 时，`metadata` 的返回值必须可序列化，`URL` 实例不被支持。此时用字符串：`url.toString()`。

## `viewport` 独立导出

`themeColor`、`colorScheme`、`viewport` 三个字段从 14 起从 `metadata` 移出，改用独立的 `viewport` 导出：

```tsx
// app/layout.tsx
import type { Viewport } from 'next'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'cyan' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
```

对应的动态版本 `generateViewport`：

```tsx
// app/layout.tsx
import { cookies } from 'next/headers'

export async function generateViewport() {
  const cookieJar = await cookies()
  return {
    themeColor: cookieJar.get('theme-color')?.value,
  }
}
```

**为什么单独拆出来**：viewport 影响**首屏渲染**，必须在 HTML 到达时就确定。元数据可以流式传输（后到也没关系），但 viewport 不行——浏览器需要它来决定初始缩放和主题色，晚到就会看到一次重排。所以两者在框架里走的是不同的通道。

同样地，`viewport` 对象和 `generateViewport` **不能在同一个路由段同时导出**。

> **注意**：`viewport` 不能像 metadata 那样流式传输。如果它依赖运行时数据（`cookies()`、`headers()`、`params`），页面就必须阻塞等待它解析完成。这会让路由变成完全动态。仅在确实需要时才这么做。

## 其他常用字段

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  // canonical + hreflang
  alternates: {
    canonical: 'https://acme.com/blog/post-1',
    languages: {
      'zh-CN': 'https://acme.com/zh-CN/blog/post-1',
      'en-US': 'https://acme.com/en-US/blog/post-1',
    },
    types: { 'application/rss+xml': 'https://acme.com/rss' },
  },

  // 社交分享
  openGraph: {
    title: '文章标题',
    description: '文章摘要',
    url: 'https://acme.com/blog/post-1',
    siteName: 'Acme',
    locale: 'zh_CN',
    type: 'article',
    publishedTime: '2026-09-12T00:00:00.000Z',
    authors: ['https://acme.com/authors/lee'],
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '封面' }],
  },

  twitter: {
    card: 'summary_large_image',
    title: '文章标题',
    description: '文章摘要',
    images: ['https://acme.com/og.png'],
  },

  // 分页
  pagination: { previous: '/blog?page=1', next: '/blog?page=3' },
}
```

`openGraph.type` 为 `'article'` 时才支持 `publishedTime`、`authors` 这类字段。

### 不能通过 metadata 设置的东西

| 想设置 | 该用什么 |
|---|---|
| `<meta http-equiv="...">` | HTTP 头（`redirect()`、Proxy、安全头配置） |
| `<base>` / `<noscript>` | 直接在 layout / page 里渲染 |
| `<style>` / `<link rel="stylesheet">` | 直接 import 样式 |
| `<script>` | `next/script` |
| `<link rel="preload">` | ReactDOM 的 `preload` |
| `<link rel="preconnect">` | ReactDOM 的 `preconnect` |
| `<link rel="dns-prefetch">` | ReactDOM 的 `prefetchDNS` |

资源提示需要在**客户端组件**里调用：

```tsx
// app/components/preload-resources.tsx
'use client'

import ReactDOM from 'react-dom'

export function PreloadResources() {
  ReactDOM.preload('/hero.avif', { as: 'image' })
  ReactDOM.preconnect('https://fonts.example.com', { crossOrigin: 'anonymous' })
  ReactDOM.prefetchDNS('https://api.example.com')
  return null
}
```

## 常见坑

- **现象**：子页面的 `<title>` 里没有父段定义的 template。
  **原因**：`title.template` 只作用于子段，且要求子段**自己有 `title`**；同时定义 template 的段必须同时有 `title.default`。
  **解法**：确认父段写了 `title: { template, default }`，子段写了 `title: '...'`。

- **现象**：在 `app/layout.tsx` 里定义了 template，首页标题却没被套上。
  **原因**：template 不作用于定义它的那一段。
  **解法**：给根段显式写 `title.default` 或 `title.absolute`。

- **现象**：`const { slug } = params` 拿到 Promise，`slug` 是 `undefined`。
  **原因**：16 里 `params` 是 Promise。
  **解法**：`const { slug } = await params`。见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条。

- **现象**：同一个路由段同时导出 `metadata` 和 `generateMetadata`，构建报错。
  **原因**：两者互斥。
  **解法**：只保留一个。能静态就用 `metadata`。

- **现象**：构建报错「metadataBase is not configured」，但本地开发正常。
  **原因**：用了相对 URL 的字段（如 `openGraph.images: '/og.png'`）但没配 `metadataBase`。
  **解法**：在根布局加 `metadataBase: new URL('https://your-domain.com')`。

- **现象**：把 `themeColor` 写在 `metadata` 里，编辑器报类型错误。
  **原因**：该字段从 14 起移出 `metadata`。
  **解法**：改用独立的 `viewport` 导出。

- **现象**：在 `layout.tsx` 的 `generateMetadata` 里读 `searchParams`，报错。
  **原因**：`searchParams` 只在 `page.tsx` 可用。
  **解法**：把需要 `searchParams` 的元数据逻辑移到页面级。

- **现象**：`generateMetadata` 和页面各查了一次数据库，日志里看到两次相同查询。
  **原因**：`fetch` 会被自动 memoize，但数据库查询不会。
  **解法**：把查询包在 React 的 `cache()` 里。

- **现象**：给 `viewport` 加了依赖 `cookies()` 的 `generateViewport` 后，整个路由变成动态渲染。
  **原因**：viewport 不能流式传输，必须阻塞解析。
  **解法**：尽量用静态 `viewport` 对象；确实需要动态时，用多根布局把动态部分隔离到特定路由。

- **现象**：`title` 里写了 `|` 之类的字符导致 template 拼接结果奇怪。
  **原因**：`%s` 是占位符，会被替换为子段标题。
  **解法**：确认 template 里确实有 `%s`；不需要拼接就用 `title.absolute`。

## 旧写法 vs 新写法

| 场景 | 旧 | 新（16.3） |
|---|---|---|
| 路由参数 | `params.slug` | **`(await params).slug`** |
| 查询参数 | `searchParams.q` | **`(await searchParams).q`** |
| 主题色 / 配色方案 | `metadata.themeColor` | **独立的 `viewport` 导出** |
| viewport | `metadata.viewport` | **独立的 `viewport` 导出** |
| 类型标注 | 手写泛型 | 可用 `PageProps<'/blog/[slug]'>` 等生成类型 |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条。

## API / 配置速查

| 导出 | 类型 | 位置 | 说明 |
|---|---|---|---|
| `metadata` | `Metadata` | 静态 layout / page | 静态元数据 |
| `generateMetadata` | `(props, parent) => Promise<Metadata>` | layout / page | 动态元数据 |
| `viewport` | `Viewport` | 静态 layout / page | 静态 viewport |
| `generateViewport` | `(props) => Viewport` | layout / page | 动态 viewport |

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | `string \| { template?, default?, absolute? }` | 标题与模板 |
| `description` | `string` | 页面描述 |
| `metadataBase` | `URL` | 相对 URL 的基准 |
| `alternates.canonical` | `string \| URL` | 规范链接 |
| `alternates.languages` | `Record<string, string>` | hreflang 映射 |
| `openGraph` | 对象 | `title` / `description` / `images` / `type` 等 |
| `twitter` | 对象 | `card` / `title` / `images` 等 |
| `robots` | 对象 | `index` / `follow` / `googleBot` |
| `icons` | 对象 | 建议用文件式 API |

| `Viewport` 字段 | 说明 |
|---|---|
| `themeColor` | 支持数组形式配合 `media` |
| `colorScheme` | `'light'` / `'dark'` |
| `width` / `initialScale` | 默认已自动设置，通常不用改 |
| `maximumScale` / `userScalable` | 缩放限制 |
| `interactiveWidget` | 虚拟键盘行为 |

## 延伸阅读

- [官方文档：Metadata and OG images（Getting Started）](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
- [官方文档：generateMetadata API 参考](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [官方文档：generateViewport API 参考](https://nextjs.org/docs/app/api-reference/functions/generate-viewport)
- [官方文档：htmlLimitedBots](https://nextjs.org/docs/app/api-reference/config/next-config-js/htmlLimitedBots)
- [React 文档：cache](https://react.dev/reference/react/cache)
