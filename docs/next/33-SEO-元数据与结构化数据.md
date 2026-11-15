# 第 33 章 SEO：元数据与结构化数据

这一章讲 Next.js 的元数据系统。它决定搜索引擎、社交平台和浏览器打开你的页面时，看到的是标题、摘要、缩略图，还是一行光秃秃的网址。

需要这项能力的原因很直接。同一个 URL，用户可能从搜索结果、从 Slack 消息、从微信、从浏览器标签页四个地方打开，每处显示的形态都来自页面头部的几十行标签。这些标签写错不会报错，页面照样能跑，只是分享出去很难看，收录效果差。

涉及四组概念。Metadata API 负责声明式地写这些标签；`metadataBase` 与 `title.template` 负责把相对路径和标题拼成绝对地址；文件约定用命名规则代替配置；JSON-LD 是另一套标签，格式不同，给机器读结构化数据。

## 33.1 头部标签的来源

HTML 的 `<head>` 里可以放 `title`、`meta`、`link`，爬虫和抓取器读的是服务端返回的原始 HTML，不执行 JavaScript。多数社交平台的抓取器只看前若干 KB 的响应，而且不等待异步脚本。

三类消费方读的东西略有差别。搜索引擎读 `<title>`、`description`、`canonical` 和 JSON-LD；社交平台读 Open Graph 系列，微信、Slack、Twitter 各有自己的回退规则；浏览器读 `<title>` 和图标。一套标签要同时满足三方，就得把每方的必填项都写全。

社交平台的回退顺序也值得记一笔。页面没有 `og:title` 时，Slack 会退到 `<title>`；没有 `og:image` 时，有的平台抓页面里第一张大图，有的直接不显示图。这种“有时有、有时没有”的表现，根因通常是标签缺失加平台各自回退。

因此这些标签必须在服务端渲染时就出现在 HTML 里。客户端用 `useEffect` 改 `document.title` 的做法，对用户可见的标签页有效，对抓取器无效。

Next.js 提供三种写法，优先级从高到低：

1. 文件约定，例如同目录下放 `opengraph-image.png`。
2. `generateMetadata` 导出的函数返回值。
3. `metadata` 导出的对象。

同一段路由里，文件约定会覆盖代码里声明的同名字段。

最小的一份元数据写在根布局：

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Teamstack",
  description: "面向小团队的成员、文件与订阅管理后台。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

渲染出来的 HTML 里有 `<title>Teamstack</title>` 和 `<meta name="description" ...>`。除此之外还有两个标签由框架自动补上：`<meta charset="utf-8">` 和 `<meta name="viewport" content="width=device-width, initial-scale=1">`。

类型标注有用。`Metadata` 这个类型会检查字段名，`openGraph.type` 写成 `"webiste"` 这类拼错会直接报类型错误，`as const` 也能避免字符串被推断成 `string`。这些错误在构建时就暴露，比上线后从分享卡片上发现要早得多。

`keywords` 字段可以写，但主流搜索引擎已经忽略它。`description` 仍然有用，搜索结果里的摘要多来自它。

## 33.2 Metadata API 的规则

`metadata` 与 `generateMetadata` 都只能在服务端组件里导出。在带 `"use client"` 的文件里写 `export const metadata` 会直接报错。

同一段路由不能同时导出两者。需要按参数计算标题时用函数，其余情况用对象。

替换的范围按顶层字段算。子段写 `openGraph`，父段的 `openGraph` 整个被替换；子段写 `robots`，父段的 `robots` 整个被替换。想保留父级内容，就得在子段里重复写一遍。

父子段的字段是浅合并。子段写了 `openGraph`，父段的 `openGraph` 整块被替换，不会逐字段合并。`robots`、`alternates`、`icons` 同理。这一点容易踩：根布局里配好了 OG 图，某个子页面只想改 `title`，结果顺手加了个 `openGraph: { title }`，图片就没了。

常写的字段与输出对应关系：

