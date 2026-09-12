# 34 · 静态导出

> **一句话结论**：`output: 'export'` 把每条路由编译成一个 HTML 文件放进 `out/`，产物可以扔到任何能托管静态文件的服务器上。代价是所有需要服务端的能力**全部不可用**——包括 Proxy、Server Actions、ISR、默认图片优化、Cookies、Headers/Redirects/Rewrites。判断标准很简单：**你的页面内容会不会因为「谁在请求」或「什么时候请求」而不同**。会，就别用静态导出。

## 最小可运行示例

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',

  // 可选：把 /me 变成 /me/ 并输出 /me/index.html
  // trailingSlash: true,

  // 可选：不自动把 /me 重定向到 /me/
  // skipTrailingSlashRedirect: true,

  // 可选：输出目录从 out 改成 dist
  // distDir: 'dist',
}

export default nextConfig
```

```bash
pnpm build
ls out/
# index.html  404.html  blog/  about/
```

产物是纯 HTML/CSS/JS。`out/` 可以直接扔给 S3、nginx、GitHub Pages、Cloudflare Pages。

## 支持与不支持

### 支持

**服务端组件照常工作**。构建时它们被完整执行一次，结果渲染成静态 HTML 和供客户端导航用的静态载荷：

```tsx
// app/page.tsx
export default async function Page() {
  // 这个 fetch 在 next build 期间跑一次
  const res = await fetch('https://api.example.com/items')
  const data = await res.json()
  return <main>{data.length} 条</main>
}
```

**客户端数据获取**用 SWR 之类的库：

```tsx
// app/other/page.tsx
'use client'

import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function Page() {
  const { data, error } = useSWR('https://jsonplaceholder.typicode.com/posts/1', fetcher)
  if (error) return 'Failed to load'
  if (!data) return 'Loading...'
  return data.title
}
```

注意这里的 `fetch` 是浏览器发的，不受静态导出限制——限制只作用于构建期和服务端。

**Route Handler 只能 `GET`，且必须显式声明静态**：

```ts
// app/data.json/route.ts
export const dynamic = 'force-static'

export async function GET() {
  return Response.json({ name: 'Lee' })
}
```

构建后生成 `data.json`，内容就是 `{ "name": "Lee" }`。用来在构建期把数据落成静态文件（JSON、TXT、RSS）很合适。

**图片优化**需要自定义 loader：

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    loader: 'custom',
    loaderFile: './my-loader.ts',
  },
}
export default nextConfig
```

```ts
// my-loader.ts
export default function cloudinaryLoader({
  src,
  width,
  quality,
}: {
  src: string
  width: number
  quality?: number
}) {
  const params = ['f_auto', 'c_limit', `w_${width}`, `q_${quality || 'auto'}`]
  return `https://res.cloudinary.com/demo/image/upload/${params.join(',')}${src}`
}
```

```tsx
// app/page.tsx
import Image from 'next/image'

export default function Page() {
  return <Image alt="turtles" src="/turtles.jpg" width={300} height={300} />
}
```

原理是把优化工作**外包给第三方服务**。默认的 `/_next/image` 端点需要一个能跑 Node.js 的服务端进程来做实时转码和缓存，静态托管上没有这个东西。

**浏览器 API** 只能在客户端访问——组件在构建时会被预渲染成 HTML，那时没有 `window`：

```tsx
// app/height.tsx
'use client'

import { useEffect } from 'react'

