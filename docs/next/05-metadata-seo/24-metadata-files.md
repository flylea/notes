# 24 · Metadata 文件式

> **一句话结论**：把 `sitemap.ts`、`robots.ts`、`manifest.ts`、`opengraph-image.tsx`、`icon.tsx` 这些文件放进 `app/` 目录，Next.js 会自动生成对应的路由和 `<head>` 标签。**16 的关键变更**：图像生成函数的 `params`、`generateImageMetadata` 的 `id`、`generateSitemaps` 的 `id` **全都是 Promise**，必须 `await`。

## 最小可运行示例

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://acme.com',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
    {
      url: 'https://acme.com/about',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ]
}
```

放在 `app/` 根目录，访问 `/sitemap.xml` 就得到符合 Sitemaps 协议的 XML。不需要写 Route Handler，也不需要手工拼 XML。

## 文件式 vs 配置式

这两套 API 的分工：

| | 配置式（第 23 章） | 文件式（本章） |
|---|---|---|
| 形式 | 导出 `metadata` 对象或 `generateMetadata` | 约定的**文件名** |
| 产出 | `<head>` 里的 `<meta>` / `<link>` | 独立的**文件路由**（`/sitemap.xml`、`/og.png`） |
| 优先级 | 较低 | **更高**，会覆盖配置式的同类字段 |

因为文件式优先级更高，两者冲突时以文件式为准。

## `sitemap.ts`

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://acme.com',
      lastModified: '2026-09-12',
      changeFrequency: 'weekly',
      priority: 0.5,
    },
  ]
}
```

返回类型：

```ts
type Sitemap = Array<{
  url: string
  lastModified?: string | Date
  changeFrequency?:
    | 'always' | 'hourly' | 'daily' | 'weekly'
    | 'monthly' | 'yearly' | 'never'
  priority?: number
  alternates?: { languages?: Record<string, string> }
  images?: string[]
  videos?: Array<{ title: string; thumbnail_loc: string; description: string }>
}>
```

`priority` 范围 0–1，只影响同一站点内 URL 之间的相对重要性，不跨站比较。

> `sitemap.ts` 是特殊的 Route Handler，**默认被缓存**，除非它使用请求时 API 或动态配置。所以里面写 `new Date()` 是安全的——它在构建期执行一次。

### 图片与视频 sitemap

在条目上加 `images` 和 `videos` 字段，框架会自动补上对应的 `xmlns:image` / `xmlns:video` 命名空间：

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://acme.com/post-1',
      lastModified: new Date(),
      images: ['https://acme.com/cover-1.jpg'],
      videos: [
        {
          title: '产品演示',
          thumbnail_loc: 'https://acme.com/thumb.jpg',
          description: '三分钟了解核心功能',
        },
      ],
    },
  ]
}
```

### 多语言 sitemap

```ts
// app/sitemap.ts
{
  url: 'https://acme.com',
  lastModified: new Date(),
  alternates: {
    languages: { zh: 'https://acme.com/zh', en: 'https://acme.com/en' },
  },
}
```

产出的 XML 里会带上 `<xhtml:link rel="alternate" hreflang="...">`。

### 分片：`generateSitemaps`

单个 sitemap 的 URL 上限是 **50,000 条**（Google 的限制）。超过就得拆分。

```ts
// app/product/sitemap.ts
import type { MetadataRoute } from 'next'
import { BASE_URL } from '@/app/lib/constants'

export async function generateSitemaps() {
  // 返回分片清单，每片一个 id
  return [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }]
}

export default async function sitemap(props: {
  id: Promise<string>
}): Promise<MetadataRoute.Sitemap> {
  // id 是 Promise，必须 await
  const id = await props.id

  const start = Number(id) * 50000
  const end = start + 50000
  const products = await getProducts(
    `SELECT id, date FROM products WHERE id BETWEEN ${start} AND ${end}`
  )

  return products.map((product) => ({
    url: `${BASE_URL}/product/${product.id}`,
    lastModified: product.date,
  }))
}
```

生成的分片地址是 `/product/sitemap/0.xml`、`/product/sitemap/1.xml`……

**`id` 从 16 起是 `Promise<string>`**，旧写法里它是个普通值。见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条。

另一种分片方式更简单：在多个路由段各放一个 `sitemap.ts`，例如 `app/sitemap.ts` 和 `app/products/sitemap.ts`，会分别生成 `/sitemap.xml` 和 `/products/sitemap.xml`。

## `robots.ts`

```ts
// app/robots.ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/private/',
    },
    sitemap: 'https://acme.com/sitemap.xml',
  }
}
```

产出：

```
User-Agent: *
Allow: /
Disallow: /private/