| 字段 | 输出标签 | 备注 |
| --- | --- | --- |
| `title` | `<title>` | 字符串，或 `{ default, template, absolute }` |
| `description` | `<meta name="description">` | 保持 155 字符以内 |
| `openGraph` | `og:title`、`og:image` 等 | 图片走数组，每项含 `url`、`width`、`height`、`alt` |
| `twitter` | `twitter:card` 等 | `card` 常写 `summary_large_image` |
| `robots` | `<meta name="robots">` | 另可配 `googleBot` 单独控制 |
| `alternates` | `<link rel="canonical">` | 也可写多语言版本 |

`twitter.card` 有两个常用值。`summary` 是方形小图，`summary_large_image` 是横版大图，后者在信息流里占的面积更大。选了 `summary_large_image` 就要保证图片至少 1200×630，否则会被裁成奇怪的比例。

`robots` 的语义要分清。`index: false` 是别收录这个页面，`follow: false` 是别顺着页面里的链接继续抓。只想让页面不出现，但希望链接权重传出去，用 `{ index: false, follow: true }`。`googleBot` 可以单独再细一层，`max-image-preview: "large"` 允许搜索结果里显示大图预览。

`viewport` 与 `themeColor` 从 Next.js 14 起移出了 `metadata`，改用单独的 `viewport` 导出：

```tsx
// src/app/layout.tsx
import type { Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#0f172a",
  colorScheme: "light dark",
};
```

写进 `metadata` 里不会报错，但也不会输出，属于静默失效，只能靠看源码发现。

要按请求算主题色时，导出 `generateViewport()` 函数，返回值结构与静态的 `viewport` 相同。它与 `generateMetadata` 一样只能在服务端组件里导出，用来读参数、读数据库之后再决定颜色。

## 33.3 metadataBase 与标题模板

`metadataBase` 解决相对路径的锚点问题。`openGraph.images` 常写成 `/og/team.png` 这样的相对路径，爬虫需要绝对地址，框架用 `metadataBase` 去拼。

```ts
// src/lib/site.ts
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const siteConfig = {
  name: "Teamstack",
  description: "面向小团队的成员、文件与订阅管理后台。",
  url: siteUrl,
  ogImage: "/og/default.png",
} as const;
```

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: "%s · Teamstack",
  },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    locale: "zh_CN",
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: siteConfig.name }],
  },
  twitter: { card: "summary_large_image" },
};
```

不配 `metadataBase` 却写了相对路径的 OG 图，构建时会直接失败，报错原文是：

```text
Error: metadataBase property in metadata export is not set for resolving social open graph
or twitter images, but no origin URL could be guessed.
```

配好之后，URL 的拼接规则是固定的：`/` 和 `./` 拼成站点根；`payments`、`/payments`、`./payments`、`../payments` 都拼成 `https://站点/payments`；写绝对地址则原样保留，`metadataBase` 被忽略。末尾斜杠会被归一化。

`metadataBase` 通常用环境变量给，本地开发是 `http://localhost:3000`，预览环境是预览域名，生产是正式域名。写死域名会让预览环境的分享卡片指向生产站。

标题模板只向子段传递。`title.template` 定义在 `(app)/layout.tsx`，只作用于它下面的页面，不作用于同层的 `page.tsx`。

```tsx
// src/app/(app)/layout.tsx
export const metadata: Metadata = {
  title: { default: "工作台", template: "%s · Teamstack" },
};
```

```tsx
// src/app/(app)/settings/page.tsx
export const metadata: Metadata = { title: "设置" };
```

页面标题输出为“设置 · Teamstack”。三条规则要记住：

- 有 `template` 就一定要有 `default`，否则构建报错。
- `template` 只往下传。写在 `page.tsx` 里没有效果，页面是路由的终止段。
- 某一页不想带后缀，用 `title: { absolute: "团队邀请" }`。

`%s` 是占位符。子页面没写 `title` 时，模板完全不生效，标题来自最近祖先的 `default`。

预览环境还有一处容易漏。Vercel 的预览部署有自己的域名，`metadataBase` 读的是环境变量，所以分享预览链接时卡片指向预览域名。如果变量只在生产环境配了，预览环境的 `metadataBase` 就退到 localhost，抓取器拿不到图。三个环境都要给这个变量。

描述同样会截断。搜索结果里显示约 155 个字符，移动端只有两行。写的时候把结论放前面，别指望用户点开再读。

