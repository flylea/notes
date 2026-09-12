# 48 · Blog B：SEO 与性能

> **一句话结论**：博客的 SEO 和性能是**同一件事**——把页面做成静态外壳，让 CDN 直接吐 HTML。SEO 靠的是**每篇文章独立的 metadata + canonical + 结构化数据 + sitemap**，性能靠的是**服务端渲染 + 尽量少的客户端 JS**。两者都不需要「SEO 插件」那类东西。

## 最小可运行示例

```tsx
// app/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { getPostBySlug } from '@/lib/posts'

export const alt = '文章封面'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 28, color: '#94a3b8' }}>notes.example.com</div>

        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.25,
            display: 'flex',
          }}
        >
          {post?.title ?? '文章'}
        </div>

        <div style={{ display: 'flex', gap: 16, fontSize: 24, color: '#cbd5e1' }}>
          {post?.tags.slice(0, 3).map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      </div>
    ),
    size
  )
}
```

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/posts'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://notes.example.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts()

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: posts[0]?.date ?? new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...posts.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: post.date,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]
}
```

```ts
// app/robots.ts
import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://notes.example.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // 搜索页和预览端点不该被索引：内容重复且会消耗爬虫预算
      disallow: ['/api/', '/notes/', '/blog/preview'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
```

## Metadata：`metadataBase` 是一切的前提

```ts
// app/layout.tsx（片段）
import type { Metadata } from 'next'

export const metadata: Metadata = {
  // 没有它，所有相对路径的 canonical / og:image 都会生成带
  // localhost:3000 的绝对 URL，上线后整批失效
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://notes.example.com'
  ),
  title: {
    default: 'Next.js 学习笔记',
    template: '%s · Next.js 学习笔记',
  },
  description: '关于 Next.js、React 与 Web 架构的笔记',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: 'Next.js 学习笔记',
  },
  twitter: { card: 'summary_large_image' },
}
```

`metadataBase` 的坑在于**它只在开发时看起来正常**。`http://localhost:3000/blog/hello` 能打开，OG 图能显示，一切正常。上线后才发现在社交平台分享时预览图 404——因为 HTML 里写的是 `http://localhost:3000/opengraph-image`。

用环境变量而不是硬编码，是为了让预览部署（preview deployment）也能生成正确的绝对 URL。每个预览环境配自己的 `NEXT_PUBLIC_SITE_URL`。

## 每篇文章的 Metadata

```tsx
// app/blog/[slug]/page.tsx（片段）
import type { Metadata } from 'next'
import { getPostBySlug } from '@/lib/posts'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://notes.example.com'

export async function generateMetadata({
  params,
}: PageProps<'/blog/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post) {
    return { title: '文章不存在', robots: { index: false, follow: false } }
  }

  const url = `${BASE_URL}/blog/${post.slug}`

  return {
    title: post.title,
    description: post.description,
    keywords: post.tags,

    // canonical：告诉搜索引擎「这个内容的权威 URL 是这个」。
    // 分页、带 utm 参数、多域名镜像时，没有它会被判为重复内容
    alternates: { canonical: url },

    openGraph: {
      type: 'article',
      url,
      title: post.title,
      description: post.description,
      publishedTime: post.date.toISOString(),
      tags: post.tags,
      // og:image 由同目录的 opengraph-image.tsx 自动注入，不用手写
    },
  }
}
```

**`og:image` 不需要手写。** 同目录下的 `opengraph-image.tsx` 会被自动识别，生成的 URL 自动写进 metadata。这是文件式 metadata 约定的价值——图和页面在同一个目录，删页面时不会留下孤儿配置。

**草稿文章要显式 `robots: { index: false }`。** 只在页面上隐藏是不够的，搜索引擎可能已经抓到了。

## 结构化数据（JSON-LD）

