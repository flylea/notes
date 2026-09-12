# 17 · 重定向、重写与 headers

> **一句话结论**：能用 `next.config.ts` 里的 `redirects` / `rewrites` / `headers` 解决的，就不要写进 proxy——这三个配置在**构建期被静态分析并预编译**，执行时机在 proxy 之前，不消耗每次请求的 Node.js 执行时间。真正需要理解的是 `rewrites` 的 `beforeFiles` / `afterFiles` / `fallback` 三个阶段，它们分别插在文件系统检查的前、后、兜底位置。

## 最小可运行示例

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // 永久重定向：308，客户端与搜索引擎会缓存
      { source: '/old-blog/:slug', destination: '/blog/:slug', permanent: true },
      // 临时重定向：307，不缓存
      { source: '/beta', destination: '/', permanent: false },
    ]
  },

  async rewrites() {
    return [
      // 对外是 /pricing，实际渲染 /marketing/pricing，URL 不变
      { source: '/pricing', destination: '/marketing/pricing' },
    ]
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
```

三个键都接受同步或异步函数，返回数组即可。

## `redirects`：URL 会变

`redirects` 会告诉浏览器「你要的东西在别处」，浏览器地址栏会更新。

```ts
// next.config.ts
async redirects() {
  return [
    {
      source: '/post/:slug(\\d{1,})',   // 只匹配纯数字 slug
      destination: '/news/:slug',
      permanent: false,
    },
    {
      source: '/:path((?!another-page$).*)',
      has: [{ type: 'header', key: 'x-redirect-me' }],
      destination: '/another-page',
      permanent: false,
    },
  ]
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `source` | `string` | 传入请求路径模式，**必须以 `/` 开头** |
| `destination` | `string` | 目标路径，可引用 `source` 的命名参数 |
| `permanent` | `boolean` | `true` → 308；`false` → 307 |
| `basePath` | `false \| undefined` | 为 `false` 时匹配不含 `basePath`（仅用于外部重定向） |
| `locale` | `false \| undefined` | 为 `false` 时匹配不含 locale 前缀 |
| `has` | `Array<{ type, key?, value? }>` | 附加条件，必须全部满足 |
| `missing` | `Array<{ type, key?, value? }>` | 附加条件，必须全部不满足 |
| `statusCode` | `number` | 自定义状态码，**不能与 `permanent` 同时使用** |

### 为什么是 307 / 308 而不是 302 / 301

传统上 302 表示临时、301 表示永久。但很多浏览器在遇到这两个状态码时会把后续请求方法**改成 `GET`**：一个 `POST /v1/users` 收到 302 指向 `/v2/users` 后，浏览器可能发的是 `GET /v2/users`——请求方法和 body 都丢了。

307 和 308 就是为了显式保留请求方法而存在的。Next.js 默认用它们，是为了避免这类静默的方法降级。

### 路径匹配语法

| 模式 | 匹配 | 不匹配 |
|---|---|---|
| `/old-blog/:slug` | `/old-blog/first-post` | `/old-blog/a/b`（不支持嵌套） |
| `/blog/:slug*` | `/blog`、`/blog/a`、`/blog/a/b/c` | — |
| `/post/:slug(\\d{1,})` | `/post/123` | `/post/abc` |

修饰符：`*` 零个或多个、`+` 一个或多个、`?` 零个或一个。模式锚定在开头，`/old-blog/:slug` 不会匹配 `/archive/old-blog/first-post`。

`(`、`)`、`{`、`}`、`:`、`*`、`+`、`?` 这些字符在正则路径匹配里有特殊含义，要当字面量用必须加 `\\` 转义：

```ts
// next.config.ts
// 匹配请求 /english(default)/something
{ source: '/english\\(default\\)/:slug', destination: '/en-us/:slug' }
```

> **易错点**：`source` 和 `destination` 里，冒号前面一定要有斜杠。写成 `source: 'old-blog/:slug'` 会被当作字面字符串，可能导致无限重定向。

### 查询参数会被保留

`/old-blog/post-1?hello=world` 会重定向到 `/blog/post-1?hello=world`，查询参数自动透传。

### `has` / `missing` 的四种类型

| `type` | 匹配对象 |
|---|---|
| `header` | 请求头 |
| `cookie` | Cookie |
| `query` | 查询参数 |
| `host` | 请求主机名 |

`value` 可以是类正则字符串，并用命名捕获组把内容带进 `destination`：

```ts
// next.config.ts
{
  source: '/',
  has: [{ type: 'header', key: 'x-authorized', value: '(?<authorized>yes|true)' }],
  destination: '/home?authorized=:authorized',
  permanent: false,
}
```

### 与 i18n 配合的注意点

在 App Router 里，`redirects` 中的 locale 只能**硬编码**。需要按用户偏好动态决定语言时，得用动态路由段 + proxy（见第 26 章）。

```ts
// next.config.ts
async redirects() {
  return [
    // 手动写死 locale
    { source: '/en/old-path', destination: '/en/new-path', permanent: false },
    // 用参数匹配所有 locale
    { source: '/:locale/old-path', destination: '/:locale/new-path', permanent: false },
    // 指定多个 locale
    { source: '/:locale(en|fr|de)/:path*', destination: '/:locale/new-section/:path*', permanent: false },
  ]
}
```

## `rewrites`：URL 不变

`rewrites` 充当 URL 代理——用户看到的地址不变，实际返回的是另一个路径的内容。客户端路由同样生效：`<Link href="/about">` 会渲染 `/` 的内容，但地址栏保持 `/about`。

### 三个阶段的时序

`rewrites` 返回数组时，只会在「文件系统检查之后、动态路由之前」应用一次。返回对象时，可以精确控制插入位置：

```ts
// next.config.ts
async rewrites() {
  return {
    // 阶段 1：在 headers/redirects/proxy 之后，在所有文件之前
    beforeFiles: [
      {
        source: '/some-page',
        destination: '/somewhere-else',
        has: [{ type: 'query', key: 'overrideMe' }],
      },
    ],

    // 阶段 2：在 pages/public 检查之后，动态路由之前
    afterFiles: [
      { source: '/non-existent', destination: '/somewhere-else' },
    ],

    // 阶段 3：所有路由和静态资源都检查完之后，404 之前
    fallback: [
      { source: '/:path*', destination: 'https://my-old-site.com/:path*' },
    ],
  }
}
```

| 阶段 | 相对位置 | 典型用途 |
|---|---|---|
| `beforeFiles` | proxy 之后、文件系统之前 | 覆盖已存在的页面文件；按查询参数改写 |
| `afterFiles` | 文件系统之后、动态路由之前 | 把不存在的路径映射到真实路由 |
| `fallback` | 动态路由之后、404 之前 | 渐进迁移：未命中的全部转发给旧站点 |

### 完整执行顺序

```
1. next.config.ts 的 headers
2. next.config.ts 的 redirects
3. Proxy
4. beforeFiles rewrites
5. 静态文件（public/、_next/static/、非动态页面）
6. afterFiles rewrites
7. 动态路由（app/blog/[slug]/page.tsx）
8. fallback rewrites
9. 404
```

两条容易忽略的规则：

- **`beforeFiles` 匹配后不会立刻停下检查文件系统**，而是把整个 `beforeFiles` 列表走完。
- **`afterFiles` 里第一个能解析到静态文件、页面或动态路由的 rewrite 会被采用**，后面的不再试。

## `headers`：比 proxy 更早

`headers` 是链路上**第一个**被应用的。给整个站点加安全响应头时，它比 proxy 更合适。

```ts
// next.config.ts
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=()' },
      ],
    },
    {
      // 只给 API 加 CORS
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: 'https://example.com' },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
      ],
    },
  ]
}
```

`source` 支持与 `redirects` 相同的路径语法和 `has` / `missing` 条件：

```ts
// next.config.ts
{
  source: '/:path*',
  has: [{ type: 'header', key: 'x-preview' }],
  headers: [{ key: 'Cache-Control', value: 'no-store' }],
}
```

### 静态资源加缓存头

`public/` 里的文件不带内容哈希，直接给长期缓存会出问题。给它们一个短缓存，或者干脆用 `immutable` 的只给 `_next/static`（那里的文件名带哈希）：

```ts
// next.config.ts
async headers() {
  return [
    {
      source: '/_next/static/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
  ]
}
```

## 常见场景

### 多区域改写（multi-zone）

把多个 Next.js 应用挂在同一个域名下，用 `beforeFiles` 或 `afterFiles` 转发：

```ts
// next.config.ts —— 主站点
async rewrites() {
  return {
    afterFiles: [
      // /docs 下的请求全部转给文档站
      { source: '/docs', destination: 'https://docs.internal.example.com/docs' },
      { source: '/docs/:path*', destination: 'https://docs.internal.example.com/docs/:path*' },
    ],
  }
}
```

用 `afterFiles` 而不是 `beforeFiles`，是为了让主站点自己的 `/docs` 页面（如果有）优先命中。

### 渐进迁移到 Next.js

先用 `fallback` 把未迁移的路径全部转发给旧站点，逐个迁移完成后从列表里删掉：

```ts
// next.config.ts
async rewrites() {
  return {
    fallback: [
      { source: '/:path*', destination: 'https://legacy.example.com/:path*' },
    ],
  }
}
```

### CDN 前置时的注意事项

如果 CDN 在 Next.js 之前，`headers` 里设置的响应头可能被 CDN 覆盖或缓存。两个实际影响：

1. **`redirects` 的 308 会被 CDN 长期缓存**。改目标地址时，CDN 上的旧规则不会自动失效。
2. **重写目标的外部服务返回的 `Cache-Control`** 会被 CDN 采用，可能让本应动态的内容被缓存住。

排查时先用 `curl -I` 直连源站，再对比经过 CDN 的结果，确认是哪一层在改。

### 带 `basePath` 时的自动前缀

```ts
// next.config.ts
const nextConfig: NextConfig = {
  basePath: '/docs',
  async redirects() {
    return [
      // 自动变成 /docs/with-basePath
      { source: '/with-basePath', destination: '/another', permanent: false },
      // basePath: false 时不加前缀，用于跳外站
      {
        source: '/without-basePath',
        destination: 'https://example.com',
        basePath: false,
        permanent: false,
      },
    ]
  },
}
```

## 常见坑

- **现象**：配置了重定向，本地测试没问题，上线后 CDN 上仍然是旧目标。
  **原因**：`permanent: true` 用的是 308，浏览器和 CDN 都会长期缓存。
  **解法**：还在调试阶段一律用 `permanent: false`（307），确认稳定后再改 308；同时清理 CDN 缓存。

- **现象**：`/old-blog/:slug` 这类重定向出现无限循环，浏览器报 `ERR_TOO_MANY_REDIRECTS`。
  **原因**：`source` 或 `destination` 的冒号前漏了斜杠，路径被当作字面字符串处理。
  **解法**：写成 `/old-blog/:slug` 而不是 `old-blog/:slug`。

- **现象**：`rewrites` 里配了 `/about` → `/`，但访问 `/about` 还是 404。
  **原因**：`rewrites` 返回的是**数组**时只在「文件系统之后、动态路由之前」应用一次；如果 `/about` 被别的东西先接管了就不会走到。
  **解法**：改用对象形式，把这条放进 `beforeFiles`。

- **现象**：`afterFiles` 里配了两条规则，第二条永远不生效。
  **原因**：`afterFiles` 里第一个能解析成功的 rewrite 就被采用，后面的不再尝试。
  **解法**：把更具体的规则放前面，或拆分到不同阶段。

- **现象**：给 `public/` 里的文件加了 `max-age=31536000, immutable`，替换文件后用户还是拿到旧的。
  **原因**：`public/` 里的文件名不带内容哈希，`immutable` 让浏览器完全不回源验证。
  **解法**：`public/` 用短缓存；需要长期缓存的资源放到 `import` 流程里让打包器加哈希。

- **现象**：`headers` 里设的安全头在浏览器里看不到。
  **原因**：CDN 或反向代理覆盖了同名的响应头，或者 CDN 缓存了一份没有该头的旧响应。
  **解法**：`curl -I` 直连源站确认源站有头，再逐层往上看哪一层丢的。

- **现象**：想按用户语言重定向，写进 `redirects` 后发现拿不到 `Accept-Language`。
  **原因**：`redirects` 在构建期静态分析，无法访问请求级信息。
  **解法**：按 locale 的动态重定向必须放 proxy，见第 26 章。

- **现象**：`statusCode` 和 `permanent` 同时写了，配置报错。
  **原因**：两者互斥。
  **解法**：只保留一个。为了兼容 IE11 之类老客户端才需要 `statusCode`，此时框架会自动补 `Refresh` 头。

## 旧写法 vs 新写法

| 场景 | 旧（13/14） | 新（16.3） |
|---|---|---|
| 读配置的函数签名 | `async redirects()` 返回数组 | 同样支持，但优先用对象形式精确控制 `rewrites` 阶段 |
| 配置文件 | `next.config.js` | **`next.config.ts` 原生支持** |
| 动态重定向 | 写在 `middleware.ts` | 写在 **`proxy.ts`** |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 1 条。

## API / 配置速查

| 键 | 返回类型 | 执行时机 |
|---|---|---|
| `headers()` | `Array<{ source, headers, has?, missing? }>` | 链路上第 1 位 |
| `redirects()` | `Array<{ source, destination, permanent, ... }>` | 链路上第 2 位 |
| `rewrites()` → 数组 | `Array<{ source, destination }>` | 文件系统之后、动态路由之前 |
| `rewrites()` → 对象 | `{ beforeFiles?, afterFiles?, fallback? }` | 三个阶段分别插入 |

| 概念 | 地址栏 | 状态码 |
|---|---|---|
| redirect | 变 | 307 / 308（或 `statusCode`） |
| rewrite | 不变 | 200（内容来自别的路径） |

| 修饰符 | 含义 |
|---|---|
| `:name` | 单个路径段 |
| `:name*` | 零个或多个段 |
| `:name+` | 一个或多个段 |
| `:name?` | 零个或一个段 |
| `:name(\\d+)` | 括号内为正则 |

## 延伸阅读

- [官方文档：redirects 配置](https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects)
- [官方文档：rewrites 配置](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)
- [官方文档：headers 配置](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers)
- [官方文档：basePath 配置](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath)
- [path-to-regexp 语法](https://github.com/pillarjs/path-to-regexp)