## 33.4 文件约定：图标与 manifest

放在路由目录里的特定文件名会自动变成标签，不需要写代码。

`app/favicon.ico` 是浏览器标签页图标。`app/icon.svg` 或 `app/icon.png` 会生成 `<link rel="icon">`。`app/apple-icon.png` 生成苹果设备的主屏图标。`app/manifest.webmanifest` 或 `manifest.ts` 生成 PWA 清单。

```ts
// src/app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Teamstack",
    short_name: "Teamstack",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  };
}
```

图标标签的 URL 里带内容哈希，换了图之后地址自动变化，浏览器缓存自然失效。手写 `/icon.png` 的做法没有这层保证，换图后老用户可能还看到旧图。

同目录还可能放 `twitter-image`、`apple-icon`、`opengraph-image`。它们的命名规则一致，作用不同：`opengraph-image` 给 Facebook、LinkedIn 一类平台，`twitter-image` 给 X。

图标有尺寸要求。`icon` 用 32×32 或 48×48 的 PNG，`apple-icon` 用 180×180。尺寸不够会在高分屏上糊，通常的做法是给 SVG，两个尺寸的问题一起解决。`apple-icon` 不支持 SVG，必须给位图。

图标文件缺失时浏览器请求 `/favicon.ico` 得到 404，控制台会多一条红色记录。这条 404 不影响功能，但会混在真实报错里，排查时先把图标补上。

目录越深优先级越高。`app/icon.png` 和 `app/(app)/settings/icon.png` 都存在时，`/settings` 用后者。

文件约定赢过代码声明。同目录既有 `icon.png` 又有 `metadata.icons`，输出的是文件。

同一页面要输出多张尺寸不同的卡片图时，用 `generateImageMetadata()`。它从 `opengraph-image.tsx` 里导出，返回 `[{ id, size, contentType, alt }]`，默认导出的 `ImageResponse` 按 `id` 渲染不同版式，图片地址里带 `/<id>` 后缀。只出一张就用文件名约定，不必写这个函数。

## 33.5 generateMetadata：标题里有数据

页面标题需要带数据时，用 `generateMetadata`。它是异步函数，能读参数、能查库。

```tsx
// src/app/invite/[token]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getInvitationPreview } from "@/lib/invitations";

const getPreview = cache(getInvitationPreview);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const preview = await getPreview(token);

  if (!preview) {
    return { title: "邀请已失效" };
  }

  return {
    title: `加入 ${preview.teamName}`,
    description: `${preview.inviterName} 邀请你加入 ${preview.teamName}。`,
    robots: { index: false, follow: false },
    openGraph: {
      title: `加入 ${preview.teamName}`,
      description: `${preview.inviterName} 邀请你加入 ${preview.teamName}。`,
    },
  };
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await getPreview(token);
  if (!preview) notFound();
  return <main>邀请加入 {preview.teamName}</main>;
}
```

几条规则：

- `params` 和 `searchParams` 都是 Promise，必须 `await`。16.x 起写成 `params.token` 拿到的是 Promise 对象。
- `searchParams` 只在 `page.tsx` 里可用，`layout.tsx` 拿不到。
- 同一个请求里 `generateMetadata` 和页面组件会各调一次数据函数。用 React 的 `cache()` 包一层，两次调用只查一次库。
- 函数里可以调 `redirect()` 和 `notFound()`，效果和页面里一致。
- 别在里面做写操作或埋点。这个函数可能被预渲染、被预取、被抓取器触发。
- 带 token 的页面一律 `index: false`。邀请链接进搜索结果，等于把内部入口公开。

`generateMetadata` 抛出的异常会冒泡到最近的 `error.tsx`，表现是整个页面报错。查询失败要自己接住，返回一个兜底标题，别让一条数据库超时把页面打挂。

动态段的元数据可以继承。`generateMetadata` 写在 `[id]/layout.tsx` 里，它下面的页面默认用这份结果；某个页面要覆盖，在 `page.tsx` 再导出一次即可。层级越深，覆盖范围越小。