```tsx
// components/article-json-ld.tsx
import type { Post } from '@/lib/posts'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://notes.example.com'

export function ArticleJsonLd({ post }: { post: Post }) {
  const url = `${BASE_URL}/blog/${post.slug}`

  const json = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date.toISOString(),
    dateModified: post.date.toISOString(),
    inLanguage: 'zh-CN',
    keywords: post.tags.join(', '),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Organization', name: 'Next.js 学习笔记' },
    publisher: { '@type': 'Organization', name: 'Next.js 学习笔记' },
    // 用 generateImageMetadata 或约定路径算出绝对 URL
    image: `${url}/opengraph-image`,
  }

  return (
    <script
      type="application/ld+json"
      // JSON.stringify 的输出里可能包含 </script>，必须转义。
      // 不转义的话，一个文章标题里出现这串字符就能注入 HTML
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(json).replace(/</g, '\\u003c'),
      }}
    />
  )
}
```

```tsx
// app/blog/[slug]/page.tsx（片段，渲染部分）
<div className="prose">
  <Content />
</div>

<ArticleJsonLd post={post} />

<nav aria-label="面包屑" className="mt-12 text-sm text-slate-500">
  <ol className="flex gap-2">
    <li><Link href="/">首页</Link></li>
    <li aria-hidden>/</li>
    <li><Link href="/blog">博客</Link></li>
    <li aria-hidden>/</li>
    <li aria-current="page">{post.title}</li>
  </ol>
</nav>
```

**`JSON.stringify` 之后的 `.replace(/</g, '\\u003c')` 不是可选的。** `<script type="application/ld+json">` 的内容是**原始文本**，浏览器解析到 `</script>` 就结束。如果文章标题里出现了这串字符（或者更常见的，正文里引用了一段代码），HTML 结构就被破坏了，后面的内容会被当成页面内容渲染——这是一个真实的 XSS 向量。转义 `<` 是最简单可靠的解法。

### 面包屑的结构化数据

```ts
// components/breadcrumb-json-ld.tsx
export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[]
}) {
  const json = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(json).replace(/</g, '\\u003c'),
      }}
    />
  )
}
```

面包屑结构化数据的作用是**让搜索结果里显示层级路径**而不是裸 URL。这是搜索结果里少数几个能主动优化的展示位之一。

## 性能：先做静态，再谈优化

性能优化的顺序不能颠倒。**最大的收益永远来自「这个页面能不能直接从 CDN 吐出来」**，其次是「首屏需要多少 JS」，最后才是打包细节。

```tsx
// app/blog/page.tsx
import { getCachedPosts } from '@/lib/posts'

export default async function BlogIndex() {
  // getCachedPosts 内部：'use cache' + cacheLife('max') + cacheTag('posts')
  const posts = await getCachedPosts()
  // ...
}
```

```ts
// lib/posts.ts（片段）
export async function getCachedPosts() {
  'use cache'
  cacheLife('max')
  cacheTag('posts')
  return getAllPosts()
}
```

这个页面**没有任何请求期数据**：不读 `cookies()`、不读 `headers()`、不读 `searchParams`。所以整个页面进静态外壳，构建期就渲染好 HTML，用户请求直接命中 CDN。

对比一下「客户端拉取」的做法：

| | 静态外壳 + CDN | 客户端 `useEffect` 拉取 |
|---|---|---|
| TTFB | CDN 边缘，几十毫秒 | 服务器 + 数据库 |
| LCP | HTML 到达即可 | 等 JS 下载 + 执行 + 请求 + 渲染 |
| SEO | HTML 里有完整内容 | 首屏 HTML 里没有内容 |
| JS 体积 | 0（列表不需要客户端 JS） | 数据层 + 状态管理 |

**这就是为什么博客的性能优化起点是缓存策略，不是 `React.memo`。**

### React Compiler

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  reactCompiler: true,
}

