# 47 · Blog A：MDX 内容管线

> **一句话结论**：用 `@next/mdx` 替代 Contentlayer。前者是**官方方案且不介入构建配置**，后者已停止维护、深度 patch webpack，而 Next.js 16 的默认打包器换成了 Turbopack——那层 patch 没有人来修了。代价是文章列表要自己写二十行 `fs` 代码。

## 最小可运行示例

```bash
pnpm add @next/mdx @mdx-js/loader @mdx-js/react @types/mdx
pnpm add gray-matter zod
pnpm add -D rehype-pretty-code shiki rehype-slug remark-gfm
```

```ts
// next.config.ts
import createMDX from '@next/mdx'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 让 .md / .mdx 文件能作为页面、路由、import 的目标
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],

  cacheComponents: true,
}

const withMDX = createMDX({
  // Turbopack 下插件必须用「字符串名 + 可序列化选项」的形式。
  // 传函数会报错——JS 函数没法跨进 Rust 侧的编译器
  options: {
    remarkPlugins: [['remark-gfm']],
    rehypePlugins: [
      ['rehype-slug'],
      ['rehype-pretty-code', { theme: 'github-dark-dimmed', keepBackground: false }],
    ],
  },
})

export default withMDX(nextConfig)
```

```tsx
// mdx-components.tsx —— 必须在项目根目录，否则 App Router 下 @next/mdx 不工作
import type { MDXComponents } from 'mdx/types'
import Image, { type ImageProps } from 'next/image'
import Link from 'next/link'

const components = {
  h2: (props) => <h2 className="mt-10 mb-4 text-2xl font-semibold" {...props} />,
  h3: (props) => <h3 className="mt-8 mb-3 text-xl font-semibold" {...props} />,
  p: (props) => <p className="my-4 leading-7" {...props} />,
  ul: (props) => <ul className="my-4 list-disc pl-6" {...props} />,
  a: ({ href = '', ...props }) => <Link href={href} {...props} />,
  img: (props) => (
    <Image
      sizes="(max-width: 768px) 100vw, 720px"
      className="my-6 rounded-lg"
      {...(props as ImageProps)}
    />
  ),
} satisfies MDXComponents

export function useMDXComponents(): MDXComponents {
  return components
}
```

```mdx
---
title: 从 Pages Router 迁移到 App Router
description: 一次真实的迁移记录，含踩到的七个坑
date: 2026-03-14
tags: [nextjs, migration]
draft: false
---

## 为什么要迁移

正文从这里开始。可以嵌 React 组件：

<Callout type="warning">
  迁移期间不要同时改业务逻辑。
</Callout>

```ts
// 代码块会被 rehype-pretty-code 处理
const x = 1
```
```

## 为什么不用 Contentlayer

Contentlayer 的工作方式是：读一个 `contentlayer.config.ts`，扫描内容目录，为每种文档类型生成一份**类型化的 JSON 数据源**。用起来很舒服——`import { allPosts } from 'contentlayer/generated'`，`allPosts` 直接是带完整类型的数组。

它的问题不在 API 设计，在**它站的位置**：

| 问题 | 后果 |
|---|---|
| 深度 patch Next.js 的打包配置 | 和 Next.js 版本强耦合 |
| 生成 `.contentlayer` 中间目录 | 需要在 `tsconfig.json`、`.gitignore`、构建流程里到处配置 |
| 依赖 webpack 的 loader 机制 | Next.js 16 默认用 **Turbopack**，集成层需要重写 |
| 项目已停止维护 | 没有人来做这件事 |

**关键点是最后两条的组合。** 如果 Contentlayer 还在维护，作者会适配 Turbopack；如果 Turbopack 没成为默认，旧集成还能跑。两条同时成立时，这个方案就死了。

`@next/mdx` 走的是完全不同的路径：

```
Contentlayer：内容文件 → [自定义层] → 生成的 JSON → 你的页面
@next/mdx：  内容文件 → MDX 编译器（官方） → React 组件 → 你的页面
```

`@next/mdx` 只是给打包器加了一条「`.mdx` 文件交给 MDX 编译器」的规则。它不生成中间产物、不 patch 构建流程、不提供查询 API。**它做的越少，越不容易过时。**