Sitemap: https://acme.com/sitemap.xml
```

### 针对不同爬虫设置不同规则

`rules` 传数组时，每条规则生成一个独立的 `User-Agent` 块：

```ts
// app/robots.ts
rules: [
  { userAgent: 'Googlebot', allow: '/', disallow: '/private/' },
  // 多个 userAgent 共用同一组规则
  { userAgent: ['Applebot', 'Bingbot'], disallow: ['/'] },
],
```

### 非标准指令

部分搜索引擎支持标准之外的指令（Seznam 的 `Request-Rate`、Yandex 的 `Clean-param`）。用 `other` 字段透传，值是**原样输出**的，框架不校验指令名和值：

```ts
// app/robots.ts
rules: [
  { userAgent: '*', allow: '/' },
  { userAgent: 'SeznamBot', allow: '/', other: { 'Request-Rate': '10/1m' } },
],
```

`other` 是 16.3 新增的字段。

### Robots 类型

```ts
type Robots = {
  rules:
    | {
        userAgent?: string | string[]
        allow?: string | string[]
        disallow?: string | string[]
        crawlDelay?: number
        other?: Record<string, string | number | Array<string | number>>
      }
    | Array<{
        userAgent: string | string[]
        allow?: string | string[]
        disallow?: string | string[]
        crawlDelay?: number
        other?: Record<string, string | number | Array<string | number>>
      }>
  sitemap?: string | string[]
  host?: string
}
```

`robots.txt` 也可以直接放静态文件在 `app/` 根目录：

```
# app/robots.txt
User-Agent: *
Allow: /
Disallow: /private/

Sitemap: https://acme.com/sitemap.xml
```

## `manifest.ts`

```ts
// app/manifest.ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Acme 应用',
    short_name: 'Acme',
    description: '基于 Next.js 的 Web 应用',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff',
    theme_color: '#fff',
    icons: [
      { src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
    ],
  }
}
```

访问 `/manifest.webmanifest` 得到 Web App Manifest。`MetadataRoute.Manifest` 的字段跟随 Web Manifest 规范，完整列表在 MDN。

静态版本就是直接放 `app/manifest.json` 或 `app/manifest.webmanifest`。

## `opengraph-image` 与 `twitter-image`

两种用法：放图片文件，或用代码生成。

### 图片文件

| 文件名 | 支持格式 |
|---|---|
| `opengraph-image` | `.jpg` `.jpeg` `.png` `.gif` |
| `twitter-image` | `.jpg` `.jpeg` `.png` `.gif` |
| `opengraph-image.alt.txt` | 同段的 alt 文本 |
| `twitter-image.alt.txt` | 同段的 alt 文本 |

```txt
// app/blog/opengraph-image.alt.txt
博客首页封面
```

产出：

```html
<meta property="og:image" content="<generated>" />
<meta property="og:image:type" content="<generated>" />
<meta property="og:image:width" content="<generated>" />
<meta property="og:image:height" content="<generated>" />
<meta property="og:image:alt" content="博客首页封面" />
```

**文件体积有硬限制**：`twitter-image` 不超过 5MB，`opengraph-image` 不超过 8MB。超了构建直接失败。

**就近优先**：更深的目录里的图片会覆盖上层目录的同名图片。所以 `app/blog/opengraph-image.jpg` 只对 `/blog` 及其子路由生效，`app/opengraph-image.jpg` 作为兜底。

### 代码生成

```tsx
// app/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { getPost } from '@/app/lib/data'

// 图像元数据
export const alt = '文章封面'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  // params 是 Promise，必须 await
  const { slug } = await params
  const post = await getPost(slug)

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 64,
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {post.title}
      </div>
    ),
    { ...size }
  )
}
```

三个可选的配置导出：

| 导出 | 类型 | 作用 |
|---|---|---|
| `alt` | `string` | 生成 `og:image:alt` |
| `size` | `{ width: number; height: number }` | 生成 `og:image:width/height`，也可复用到 `ImageResponse` 的选项 |
| `contentType` | `string` | 生成 `og:image:type` |

默认导出函数应返回一个 `Response`——`ImageResponse` 满足这个类型。

### `params` 是 Promise

| 路由 | URL | `params` |
|---|---|---|
| `app/shop/opengraph-image.tsx` | `/shop` | `undefined` |
| `app/shop/[slug]/opengraph-image.tsx` | `/shop/1` | `Promise<{ slug: '1' }>` |
| `app/shop/[tag]/[item]/opengraph-image.tsx` | `/shop/1/2` | `Promise<{ tag: '1', item: '2' }>` |

**16 起 `params` 是 Promise**，旧写法里是同步对象。见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条。

### `ImageResponse` 的能力边界

`ImageResponse` 用 `@vercel/og` + `satori` + `resvg` 把 JSX 和 CSS 转成 PNG。它**只支持 flexbox 和一部分 CSS 属性**——`display: grid` 这类高级布局不工作。想快速试样式可以用 Vercel OG Playground。

### 加载本地字体与图片

`ImageResponse` 不能引用 `next/font` 或 CSS 里的字体，必须把字体文件读成 `ArrayBuffer` 显式传进去，否则中文会渲染成方块。不依赖请求数据的资源放在**模块作用域**读一次即可：

```tsx
// app/about/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const size = { width: 1200, height: 630 }