export default nextConfig
```

```bash
pnpm add -D babel-plugin-react-compiler
```

React Compiler 在**构建期**分析组件，自动插入 memoization。开启后手写 `useMemo` / `useCallback` / `React.memo` 的场景大幅减少。

**代价是构建时间变长**——每个组件都要做数据流分析。博客这种页面数量多、单页简单的项目，构建时间增加比较明显。判断标准：如果构建时间从 30 秒变成 3 分钟，而你手写的 `useMemo` 本来就没几个，那不值得开。

**它不解决什么**：编译器只优化「组件内部的重渲染」。它不会让一个客户端组件变成服务端组件，也不会减少 bundle 体积。**把组件挪到服务端，比让它被更好地 memoize 收益大得多。**

### 懒加载客户端组件

```tsx
// components/theme-toggle-lazy.tsx
'use client'

import dynamic from 'next/dynamic'

// 主题切换按钮不在首屏关键路径上，延迟到客户端再加载
const ThemeToggle = dynamic(() => import('./theme-toggle').then((m) => m.ThemeToggle), {
  ssr: false,
  loading: () => <div className="h-8 w-24" aria-hidden />,
})

export function LazyThemeToggle() {
  return <ThemeToggle />
}
```

`ssr: false` 在这里是对的：主题切换按钮的状态完全来自 `localStorage`，服务端渲染出来的任何内容都会在 hydration 时被替换。与其渲染一个会变的按钮，不如渲染一个尺寸相同的占位，避免布局偏移。

> **注意**：`ssr: false` **不能在服务端组件里用**。`next/dynamic` 的这个选项只在客户端组件中有效——所以上面这个文件顶部必须有 `'use client'`。在服务端组件里写 `ssr: false` 会在构建期报错。

**`ssr: false` 不该滥用的地方**：任何影响 SEO 或首屏内容的东西。正文、标题、导航都必须是服务端渲染的。

### 图片

```tsx
// app/blog/[slug]/page.tsx（片段）
import Image from 'next/image'

<Image
  src={post.cover}
  alt={post.title}
  width={1200}
  height={630}
  // sizes 决定浏览器实际下载哪个尺寸的图。写错会导致下载过大的图
  sizes="(max-width: 768px) 100vw, 720px"
  priority={false}
  className="rounded-lg"
/>
```

**`sizes` 是最容易被忽略的属性。** 没有它，浏览器会按 `width` 属性（1200px）去挑图，在手机上浪费带宽。它的值是**媒体查询 + 实际渲染宽度**的映射——`(max-width: 768px) 100vw, 720px` 的意思是「小屏占满视口宽度，大屏固定 720px」。

**`priority` 只给首屏可见的图。** 给所有图加 `priority` 等于没加，还会挤占首屏资源。

顺带一提，16 里 `next/image` 的默认值变了：`minimumCacheTTL` 从 60 秒提到 4 小时，`qualities` 只允许 `[75]`，`imageSizes` 移除了 `16`。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 8 条。

### 字体

中文博客的字体优化是个特殊问题：**完整的中文字体有 5–15MB**，直接引入会让首屏卡死。

```tsx
// app/layout.tsx（片段）
import localFont from 'next/font/local'