代价很明确：**文章列表要自己写**。没有 `allPosts`，你得自己 `fs.readdirSync`。这就是本章要写的那二十行。

## 内容目录的组织

```
content/
├─ hello-world.mdx
├─ migrating-to-app-router.mdx
└─ cache-components-notes.mdx
```

文件名即 slug。这个约定简单到不需要解释，而且**没有额外的数据源要同步**——URL、文件名、frontmatter 里的 title 各司其职，不重复。

## 文章列表：`fs` + `gray-matter` + Zod

```ts
// lib/posts.ts
import 'server-only'

import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { z } from 'zod'

const CONTENT_DIR = path.join(process.cwd(), 'content')

// frontmatter 的 schema。文章写错字段时在构建期就报错，
// 而不是在页面上渲染出 undefined
const frontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
})

export type PostMeta = z.infer<typeof frontmatterSchema> & {
  slug: string
  readingMinutes: number
}

export type Post = PostMeta & { content: string }

// 中文按字符数估算，英文按词数。粗略但足够用于「阅读时长」提示
function estimateReadingMinutes(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length
  const words = text.replace(/[\u4e00-\u9fa5]/g, ' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(cjk / 400 + words / 220))
}

function readAll(): Post[] {
  if (!fs.existsSync(CONTENT_DIR)) return []

  return fs
    .readdirSync(CONTENT_DIR)
    .filter((file) => file.endsWith('.mdx') || file.endsWith('.md'))
    .map((file) => {
      const slug = file.replace(/\.mdx?$/, '')
      const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8')
      const { data, content } = matter(raw)

      const parsed = frontmatterSchema.safeParse(data)
      if (!parsed.success) {
        // 把文件名带进错误信息，否则你不知道是哪篇文章写错了
        throw new Error(
          `frontmatter 校验失败（${file}）：${parsed.error.message}`
        )
      }

      return {
        slug,
        ...parsed.data,
        readingMinutes: estimateReadingMinutes(content),
        content,
      }
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime())
}

export function getAllPosts({ includeDrafts = false } = {}): PostMeta[] {
  return readAll()
    .filter((post) => includeDrafts || !post.draft)
    .map(({ content, ...meta }) => meta)
}

export function getPostBySlug(slug: string): Post | null {
  return readAll().find((post) => post.slug === slug) ?? null
}

export function getAllTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>()

  for (const post of getAllPosts()) {
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}
```

三个设计点：

**`z.coerce.date()` 而不是 `z.date()`。** YAML 里的 `2026-03-14` 会被 `gray-matter` 解析成字符串（`gray-matter` 用的是 js-yaml 的默认 schema，日期不自动转换）。`coerce` 让 Zod 先做 `new Date(...)` 再校验。写成 `z.date()` 会直接报「期望 Date，收到 string」。

**校验失败时 `throw` 而不是 `console.warn`。** 这是**构建期**执行的代码（`generateStaticParams` 会调它），抛异常等于构建失败。一篇文章的 frontmatter 写错了，整个构建停下来——这是好事，比上线后看到一个没有标题的页面强。

**`content` 不进入列表返回值。** `getAllPosts()` 把正文丢掉，只返回元数据。文章列表页不需要正文，多读几百 KB 是无谓的 I/O 和内存。

### 用 `'use cache'` 缓存列表

```ts
// lib/posts.ts（追加）
import { cacheLife, cacheTag } from 'next/cache'

export async function getCachedPosts() {
  'use cache'
  // 文章列表只在发版时变化，用最长的寿命
  cacheLife('max')
  cacheTag('posts')

  return getAllPosts()
}
```

`cacheLife('max')` 的语义是「几乎不变」。文章列表确实如此——新文章上线是一次部署，`Build ID` 变了缓存自然失效。**不需要手动 `revalidateTag`**。

这个判断值得展开：`cacheLife('max')` 不等于「永远不更新」。所有缓存都限定在单次部署内，缓存键包含 Build ID。**部署 = 全新的预渲染产物**。所以对「只在部署时变化」的内容，`'max'` 是准确的描述，而不是偷懒。

## 文章详情页