// 路径相对项目根目录，不是示例源文件
const interSemiBold = await readFile(join(process.cwd(), 'assets/Inter-SemiBold.ttf'))

export default async function Image() {
  return new ImageResponse(
    (<div style={{ display: 'flex', fontSize: 128 }}>About Acme</div>),
    {
      ...size,
      fonts: [{ name: 'Inter', data: interSemiBold, style: 'normal', weight: 400 }],
    }
  )
}
```

本地图片同理，转成 base64 或 `ArrayBuffer` 后传给 `<img src>`：

```tsx
// app/opengraph-image.tsx
const logoData = await readFile(join(process.cwd(), 'logo.png'), 'base64')
const logoSrc = `data:image/png;base64,${logoData}`

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={logoSrc} height="100" />
      </div>
    )
  )
}
```

> 传 `ArrayBuffer` 给 `<img src>` 不是 HTML 规范的一部分。`next/og` 的渲染引擎支持，但 TypeScript 类型按规范走，需要 `@ts-expect-error`。

## `icon` 与 `apple-icon`

| 文件约定 | 支持格式 | 有效位置 |
|---|---|---|
| `favicon` | `.ico` | **仅 `app/` 根** |
| `icon` | `.ico` `.jpg` `.jpeg` `.png` `.svg` | `app/**/*` |
| `apple-icon` | `.jpg` `.jpeg` `.png` | `app/**/*` |

产出：

```html
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" href="/icon?<generated>" type="image/<generated>" sizes="<generated>" />
<link rel="apple-touch-icon" href="/apple-icon?<generated>" type="image/<generated>" sizes="<generated>" />
```

`type` 和 `sizes` 由框架读取文件后自动推断。`.svg` 或无法确定尺寸时会带上 `sizes="any"`。

**多个图标**：加数字后缀，按字典序排序：

```
app/
├─ icon1.png
└─ icon2.png
```

**`favicon` 只能在 `app/` 根设置**，需要更细的粒度就用 `icon`。

### 用代码生成 icon

```tsx
// app/icon.tsx
import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: 'black',
          color: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        A
      </div>
    ),
    { ...size }
  )
}
```

**`favicon` 无法用代码生成**——只能用 `icon` 或直接放 `favicon.ico` 文件。

同样地，`params` 是 Promise：

```tsx
// app/shop/[slug]/icon.tsx
export default async function Icon({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  // ...
}
```

### `generateImageMetadata`：一个文件多个图

```tsx
// app/icon.tsx
import { ImageResponse } from 'next/og'
import type { ImageMetadata } from 'next'

export function generateImageMetadata() {
  return [
    { id: 'small', size: { width: 32, height: 32 }, contentType: 'image/png' },
    { id: 'large', size: { width: 192, height: 192 }, contentType: 'image/png' },
  ] satisfies ImageMetadata[]
}

export default async function Icon({ id }: { id: Promise<string> }) {
  // id 也是 Promise，必须 await
  const iconId = await id

  return new ImageResponse(
    (<div style={{ fontSize: 24, background: 'black', color: 'white' }}>{iconId}</div>)
  )
}
```

## 缓存行为

所有元数据文件（`sitemap`、`robots`、`manifest`、`opengraph-image`、`icon` 等）都是**特殊的 Route Handler**：

- **默认被缓存**（静态优化，构建期生成一次）
- 除非使用了请求时 API（`cookies()`、`headers()`、`connection()`）或动态配置选项
- 它们是 Route Handler，因此可以使用与 page / layout 相同的路由段配置

```ts
// app/product/sitemap.ts
// 每小时重新生成
export const revalidate = 3600

export default async function sitemap() {
  // ...
}
```

## 常见坑

- **现象**：`params.slug` 是 `undefined`；`generateSitemaps` 的 `id` 参与计算得到 `NaN`；`generateImageMetadata` 的 `id` 打印成 `[object Promise]`。
  **原因**：这三个值在 16 里**都是 Promise**，不 `await` 就直接使用会拿到 Promise 对象本身。
  **解法**：分别写 `await params`、`await props.id`（再 `Number()`）、`await id`。见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条。

- **现象**：`app/sitemap.ts` 里写 `new Date()`，以为会每次请求都变。
  **原因**：元数据文件默认被缓存，构建期执行一次。
  **解法**：需要按请求变化时加请求时 API，或设 `revalidate`。

- **现象**：构建失败，提示 opengraph-image 文件过大。
  **原因**：`opengraph-image` 上限 8MB，`twitter-image` 上限 5MB。
  **解法**：压缩图片，或改用 `ImageResponse` 动态生成。

- **现象**：某个子路由的 OG 图不对，用的是根目录那张。
  **原因**：文件式元数据按目录就近优先，子目录里的同名文件才会覆盖上层。
  **解法**：把 `opengraph-image.jpg` 放到对应的路由段目录里。

- **现象**：`app/icon.tsx` 里想生成 favicon，框架报错。
  **原因**：`favicon` 不支持代码生成。
  **解法**：用 `icon.tsx`，或直接放静态 `favicon.ico`。

- **现象**：`ImageResponse` 里用了 `display: 'grid'`，生成的图布局全乱。
  **原因**：`ImageResponse` 只支持 flexbox 和一部分 CSS 属性。
  **解法**：改用 flex 布局重写。

- **现象**：`opengraph-image.tsx` 里 `readFile(join(process.cwd(), 'assets/...'))` 报文件不存在。
  **原因**：路径相对**项目根目录**，不是当前源文件。
  **解法**：确认文件确实在项目根的 `assets/` 下，或改成正确的相对路径。

- **现象**：`robots.ts` 里写了自定义指令，输出里没有。
  **原因**：非标准指令必须放在规则的 `other` 字段里，不能直接作为顶层键。
  **解法**：用 `other: { 'Request-Rate': '10/1m' }`。

- **现象**：`sitemap.ts` 里的 URL 是相对路径，搜索引擎报错。
  **原因**：sitemap 协议要求绝对 URL。
  **解法**：用 `BASE_URL` 常量拼绝对地址。

## 旧写法 vs 新写法

| 场景 | 旧 | 新（16.3） |
|---|---|---|
| `opengraph-image` 的 `params` | 同步对象 | **`await params`** |
| `icon` 的 `params` | 同步对象 | **`await params`** |
| `generateImageMetadata` 的 `id` | 同步值 | **`await id`** |
| `generateSitemaps` 的 `id` | 同步值 | **`await props.id`** |
| `robots.ts` 的非标准指令 | 无法配置 | **`other` 字段**（16.3 新增） |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条。

## API / 配置速查

| 文件 | 路由 | 说明 |
|---|---|---|
| `app/sitemap.ts` | `/sitemap.xml` | 站点地图 |
| `app/robots.ts` | `/robots.txt` | 爬虫规则 |
| `app/manifest.ts` | `/manifest.webmanifest` | Web App Manifest |
| `app/opengraph-image.(jpg\|png\|gif)` | — | 静态 OG 图 |
| `app/opengraph-image.tsx` | — | 动态生成 OG 图 |
| `app/twitter-image.(jpg\|png\|gif)` | — | 静态 Twitter 图 |
| `app/twitter-image.tsx` | — | 动态生成 Twitter 图 |
| `app/opengraph-image.alt.txt` | — | OG 图的 alt 文本 |
| `app/icon.(ico\|png\|svg)` / `app/icon.tsx` | `/icon` | 站点图标 |
| `app/apple-icon.(png\|jpg)` / `app/apple-icon.tsx` | `/apple-icon` | Apple Touch 图标 |
| `app/favicon.ico` | `/favicon.ico` | 仅根目录，仅静态 |

| 导出 | 用于 | 类型 |
|---|---|---|
| `default` | sitemap / robots / manifest / image | 返回对应结构或 `Response` |
| `generateSitemaps` | sitemap | `() => Array<{ id }>` |
| `generateImageMetadata` | image | `() => ImageMetadata[]` |
| `alt` | image | `string` |
| `size` | image | `{ width, height }` |
| `contentType` | image | `string` |

## 延伸阅读

- [官方文档：Metadata 文件约定总览](https://nextjs.org/docs/app/api-reference/file-conventions/metadata)
- [官方文档：sitemap.xml](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
- [官方文档：robots.txt](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots)
- [官方文档：manifest.json](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest)
- [官方文档：opengraph-image 与 twitter-image](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image)
- [官方文档：favicon、icon 与 apple-icon](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons)
- [官方文档：ImageResponse](https://nextjs.org/docs/app/api-reference/functions/image-response)
- [Sitemaps XML 协议](https://www.sitemaps.org/protocol.html)