const sans = localFont({
  src: [
    { path: './fonts/inter-var.woff2', weight: '100 900', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-sans',
  // 只预加载首屏真正用到的字体
  preload: true,
})
```

中文字体的三条路：

| 方案 | 体积 | 效果 |
|---|---|---|
| 系统字体栈（`system-ui` / `PingFang SC` / `Microsoft YaHei`） | **0** | 各平台字体不同，但都好看 |
| 按需子集化（只打包用到的字） | 几十 KB | 需要构建期扫描所有文本 |
| 完整中文字体 | 5–15MB | 不可接受 |

**本博客选系统字体栈。** 中文用户的操作系统自带字体质量已经很高，引入 webfont 的收益远小于代价。英文部分用 `next/font/local` 引入一个子集化的 Inter。

`display: 'swap'` 让文字先用系统字体渲染、字体加载完再切换。代价是可能的字体闪烁（FOUT），收益是**首屏文字不会因为等字体而空白**。对内容站来说，文字能立刻读比字体完全一致重要。

### 包体积分析

```bash
# Turbopack 的模块图分析器（16.1+，实验性）
npx next experimental-analyze

# 输出到磁盘，方便和优化前对比
npx next experimental-analyze --output
# 产物在 .next/diagnostics/analyze
```

它会给出服务端和客户端模块的 treemap，支持按路由、环境（client/server）、类型（JS/CSS/JSON）过滤，点击模块能看到**完整的 import 链**——这一点比只看体积重要：知道「谁引入了这个大依赖」才能决定怎么拆。

> Next.js 16 从构建输出里移除了 `size` 和 `First Load JS` 两个指标，所以包体积监控需要靠这个分析器或其他外部工具。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 18 条。

### 预取

```tsx
// 列表页的链接
<Link href={`/blog/${post.slug}`} prefetch={true}>
  {post.title}
</Link>
```

`prefetch={true}` 会在链接进入视口时预取**整页**的 RSC Payload；默认（`null`）只预取静态外壳部分。文章详情页是静态的，预取成本低、收益高——用户点进去时页面已经在了。

**不要给列表里几十个链接全开 `prefetch={true}`。** 每个预取都是一个请求。列表页只给前几条可见的开，或者干脆用默认值——默认的「只预取外壳」对静态页面已经足够快。

## 常见坑

- **现象**：社交平台分享时预览图 404，但本地开发一切正常。
  **原因**：metadata 里的相对 URL 被解析成了 `http://localhost:3000/...`。
  **解法**：在根布局设置 `metadataBase`，值从 `NEXT_PUBLIC_SITE_URL` 读。每个预览环境配自己的值。

- **现象**：`opengraph-image.tsx` 里的 `params` 是 `undefined`。
  **原因**：16 里 `params` 是 Promise，必须 `await`。`generateImageMetadata` 的 `id` 同样是 Promise。
  **解法**：`const { slug } = await params`。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条。

- **现象**：`ImageResponse` 里的样式不生效。
  **原因**：`ImageResponse` 用的是 **Satori**，它只支持 **flexbox 的子集**，不支持 `grid`、不支持大多数选择器、不支持 CSS 变量和外部样式表。所有样式必须是内联的 `style` 对象。
  **解法**：每个容器显式写 `display: 'flex'`（Satori 里默认不是 flex）。需要复杂布局时用嵌套 flex 模拟。

- **现象**：结构化数据导致页面 HTML 结构错乱。
  **原因**：`JSON.stringify` 的输出里含 `</script>`，浏览器提前结束了脚本标签。
  **解法**：`.replace(/</g, '\\u003c')`。所有注入 JSON-LD 的地方都要做。

- **现象**：草稿文章出现在搜索结果里。
  **原因**：只在 `getAllPosts()` 里过滤了 `draft`，但搜索引擎可能已经抓取过，或者 `generateMetadata` 没有声明 `robots`。
  **解法**：草稿文章的 metadata 里显式 `robots: { index: false, follow: false }`。`robots.ts` 里也 disallow 掉预览路径。

- **现象**：开启了 React Compiler，构建时间翻了好几倍，但性能指标没变化。
  **原因**：Compiler 优化的是「客户端组件的重渲染」。博客的页面大部分是服务端组件，没有重渲染问题。
  **解法**：先确认瓶颈在哪。静态页面 + CDN 的收益远大于 memoization，别在没瓶颈的地方优化。

- **现象**：手机上图片加载慢、流量消耗大。
  **原因**：`next/image` 的 `sizes` 没写或写错，浏览器下载了 1200px 宽的图来显示 375px 宽。
  **解法**：`sizes` 要反映**实际渲染宽度**，不是容器宽度。用浏览器 DevTools 的 Network 面板确认实际请求的图片尺寸。

- **现象**：中文字体引入后首屏白屏几秒。
  **原因**：完整中文字体体积在 5MB 以上。
  **解法**：用系统字体栈。确实需要 webfont 时做子集化，并设 `display: 'swap'`。

- **现象**：`sitemap.ts` 里的 `lastModified` 用了 `new Date()`，每次构建都变。
  **原因**：`new Date()` 在构建时求值，每次构建都是新的时间戳，搜索引擎会认为所有页面都在变。
  **解法**：用内容自己的日期（`post.date`）。首页这种聚合页可以用「最新文章日期」，而不是「构建时刻」。

- **现象**：`robots.ts` 里 disallow 了 `/notes/`，但笔记页面仍然被索引。
  **原因**：`robots.txt` 是**建议**，不是强制。而且如果页面已经被索引，disallow 之后爬虫看不到 `noindex` 标签，反而无法移除索引。
  **解法**：真正的移除手段是页面上的 `<meta name="robots" content="noindex">`。`robots.txt` 只能减少抓取，不能保证不被索引。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| OG 图生成 | `@vercel/og` 单独安装 | **`next/og` 内置 `ImageResponse`** |
| 动态 OG 图参数 | `generateImageMetadata` 的 `id` 是 string | **`id` 是 `Promise<string>`** |
| metadata 图像路由参数 | `params` 同步 | **`await params`** |
| 图片域名白名单 | `images.domains` | **`images.remotePatterns`** |
| `qualities` | `[1..100]` 全允许 | **仅 `[75]`**，其他需显式配置 |
| 构建输出指标 | 含 `size` / `First Load JS` | **已移除**，用 `next experimental-analyze` |
| 包分析 | `@next/bundle-analyzer`（webpack） | **`npx next experimental-analyze`**（Turbopack，16.1+） |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7、8、9、18 条。

## API / 配置速查

| API / 文件 | 签名 | 说明 |
|---|---|---|
| `metadataBase` | `URL` | 相对 URL 的解析基准，**不设会导致上线后 canonical/OG 失效** |
| `alternates.canonical` | `string` | 声明权威 URL，防重复内容 |
| `robots` | `{ index, follow }` | 页面级索引控制，比 `robots.txt` 更可靠 |
| `opengraph-image.tsx` | `default export` 返回 `ImageResponse` | 同目录自动关联，无需手写 `og:image` |
| `export const alt / size / contentType` | — | OG 图路由的静态导出 |
| `ImageResponse` | `(jsx, { width, height }) => Response` | 来自 `next/og`，基于 Satori |
| `generateImageMetadata` | `() => { id, ... }[]` | 一个文件生成多张图；`id` 是 Promise |
| `sitemap.ts` | `default export` 返回 `MetadataRoute.Sitemap` | 自动生成 `/sitemap.xml` |
| `robots.ts` | `default export` 返回 `MetadataRoute.Robots` | 自动生成 `/robots.txt` |
| `dynamic(fn, { ssr: false })` | `Component` | 延迟加载客户端组件，不参与 SSR |
| `next experimental-analyze` | CLI | Turbopack 模块图分析（16.1+，实验性） |

| Satori（`ImageResponse`）限制 | 说明 |
|---|---|
| 只支持 flexbox | 不支持 `grid`；容器要显式 `display: 'flex'` |
| 样式必须内联 | 不支持外部 CSS、CSS 变量、伪类 |
| 不支持 `gap` 以外的部分简写 | 用明确的 `margin` / `padding` |
| 字体要显式加载 | 自定义字体需传 `fonts` 选项，不支持系统字体探测 |
| 不支持所有 CSS 属性 | 只实现了一个子集，复杂布局要用嵌套 flex 拼 |

## 延伸阅读

- [官方文档：Metadata and OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
- [官方文档：`generateMetadata`](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [官方文档：`opengraph-image` 文件约定](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image)
- [官方文档：`ImageResponse`](https://nextjs.org/docs/app/api-reference/functions/image-response)
- [官方文档：`sitemap.xml`](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
- [官方文档：`robots.txt`](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots)
- [官方文档：Optimizing package bundling](https://nextjs.org/docs/app/guides/package-bundling)
- [官方文档：Production checklist](https://nextjs.org/docs/app/guides/production-checklist)
- [官方文档：Lazy Loading](https://nextjs.org/docs/app/guides/lazy-loading)
- [Schema.org：BlogPosting](https://schema.org/BlogPosting)
- [Satori 文档（`ImageResponse` 的底层实现）](https://github.com/vercel/satori)