export default function Height() {
  useEffect(() => {
    // 这里才有 window
    console.log(window.innerHeight)
  }, [])
  return <p>看控制台</p>
}
```

### 不支持

以下特性在静态导出下**不可用**：

- 动态路由配 `dynamicParams: true`
- 动态路由**没有** `generateStaticParams()`
- 依赖 Request 的 Route Handler
- Cookies
- Rewrites
- Redirects
- Headers
- **Proxy**
- ISR（增量静态再生）
- 使用默认 `loader` 的图片优化
- Draft Mode
- Server Actions
- 拦截路由

在 `next dev` 下尝试用这些会直接报错，效果相当于在根布局设了 `export const dynamic = 'error'`。

## 为什么这些不可用

判断标准是**「构建时能不能算出结果」**。

**构建时能算的 → 支持。** 服务端组件在构建时执行一次，`fetch` 一次，渲染成 HTML。静态文件里没有「运行时」，所有东西在构建那一刻就定死了。

**依赖请求的 → 不支持。** 这类能力全都要读请求里的信息：

| 特性 | 依赖什么 |
|---|---|
| Cookies | 请求头里的 Cookie |
| Headers | 请求头 |
| Proxy | 每个请求都要过一遍，做重定向/改写/鉴权 |
| Redirects / Rewrites | 请求路径 → 目标路径的运行时映射 |
| Draft Mode | 请求里的草稿开关 |
| Server Actions | 请求体的 POST + 服务端执行 |
| ISR | 运行时的缓存失效和重新生成 |

**Server Actions 尤其值得单独说**：它不只是「不可用」，而是**整个数据写入路径都没了**。表单提交、点赞、删除——凡是需要写数据的交互都得换成「调外部 API」，由外部 API 负责落库。

**Proxy 在静态导出下完全没有替代品**。它的定位是「明确的网络边界」，用来做鉴权、重定向、改写。静态托管上这些职责只能交给 CDN 或反向代理的配置（nginx 的 `rewrite`、Cloudflare 的 Rules），而且能力比 Proxy 弱——那些配置不认识你的会话逻辑。

**动态路由需要一个明确的取舍**：

```tsx
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await getAllPosts()
  return posts.map((post) => ({ slug: post.slug }))
}
```

`generateStaticParams` 返回的所有 `slug` 会在构建时各生成一个 HTML。**没有列出来的 slug 访问时就是 404**——因为没有任何机制能按需生成。如果文章是持续新增的，每次新增都要重新构建部署。

`dynamicParams` 的默认值是 `true`，但在静态导出下必须是 `false`（因为 `true` 意味着「未列出的按需渲染」，而按需渲染需要服务端）。这个配置在静态导出下被移除，不是可选项。

## 适用场景与判断依据

### 适合

| 场景 | 理由 |
|---|---|
| 文档站、博客 | 内容变化频率低，重新构建可接受 |
| 营销页、落地页 | 纯展示，无个性化 |
| SPA 形态的应用 | 数据全靠客户端调 API |
| 内部工具（无服务端） | 前端为主，后端是独立的 API 服务 |
| 需要极低托管成本 | 静态托管最便宜，S3 + CDN 能扛很大流量 |

### 不适合

| 场景 | 理由 |
|---|---|
| 有登录态的个性化页面 | 需要 Cookies |
| 需要鉴权中间件 | Proxy 不可用 |
| 内容持续更新且要求即时可见 | ISR 不可用，每次更新都要重新构建 |
| 表单提交 / 数据写入 | Server Actions 不可用 |
| A/B 测试、地域化内容 | 依赖请求信息 |

### 判断清单

逐条问自己：

- [ ] 页面内容会不会因为「谁在请求」而不同？（登录态、权限、个性化推荐）
- [ ] 页面内容会不会因为「什么时候请求」而不同？（实时库存、价格、评论数）
- [ ] 有没有需要写数据的交互？（表单、点赞、删除）
- [ ] 有没有依赖请求头的逻辑？（鉴权、A/B、地域重定向）
- [ ] 内容更新后能不能接受「重新构建 + 重新部署」？
- [ ] 动态路由的路径集合是不是有限且可枚举的？

**六个问题里有任何一个答案是「会」或「不能」，就别用静态导出。** 反过来，全是「不会」和「能接受」的话，静态导出是最省心的选择——没有服务器要运维，没有缓存要协调，没有冷启动，托管成本接近零。

## 部署

```bash
pnpm build
# 产物在 out/
```

假设路由是 `/`、`/blog/[id]`（`generateStaticParams` 返回 `post-1`、`post-2`），构建后是：

```
out/index.html
out/404.html
out/blog/post-1.html
out/blog/post-2.html
```

nginx 配置：

```nginx
# nginx.conf
server {
  listen 80;
  server_name acme.com;

  root /var/www/out;

  location / {
      try_files $uri $uri.html $uri/ =404;
  }

  # trailingSlash: false 时需要这段
  # trailingSlash: true 时可以省略
  location /blog/ {
      rewrite ^/blog/(.*)$ /blog/$1.html break;
  }

  error_page 404 /404.html;
  location = /404.html {
      internal;
  }
}
```

`try_files $uri $uri.html $uri/` 这一行是关键：它让 `/blog/post-1` 能命中 `blog/post-1.html`。少了它，所有非首页都会 404。

GitHub Pages 用官方模板：[deploy-github-pages](https://github.com/nextjs/deploy-github-pages)。

## 常见坑

- **现象**：静态导出后想用 Proxy 做鉴权，构建直接失败。
  **原因**：Proxy 依赖每个请求，静态导出下完全没有运行时。
  **解法**：鉴权挪到 CDN 层（Cloudflare Access、Netlify Identity）或客户端 + 外部 API。**静态导出下没有等价替代品。**

- **现象**：动态路由页面部署后 404，本地 dev 正常。
  **原因**：`generateStaticParams` 没覆盖这个路径。dev 下会按需渲染，导出后不存在「按需」。
  **解法**：确保 `generateStaticParams` 枚举了所有需要的路径；或者换成 `output: 'standalone'` 走服务端。

- **现象**：`next/image` 报错说默认 loader 不可用。
  **原因**：默认 loader 依赖 `/_next/image` 这个运行时端点。
  **解法**：配 `images.loader: 'custom'` + `images.loaderFile`，把优化外包给 Cloudinary 之类的服务。

- **现象**：Route Handler 导出后返回 405 或空。
  **原因**：静态导出下 Route Handler 只支持 `GET`，且需要显式 `export const dynamic = 'force-static'`。
  **解法**：加 `force-static` 导出，并去掉 `POST` / `PUT` / `DELETE` 等写操作。

- **现象**：表单提交在静态导出下报错。
  **原因**：Server Actions 不可用。
  **解法**：表单改成 `action` 指向外部 API 端点，或者用客户端 fetch 提交。

- **现象**：部署到 nginx 后除首页外全部 404。
  **原因**：没配 `try_files`，nginx 找不到 `/blog/post-1` 对应的文件（实际文件名是 `blog/post-1.html`）。
  **解法**：加 `try_files $uri $uri.html $uri/ =404;`。

- **现象**：`trailingSlash` 配错导致路由跳来跳去。
  **原因**：`trailingSlash: false` 时 `/me` 会被重定向到 `/me/`，需要额外的 nginx rewrite 规则。
  **解法**：要么统一用 `trailingSlash: true`（输出 `/me/index.html`，nginx 配置更简单），要么配好 `skipTrailingSlashRedirect` 和 rewrite 规则。

## 旧写法 vs 新写法

| 场景 | 旧写法 | 新写法 |
|---|---|---|
| 静态导出 | `next export` 命令 | **`output: 'export'`**（14 起 `next export` 移除） |
| 输出目录 | 固定 `out` | `out`，可用 `distDir` 改 |
| 图片优化 | 默认 loader | **必须配自定义 loader** |
| 动态路由 | `getStaticPaths` + `getStaticProps` | `generateStaticParams` |

## API / 配置速查

| 配置 | 默认 | 说明 |
|---|---|---|
| `output: 'export'` | 未设 | 启用静态导出 |
| `trailingSlash` | `false` | `true` 时 `/me` → `/me/`，输出 `/me/index.html` |
| `skipTrailingSlashRedirect` | `false` | 不自动把 `/me` 重定向到 `/me/` |
| `distDir` | `'out'` | 输出目录 |
| `images.loader: 'custom'` | — | 用自定义 loader |
| `images.loaderFile` | — | loader 文件路径（相对项目根） |

| 特性 | 静态导出 |
|---|---|
| 服务端组件 | 支持（构建时执行） |
| 客户端数据获取 | 支持 |
| Route Handler | 仅 `GET` + `force-static` |
| 图片优化 | 仅自定义 loader |
| 浏览器 API | 支持（客户端组件内） |
| 动态路由 | 需 `generateStaticParams` 全覆盖 |
| Cookies / Headers | 不支持 |
| Proxy | **不支持** |
| Redirects / Rewrites / Headers | 不支持 |
| ISR | 不支持 |
| Draft Mode | 不支持 |
| Server Actions | 不支持 |
| 拦截路由 | 不支持 |

## 延伸阅读

- [官方文档：Static Exports](https://nextjs.org/docs/app/guides/static-exports)
- [官方文档：Deploying](https://nextjs.org/docs/app/getting-started/deploying)
- [官方文档：generateStaticParams](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)
- [官方文档：next/image loader](https://nextjs.org/docs/app/api-reference/components/image#loader)
- [官方文档：Single-Page Applications](https://nextjs.org/docs/app/guides/single-page-applications)
- [官方模板：deploy-github-pages](https://github.com/nextjs/deploy-github-pages)
- [官方示例：with-docker-export-output](https://github.com/vercel/next.js/tree/canary/examples/with-docker-export-output)