在客户端组件里调用 `redirect()` 是另一回事。`generateMetadata` 只在服务端跑，它里面的跳转发生在 HTML 发出之前，响应的状态码会是 307。页面组件里的 `redirect()` 也类似，但流式渲染开始之后再跳，只能靠客户端脚本兜底，体验差一截。

带缓存的函数也不要用请求相关的值做参数。`cache()` 的键是参数本身，把整个对象传进去，每次都是新键，去重失效。

`fetch` 在 `generateMetadata` 内部自动去重，不需要额外处理。只有直接查库、读文件的函数才需要 `cache()`。

## 33.6 canonical：哪个地址才算数

同一个页面可能通过多个地址访问：带不带尾斜杠、带不带查询参数、带不带 UTM。canonical 用来告诉搜索引擎哪个是主地址，权重归到一处。

```tsx
// src/app/pricing/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/pricing" },
};
```

输出的 `<link rel="canonical" href="https://teamstack.example.com/pricing">` 由 `metadataBase` 拼出完整地址。

分页列表的每一页都要自己声明，别都指向第一页。指向第一页等于告诉搜索引擎后面的内容不用收录。

canonical 和 `noindex` 不能同时用。一个说“这个地址是主地址”，另一个说“别收录”，指令冲突，搜索引擎会挑一个执行，结果不可控。

多语言站点还有 `alternates.languages` 这一层。每个语言版本声明所有语言版本加一个 `x-default`，搜索引擎才会把它们认成同一份内容的多个版本，避免当成重复内容。

本书的项目决定只做单语。原因是团队后台的用户群固定，多语言会带来路由前缀、语言检测、内容同步三套额外维护成本，收益抵不上。真要加语言，用 `/en`、`/zh` 这样的路径前缀，别用 cookie 自动重定向。cookie 方案下爬虫只看到一种语言，另一种永远收录不到。

canonical 也替代不了 301。内容已经迁走时，用 `redirect()` 做永久跳转；内容还在、只是多个入口时，才用 canonical。

## 33.7 sitemap.ts 与 robots.ts

sitemap 告诉搜索引擎有哪些页面，robots 告诉它哪些不要抓。

```ts
// src/app/sitemap.ts
import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteConfig.url}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${siteConfig.url}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteConfig.url}/docs`, changeFrequency: "weekly", priority: 0.7 },
  ];

  const res = await fetch(`${siteConfig.url}/api/public/changelog`, { cache: "no-store" });
  const posts: { slug: string; updatedAt: string }[] = res.ok ? await res.json() : [];

  const dynamicRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${siteConfig.url}/changelog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...dynamicRoutes];
}
```

`sitemap()` 是特殊的 Route Handler，产物在 `/sitemap.xml`。默认参与缓存，只有用了 `cookies()`、`headers()` 一类请求时 API 才转为动态。

几个容易写错的点：

- `url` 必须是绝对地址。写 `/pricing` 会输出一个无效的 sitemap 条目。
- `lastModified` 要真。全部写 `new Date()` 等于每次构建都告诉搜索引擎“全站更新了”，久了会被忽略。
- `changeFrequency` 只有七个合法值：`always`、`hourly`、`daily`、`weekly`、`monthly`、`yearly`、`never`。拼错会报类型错误。
- 单个 sitemap 最多 50,000 条 URL，超过要分片。

分片写法：

```ts
// src/app/products/sitemap.ts
import type { MetadataRoute } from "next";

export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }, { id: 2 }];
}

export default async function sitemap({
  id,
}: {
  id: Promise<number>;
}): Promise<MetadataRoute.Sitemap> {
  const page = await id;
  const start = page * 1000;
  const rows = await listProductSlugs(start, 1000);
  return rows.map((row) => ({
    url: `https://teamstack.example.com/products/${row.slug}`,
    lastModified: row.updatedAt,
  }));
}
```

产物在 `/products/sitemap/0.xml` 这样的地址下。注意 `id` 从 16.0.0 起是 Promise，要 `await`。

robots 的配置：

```ts
// src/app/robots.ts
import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard/", "/invite/"] },
      { userAgent: "GPTBot", disallow: "/" },
      { userAgent: "CCBot", disallow: "/" },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