```tsx
// app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAllPosts, getPostBySlug } from '@/lib/posts'

// 构建期枚举所有文章，未列出的 slug 直接 404
export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }))
}

// 关键：不在 generateStaticParams 里的 slug 不动态渲染，直接 404。
// 没有这一行，任何 /blog/随便打的内容 都会进入渲染流程
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps<'/blog/[slug]'>) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}

  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date.toISOString(),
      tags: post.tags,
    },
  }
}

export default async function PostPage({ params }: PageProps<'/blog/[slug]'>) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  // 动态 import：打包器会为 content/ 目录生成一个 context module，
  // 按 slug 加载对应的 MDX 组件
  const { default: Content } = await import(`@/content/${slug}.mdx`)

  return (
    <article className="mx-auto max-w-2xl">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">{post.title}</h1>
        <p className="mt-2 text-slate-500">{post.description}</p>
        <div className="mt-3 flex gap-3 text-sm text-slate-400">
          <time dateTime={post.date.toISOString()}>
            {post.date.toLocaleDateString('zh-CN')}
          </time>
          <span>{post.readingMinutes} 分钟</span>
        </div>
        <div className="mt-3 flex gap-2">
          {post.tags.map((tag) => (
            <Link
              key={tag}
              href={`/blog/tag/${tag}`}
              className="rounded bg-slate-100 px-2 py-0.5 text-xs"
            >
              #{tag}
            </Link>
          ))}
        </div>
      </header>

      <div className="prose">
        <Content />
      </div>
    </article>
  )
}
```

**`dynamicParams = false` 是安全设置，不只是优化。** 没有它，`/blog/../../etc/passwd` 这类路径会进入渲染流程，最终变成 `import('@/content/../../etc/passwd.mdx')`。虽然打包器的模块解析会拦住绝大多数情况，但「未列出的 slug 一律 404」是一条更简单、更可靠的不变量。

**`await import(...)` 而不是顶层 `import`。** 文章有几十上百篇时，顶层 import 会把所有 MDX 打进一个巨大的 chunk。动态 import 让每篇文章独立成块，访问 A 文章不下载 B 文章的代码。

## 列表页

```tsx
// app/blog/page.tsx
import Link from 'next/link'
import { getCachedPosts } from '@/lib/posts'

export const metadata = {
  title: '博客',
  description: '关于 Next.js、React 与 Web 架构的笔记',
}

export default async function BlogIndex() {
  const posts = await getCachedPosts()

  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="mb-8 text-3xl font-semibold">博客</h1>

      <ul className="space-y-8">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`} className="group block">
              <h2 className="text-xl font-medium group-hover:underline">
                {post.title}
              </h2>
              <p className="mt-1 text-slate-600">{post.description}</p>
              <div className="mt-2 flex gap-3 text-sm text-slate-400">
                <time dateTime={post.date.toISOString()}>
                  {post.date.toLocaleDateString('zh-CN')}
                </time>
                <span>{post.readingMinutes} 分钟</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

这个页面**完全静态**——`getCachedPosts()` 有 `'use cache'` + `cacheLife('max')`，数据进静态外壳，页面直接由 CDN 提供。整个博客的读路径不需要回源。

## 代码高亮

`rehype-pretty-code` 基于 Shiki，在**构建期**把代码块渲染成带样式的 HTML。运行时零 JavaScript，也不需要客户端高亮库。

```ts
// next.config.ts（片段）
rehypePlugins: [
  ['rehype-slug'],
  ['rehype-pretty-code', { theme: 'github-dark-dimmed', keepBackground: false }],
],
```

```css
/* app/globals.css（片段） */
/* keepBackground: false 时，代码块背景由你自己的样式控制，
   这样浅色/深色主题都能适配 */
.prose pre {
  @apply my-6 overflow-x-auto rounded-lg border border-slate-200 p-4 text-sm;
}

/* rehype-pretty-code 输出的行高亮标记 */
.prose [data-highlighted-line] {
  @apply -mx-4 border-l-2 border-blue-500 bg-blue-500/10 px-4;
}
```

行高亮和行号靠代码块里的注释语法：