```

`rules` 传数组时按 UA 分别输出。`*` 那一条放通配，后面两条单独禁止两个抓取器。`disallow` 是前缀匹配，写 `/dashboard` 会同时挡住 `/dashboard/settings`。

robots 里的 `disallow` 和页面里的 `noindex` 会打架。被 `disallow` 挡住的页面，爬虫根本读不到 `noindex`，这个指令也就不存在。想让某个页面从索引里消失，要么允许抓取并给 `noindex`，要么直接返回 401 或 404。

`crawlDelay` 用得很少，写大了会拖慢收录，一般交给搜索引擎自己控制。真需要限速的场景，是对方站点被大量抓取拖垮，那种情况用 `disallow` 更直接。

sitemap 超过 50,000 条要拆成多个文件，再用一个 sitemap 索引文件指过去。Next.js 用 `generateSitemaps` 生成的分片，索引文件需要自己写一个 `route.ts` 返回 XML。

预览环境应该整站禁止收录。判断放在 `robots.ts` 里，读环境变量，非生产环境返回 `disallow: "/"`。预览域名被收录进去，会和正式站产生大量重复内容，清理起来很麻烦。

配置完后把 sitemap 地址提交到 Google Search Console 和 Bing Webmaster Tools，否则搜索引擎只能自己慢慢发现。

## 33.8 动态 OG 图：ImageResponse

固定的一张 OG 图能看，但所有页面用同一张，点击率吃亏。`ImageResponse` 用 JSX 在服务端生成图片，每个页面一张。

```tsx
// src/app/api/og/route.tsx
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const font = await readFile(join(process.cwd(), "assets/NotoSansSC-Bold.otf"));

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("title") ?? "Teamstack";
  const title = raw.slice(0, 80);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "#0f172a",
          color: "#ffffff",
          fontFamily: "Noto Sans SC",
        }}
      >
        <div style={{ fontSize: 40, color: "#94a3b8" }}>Teamstack</div>
        <div style={{ fontSize: 72, lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: 32, color: "#cbd5e1" }}>teamstack.example.com</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "Noto Sans SC", data: font, style: "normal", weight: 700 }],
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  );
}
```

`ImageResponse` 从 `next/og` 导入，内部是 satori 加 resvg：JSX 先转 SVG，再栅格化。它只支持 flexbox 布局和一部分 CSS，`display: grid` 不支持，写了会塌成一行。圆角、渐变、绝对定位可用。

中文字体必须显式传入。默认字体没有汉字，输出全是方块。字体文件放仓库里，用 `readFile` 读，构建时会一起打包。一个常用做法是只保留 4,000 个常用汉字做子集，把 9MB 压到 1MB 以内。

这个路由是公开的，任何人都能带参数请求。参数要截断长度，最好再校验字符集，避免有人用超长标题消耗函数执行时间。

Twitter 卡片有独立的 `twitter` 字段。只写 `openGraph` 时，部分平台会拿 `og:*` 做回退，覆盖并不全。要稳，就把 `twitter.title`、`twitter.description`、`twitter.images` 也写一份。

`alt` 必须写。图片识别不出内容时，替代文本是唯一的描述来源，验收无障碍时也会检查这一项。写一句能说明图片内容的短句，别写“图片”两个字。缺少替代文本时，读屏软件会念出文件名，一串十六进制字符对用户没有任何帮助。

要按目录自动生成时，用文件约定：

```tsx
// src/app/pricing/opengraph-image.tsx
import { ImageResponse } from "next/og";

export const alt = "Teamstack 定价";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", fontSize: 96, color: "#0f172a" }}>定价</div>
    ),
    size,
  );
}
```

产物地址带哈希，页面自动获得 `og:image`、`og:image:alt`、`og:image:type`、`og:image:width`、`og:image:height` 五条标签。同目录放一个 `opengraph-image.alt.txt` 可以单独给替代文本。

静态图片的上限是 8MB，Twitter 图 5MB，超了构建失败。动态生成不看体积，看执行时间。

动态生成有成本。每次请求要跑一遍渲染和栅格化，字体越大越慢。页面少的时候影响可以忽略；文章类站点每篇一张图，缓存策略就必须一起设计，否则抓取器来一次就渲染一次。

两种写法怎么选：页面数量少、样式统一，用文件约定；标题带数据、要拼用户内容，用 Route Handler 加 `?title=` 参数。

## 33.9 JSON-LD 与转义

前面几节写的都是给人看的标签。JSON-LD 是给机器读的结构化数据，格式是 JSON，放在 `<script type="application/ld+json">` 里。搜索引擎用它理解“这是哪个组织、这是什么文章、评分多少”，有机会在结果页展示额外信息。

```tsx
// src/app/layout.tsx
const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Teamstack",
  url: "https://teamstack.example.com",
  logo: "https://teamstack.example.com/icon-512.png",
};

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Teamstack",
  url: "https://teamstack.example.com",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify([organization, website]) }}
        />
      </body>
    </html>
  );
}
```

这段代码有一个安全问题。`JSON.stringify` 不做 HTML 转义。团队名里如果有人写 `</script><img src=x onerror=alert(1)>`，序列化后原样落进 HTML，浏览器在 `</script>` 处提前结束脚本，后面的内容变成可执行的 HTML。

修法是把 `<` 换成 `\u003c`：

```tsx
// src/lib/json-ld.ts
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
```

`\u003c` 在 JSON 字符串里等价于 `<`，解析后语义不变，但 HTML 解析器不会把它当成标签开始。三个字符都要换，`>` 和 `&` 同理。

JSON-LD 可以和页面元数据共用同一份数据源。标题、描述、作者这些字段本来就查过一次，把对象拼好后分别喂给 `metadata` 和 `JsonLd` 组件，两处内容自然不会漂移。

三条规矩：

- 用原生 `<script>`，`next/script` 是给可执行 JS 用的，处理 JSON-LD 会引入不必要的调度。
- 数据必须真实。写不存在的评分、价格、库存，属于结构化数据作弊，会被人工处置。
- 按权限过滤。用户看不到的数据不要塞进 JSON-LD，页面源码是公开的。

字段名区分大小写。`@type`、`@context`、`datePublished` 都有固定写法，照着 schema.org 的定义抄，别按中文习惯改成小写。

常用的结构化数据只有几种。首页用 `Organization` 加 `WebSite`；文章页用 `Article`，带 `headline`、`datePublished`、`author`；层级深的站点加 `BreadcrumbList`；有问答的页面用 `FAQPage`。类型越多越难维护，先覆盖真正会被展示的那几类。

`Article` 的字段和页面上看得见的内容必须一致。`datePublished` 写错一天，搜索结果里显示的日期就错一天，用户点进来发现内容对不上。

类型可以用 `schema-dts` 包，`WithContext<Organization>` 这类类型能在编译期挡住拼错的字段名。验证用 Google 的 Rich Results Test，粘贴 URL 或源码，能看出哪条字段没被识别。

写完之后有一组固定的验证动作。把真实地址粘进 Slack 或微信，看卡片；用 `curl` 抓原始 HTML，搜 `og:` 开头的行；把地址粘进 Rich Results Test，看有没有被识别的结构化数据。三步都过，这一章的配置才算生效。

这三步都在部署之后做。本地开发环境抓取器访问不到，`localhost` 的卡片也永远出不来，验证必须用可公开访问的域名。

## 33.10 边界与失败模式

**未验证**：本章的 `curl`、`pnpm build` 输出与 Search Console、Rich Results Test 的检查结果来自官方文档与推算，本地没有可运行的 teamstack 实例，未逐条执行。

元数据的失败大多不报错，需要知道去哪看。

动态页的元数据是流式下发的。页面先出，`<head>` 里的部分标签在流后面才补。这样慢查询不会阻塞首屏。代价是部分抓取器看不到后半段。框架对 Twitterbot、Slackbot、Bingbot 这类只读前若干字节的抓取器会自动关掉流式，改成一并返回；名单可以用 `htmlLimitedBots` 配置覆盖。预渲染的页面本来就有完整 HTML，不走这条路。

合并是浅的。父段 `openGraph` 里的图片、`robots` 里的规则、`alternates` 里的语言，只要子段出现同名字段就整块被替换。改一个字段要复制整块。

`generateMetadata` 里的数据函数会被调用两次，一次为标签，一次为页面。忘了 `cache()`，接口请求翻倍。

OG 图有缓存。改完标题重新访问，看到的还是旧图，原因是响应头。调试时在地址后面挂版本号，确认逻辑对了再谈缓存策略。

`metadataBase` 用 `'use cache'` 包裹的函数返回时，`URL` 实例不能序列化，要 `toString()` 后返回。

构建时读不到数据库。`generateMetadata` 在预渲染阶段就会执行，那时连不上生产库。静态页的元数据用常量；动态页要么标成按请求渲染，要么保证查询在这种时机也能成功。

`generateMetadata` 里调 `cookies()` 或 `headers()` 会让页面退出静态预渲染，整个路由变成动态。这种转变只在构建输出里看得出来，`ƒ` 符号会替掉 `○`。

OG 图路由有执行时间上限。字体文件在模块顶层读一次是正确做法；每次请求都 `readFile`，高并发下会被这道上限截断。

图标和 OG 图属于文件约定，放进 `public/` 不会自动变成标签。`public/og.png` 只是普通静态文件，页面拿不到 `og:image`，除非在 `metadata` 里手写地址。

## 33.11 检查点

1. `curl -s localhost:3000 | grep -E "og:image|<title>"`，输出里能看到完整标题和绝对地址的 OG 图。相对地址说明 `metadataBase` 没生效。
2. `curl -s localhost:3000/sitemap.xml | head -20`，条目里的 URL 是绝对地址，指向真实存在的页面，`lastmod` 各不相同。
3. 打开 `/invite/任意不存在的 token`，源码里 `title` 是“邀请已失效”，并且有 `<meta name="robots" content="noindex">`。
4. 把团队名改成 `测试</script><img src=x>`,重新请求页面，源码里搜 `<img src=x` 找不到，能搜到 `\u003c/script`。
5. `curl -s localhost:3000/api/og?title=测试 | file -`，返回 `PNG image data, 1200 x 630`，中文没有方块。
6. 打开 Rich Results Test，粘贴首页 URL，Organization 与 WebSite 都被识别，无报错字段。

## 33.12 常见错误

1. 构建报 `metadataBase property in metadata export is not set`。 用了相对路径的 OG 图，却没配 `metadataBase`。在根布局里加 `metadataBase: new URL(站点地址)`。

2. 报 `You are attempting to export "metadata" from a component marked with "use client"`。 元数据只能在服务端组件导出。把 `export const metadata` 挪出客户端文件，或改成上层 layout 声明。

3. 标题还是父级的，或者出现了 `%s` 原文。 三个原因：模板写在 `page.tsx` 里不生效；有 `template` 没给 `default`；`%s` 拼错。把模板挪到 `layout.tsx`，补上 `default`。

4. 分享卡片有标题没图。 子页面写了 `openGraph` 但只给了标题，浅合并把父级的 `images` 覆盖掉了。子段要么不写 `openGraph`，要么把 `images` 一起写上。

5. `Cannot read properties of undefined (reading 'slug')`。 `params` 没 `await`。16.x 里它是 Promise，写成 `params.slug` 拿到的是 undefined。

6. OG 图里中文全是方块。 `ImageResponse` 没传字体，或者字体名与 `fontFamily` 对不上。用 `readFile` 读一个含汉字的字体文件，在 `fonts` 数组里给 `name`，在样式里用同一个名字。

还有一个常被忽略的细节：`<html lang>` 决定语言归属。写成固定的 `en` 而内容是中文，搜索引擎和读屏软件都会按英文处理，断词、朗读、语言筛选全都偏掉。根布局里按内容写 `zh-CN`。

## 33.13 这一章在做什么

这一章建立三件事：元数据的三种来源与优先级；`metadataBase` 加标题模板这套拼接规则；JSON-LD 是唯一需要手工转义的地方。

判断标准只有一条：把页面地址粘到 Slack 和搜索结果里看一眼，标题、摘要、图都对，标签才算写对。

下一章处理同一批页面的另外两个质量项：图片与字体，以及第三方脚本的加载顺序。