````mdx
```ts title="lib/posts.ts" showLineNumbers {3-5}
// 第 3-5 行会被高亮
````

三个取舍：

**为什么在构建期高亮而不是客户端。** 客户端高亮库（Prism.js）要在浏览器里解析所有代码块，是纯增的 JS 体积和主线程工作。Shiki 在构建期做完，产物就是静态 HTML。博客这种「代码块多、交互少」的场景，构建期是压倒性的正确选择。

**为什么 `keepBackground: false`。** 主题自带的背景色写死在 HTML 的内联样式里，切到浅色模式时会出现「浅色页面里一块深色代码块」。关掉它，背景交给 CSS 变量控制，两套主题都能适配。

**主题选一个还是两个。** `theme` 可以传对象 `{ light: '...', dark: '...' }`，Shiki 会同时输出两套颜色，用 CSS 的 `prefers-color-scheme` 或 class 切换。代价是 HTML 体积翻倍。本博客用单主题（深色代码块在浅色页面里也成立），保持产物小。

## 目录（TOC）

```ts
// lib/toc.ts
import GithubSlugger from 'github-slugger'

export type Heading = { depth: 2 | 3; text: string; id: string }

export function extractHeadings(markdown: string): Heading[] {
  const slugger = new GithubSlugger()
  const headings: Heading[] = []
  let inCodeBlock = false

  for (const line of markdown.split('\n')) {
    // 代码块里的 # 不是标题
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue

    const match = /^(#{2,3})\s+(.+)$/.exec(line)
    if (!match) continue

    const text = match[2].trim()
    headings.push({
      depth: match[1].length as 2 | 3,
      text,
      // 和 rehype-slug 用同一个 slugger 算法，保证锚点能对上
      id: slugger.slug(text),
    })
  }

  return headings
}
```

**关键点是「和 `rehype-slug` 用同一套算法」**。`rehype-slug` 底层就是 `github-slugger`。自己实现一套简化版（比如 `text.toLowerCase().replace(/\s+/g, '-')`）会在中文标题、重复标题、标点上和它产生分歧——目录里的链接点过去跳不到位置。

`inCodeBlock` 这个状态机也不是多余的：正文里出现

````mdx
```bash
# 这是一行注释，不是标题
```
````

时，正则会把 `# 这是一行注释` 匹配成一级标题。一级标题被 `#{2,3}` 排除了，但 `## 注释` 这种会中招。

## 常见坑

- **现象**：`@next/mdx` 装上后页面报错，提示找不到 `useMDXComponents`。
  **原因**：缺少 `mdx-components.tsx`。这个文件在 App Router 下是**必需的**，且必须在项目根目录（和 `app/` 同级，或 `src/` 内）。
  **解法**：创建 `mdx-components.tsx`，导出一个返回 `MDXComponents` 对象的 `useMDXComponents()` 函数。

- **现象**：在 `next.config.ts` 里用 `remarkPlugins: [remarkGfm]`（函数形式），构建报错。
  **原因**：Turbopack 的编译器用 Rust 实现，**JavaScript 函数无法传进去**。
  **解法**：改成字符串形式 `remarkPlugins: [['remark-gfm']]`，选项必须是可序列化的 JSON。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 2、12 条。

- **现象**：frontmatter 里的日期校验总是失败，报「期望 Date」。
  **原因**：`gray-matter` 用的 YAML schema 不把 `2026-03-14` 转成 `Date`，它保持字符串。
  **解法**：用 `z.coerce.date()`。

- **现象**：目录里的链接点过去跳不到正确位置。
  **原因**：自己实现的 slug 生成算法和 `rehype-slug` 不一致。
  **解法**：用 `github-slugger`——它就是 `rehype-slug` 的内部实现。别自己写。

- **现象**：`generateStaticParams` 返回了所有文章，但访问某篇文章仍然 404。
  **原因**：`getAllPosts()` 默认过滤掉了 `draft: true` 的文章，而该文章的 frontmatter 里 `draft: true`。
  **解法**：这是预期行为。草稿的预览走 [49 章](./49-blog-comments-draft-mode.md) 的 Draft Mode，不通过 `generateStaticParams`。

- **现象**：`fs.readdirSync` 在客户端组件里报错，说 `fs` 模块不存在。
  **原因**：`node:fs` 只能在服务端用。
  **解法**：`lib/posts.ts` 顶部加 `import 'server-only'`，让这类误用**在构建期**失败而不是运行时炸。同时确保只有服务端组件调用它——元数据通过 props 往下传。

- **现象**：文章列表页在开发环境正常，构建时卡住或报 `Filling a cache during prerender timed out`。
  **原因**：`getCachedPosts()` 里调了 `fs`，而它被标了 `'use cache'`。`fs.readFileSync` 本身是**可预测的**（构建期可执行），但如果用了 `fs.promises` 或读了一个在请求期才存在的路径，就会超时。
  **解法**：`content/` 目录必须随代码一起部署。确认它不在 `.gitignore` 里、不在部署产物之外。用 `path.join(process.cwd(), 'content')` 而不是相对路径。

- **现象**：文章里嵌的 React 组件报「不能在客户端组件中使用」。
  **原因**：MDX 文件在 App Router 下默认编译成**服务端组件**。如果组件里用了 `useState`，需要在组件文件顶部加 `'use client'`。
  **解法**：交互组件单独建文件并标 `'use client'`，在 MDX 里 import 使用。

- **现象**：`dynamicParams = false` 之后，新写的文章上线但 404。
  **原因**：`generateStaticParams` 在**构建期**执行，新文章需要重新构建。
  **解法**：这是静态站点的固有特性。用平台的构建钩子（内容仓库的 webhook 触发重新部署），或者接受「发版即生效」。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 内容管线 | **Contentlayer**（已停止维护） | **`@next/mdx`** |
| 文章列表数据源 | `import { allPosts } from 'contentlayer/generated'` | 自己 `fs` + `gray-matter` |
| 构建期产物 | `.contentlayer/` 中间目录 | 无中间产物 |
| remark/rehype 插件 | 函数形式 `[remarkGfm]` | **字符串形式 `[['remark-gfm']]`**（Turbopack 要求） |
| 打包器 | webpack | **Turbopack 默认** |
| 文章详情动态渲染 | `fallback: true` | `dynamicParams`（默认 `true`） |
| `params` | 同步对象 | **`await params`** |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 2、7、12 条。

## API / 配置速查

| API / 配置 | 签名 | 说明 |
|---|---|---|
| `createMDX({ options })` | `(config) => (nextConfig) => nextConfig` | 包装 Next 配置 |
| `pageExtensions` | `string[]` | 必须包含 `'md'` / `'mdx'` |
| `useMDXComponents()` | `() => MDXComponents` | 在根目录 `mdx-components.tsx` 中导出，**必需** |
| `remarkPlugins` | `string \| [string, object][]` | Turbopack 下**必须**是字符串形式 |
| `dynamicParams` | `boolean`，默认 `true` | `false` 时未预渲染的 slug 直接 404 |
| `matter(raw)` | `{ data, content }` | `gray-matter`，解析 frontmatter |
| `z.coerce.date()` | Zod schema | 把 YAML 日期字符串转成 `Date` |
| `GithubSlugger` | `new GithubSlugger().slug(text)` | 与 `rehype-slug` 同算法，保证锚点一致 |
| `await import(\`@/content/${slug}.mdx\`)` | `{ default: Component }` | 按需加载，每篇独立成 chunk |

| 依赖 | 作用 |
|---|---|
| `@next/mdx` | Next.js 的 MDX 集成 |
| `@mdx-js/loader` | MDX 的 webpack/Turbopack loader |
| `@mdx-js/react` | MDX 的 React 运行时 |
| `@types/mdx` | 类型声明 |
| `gray-matter` | frontmatter 解析 |
| `rehype-pretty-code` + `shiki` | 构建期代码高亮 |
| `rehype-slug` | 给标题加 `id` 锚点 |
| `remark-gfm` | 表格、删除线、任务列表等 GFM 语法 |
| `github-slugger` | 与 `rehype-slug` 一致的 slug 生成 |

## 延伸阅读

- [官方文档：MDX](https://nextjs.org/docs/app/guides/mdx)
- [官方文档：`mdx-components.tsx` 文件约定](https://nextjs.org/docs/app/api-reference/file-conventions/mdx-components)
- [官方文档：`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)
- [官方文档：`pageExtensions`](https://nextjs.org/docs/app/api-reference/config/next-config-js/pageExtensions)
- [MDX 官方文档](https://mdxjs.com/)
- [rehype-pretty-code 文档](https://rehype-pretty.pages.dev/)
- [Vercel Portfolio Starter Kit（完整的 MDX 博客示例）](https://vercel.com/templates/next.js/portfolio-starter-kit)
