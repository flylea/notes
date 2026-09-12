# 16 · Proxy（原 Middleware）

> **一句话结论**：Next.js 16 起 `middleware.ts` 改名为 `proxy.ts`，导出函数名从 `middleware` 改成 `proxy`，运行时**固定为 Node.js**——在 proxy 文件里写 `runtime` 配置会直接报错。更关键的是定位变了：它是**明确的网络边界**，不是「万能拦截层」，官方明确说它**不能作为完整的会话管理或授权方案**，Server Function 内部必须独立鉴权。

## 最小可运行示例

```ts
// proxy.ts —— 与 app/ 同级
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 只在 /dashboard 下做一次「乐观检查」，真正的鉴权在页面/Server Function 里
  const session = request.cookies.get('session')?.value
  if (pathname.startsWith('/dashboard') && !session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
```

文件位置：项目根目录（或 `src/` 内），与 `app/` 或 `pages/` 同级。**一个项目只支持一个 proxy 文件**——这是刻意的约束，避免多层代理互相覆盖、也避免性能上多跳。

## 改名：`middleware` → `proxy`

| | 旧（13/14） | 新（16.3） |
|---|---|---|
| 文件名 | `middleware.ts` | **`proxy.ts`** |
| 导出函数名 | `middleware` | **`proxy`** |
| 运行环境 | 可配 `runtime = 'edge'` | **固定 Node.js** |

官方给的迁移 codemod：

```bash
npx @next/codemod@canary middleware-to-proxy .
```

它会同时改文件名和函数名：

```ts
// middleware.ts → proxy.ts
- export function middleware() {
+ export function proxy() {
```

详细对照见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 1 条，本章不重复解释。

### 为什么改名

官方给的理由是「middleware」这个词被 Express 污染了——一提到中间件，人们就想到「一层套一层的函数管道」，于是倾向于往里塞越来越多逻辑。而这个特性的真实行为是：**站在应用前面的网络边界**，在请求到达应用之前处理它，甚至可以在应用主运行时之外运行。`proxy` 这个词更贴合它的实际位置，也暗示了「它应该很薄」。

### runtime 固定为 Node.js

```ts
// proxy.ts
// 这行会直接报错：runtime 配置项在 proxy 文件中不可用
export const runtime = 'edge'
```

`runtime` 配置在 proxy 文件里**不被支持，写了会抛错**。Proxy 默认且只运行在 Node.js runtime。

如果你确实需要 Edge runtime，只能继续用 `middleware.ts`——它仍然可用，但**已废弃**，未来版本会移除。

| 部署方式 | Proxy 是否支持 |
|---|---|
| Node.js server | 支持 |
| Docker container | 支持 |
| Static export | 不支持 |
| Adapters | 视平台而定 |

## matcher：proxy 的执行范围

**不写 `matcher` 时，proxy 会在每一个请求上运行**——包括 `_next/static` 的静态文件、`_next/image` 的图片优化请求、以及 `public/` 里的所有资源。这是最容易出事的地方：一段鉴权逻辑可能顺手把 CSS 和 JS 也拦了。

所以负向匹配几乎总是必需的：

```ts
// proxy.ts
export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - api        （API 路由）
     * - _next/static（静态文件）
     * - _next/image （图片优化）
     * - favicon.ico / sitemap.xml / robots.txt（元数据文件）
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
```

### 路径语法

`source` 遵循 `path-to-regexp` 规则：

| 写法 | 含义 |
|---|---|
| `/about` | 精确匹配 `/about`，也匹配 `/about/team`（锚定开头） |
| `/about/:path` | 匹配 `/about/a`，**不**匹配 `/about/a/b` |
| `/about/:path*` | `*` = 零个或多个段 |
| `/about/:path+` | `+` = 一个或多个段 |
| `/about/:path?` | `?` = 零个或一个段 |
| `/about/(.*)` | 括号内为正则，等价于 `/about/:path*` |

模式**锚定在路径开头**：`/about` 会匹配 `/about` 和 `/about/team`，但不会匹配 `/blog/about`。

> **注意**：`matcher` 的值**必须是常量字面量**。写成变量或拼接字符串会被构建期静态分析忽略，等于没配。

### 对象形式的 matcher：`has` / `missing` / `locale`

需要更精细的条件时，用对象数组：

```ts
// proxy.ts
export const config = {
  matcher: [
    {
      source: '/api/:path*',
      // locale: false → 路径匹配时忽略 locale 前缀
      locale: false,
      // has：这些条件必须全部满足
      has: [
        { type: 'header', key: 'Authorization', value: 'Bearer Token' },
        { type: 'query', key: 'userId', value: '123' },
      ],
      // missing：这些条件必须全部不满足
      missing: [{ type: 'cookie', key: 'session', value: 'active' }],
    },
  ],
}
```

| 键 | 类型 | 说明 |
|---|---|---|
| `source` | `string` | 路径或模式 |
| `locale` | `boolean` | 设为 `false` 时忽略基于 locale 的路由前缀 |
| `has` | `Array<{ type, key?, value? }>` | `type` 取 `header` / `cookie` / `query` |
| `missing` | `Array<{ type, key?, value? }>` | 语义同 `has`，但要求不匹配 |

**应用条件**：`source` 匹配，且所有 `has` 项都匹配，且所有 `missing` 项都不匹配。

一个实用场景是跳过客户端预取，避免 proxy 在用户还没真正访问时就被触发：

```ts
// proxy.ts
export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
```

### 一个反直觉的例外：`_next/data` 拦不住

即使你在负向匹配里排除了 `_next/data`，proxy **仍然会对 `_next/data` 路由执行**。这是有意为之：

```ts
// proxy.ts
export const config = {
  // 尽管排除了 _next/data，Proxy 依然会对 /_next/data/* 运行
  matcher: '/((?!api|_next/data|_next/static|_next/image|favicon.ico).*)',
}
```

原因是安全：如果你保护了某个页面却忘了保护它对应的数据路由，攻击者可以直接请求数据接口绕过保护。框架选择在这里「不听话」，把安全边界补齐。

## 执行顺序：全链路

这是理解 proxy 定位的关键——它只是链路上的一环，而且**不是第一环**：

```
1. next.config.ts 的 headers
2. next.config.ts 的 redirects
3. Proxy（rewrites / redirects / 直接响应）
4. next.config.ts 的 beforeFiles rewrites
5. 文件系统路由（public/、_next/static/、pages/、app/）
6. next.config.ts 的 afterFiles rewrites
7. 动态路由（/blog/[slug]）
8. next.config.ts 的 fallback rewrites
```

由此推出三条实用结论：

1. **`headers` 和 `redirects` 比 proxy 更早**。能用配置解决的简单重定向，不该用 proxy。
2. **`beforeFiles` 在 proxy 之后**。想在文件系统之前改写、又要覆盖 proxy 的结果，才用 `beforeFiles`。
3. **`fallback` 在最后**，是「全部没匹配上就转发给老站点」的兜底位置，适合渐进迁移。

### Server Function 不是独立路由

这是执行顺序里最隐蔽的一点：

> Server Functions 在这条链里**不是独立路由**。它们被当作「对使用它们的那个路由的 POST 请求」处理。

后果是：**proxy 的 matcher 排除了某条路径，那条路径上的 Server Function 调用也会被跳过**。

```ts
// proxy.ts
export const config = {
  // 排除了 /admin，意味着 /admin 页面里的所有 Server Function 都不会经过 proxy
  matcher: ['/((?!api|admin|_next).*)'],
}
```

于是会出现这种情况：你在 proxy 里写了鉴权，测试时一切正常；后来有人改了 matcher，或者把一个 Server Action 挪到了别的路由下，鉴权就被**静默移除**了——没有报错，没有警告。

## 安全铁律：proxy 不是授权方案

官方原文的措辞很直接：

> Proxy 可以用于**乐观检查**（optimistic checks），例如基于权限的重定向，但**不应**作为完整的会话管理或授权方案。

「乐观检查」的含义是：proxy 里的判断只是**为了用户体验**——让未登录用户别看到闪一下的骨架屏，直接跳到登录页。它**不是**安全边界。

正确做法是**双层**：

```ts
// proxy.ts —— 第一层：乐观检查，只负责体验
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has('session')
  if (request.nextUrl.pathname.startsWith('/admin') && !hasSession) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = { matcher: ['/admin/:path*'] }
```

```ts
// app/admin/actions.ts —— 第二层：真正的授权，必须存在
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession, canDelete } from '@/lib/auth'

export async function deleteUser(userId: string) {
  // 每个 Server Function 内部独立鉴权，不依赖 proxy
  const session = await verifySession((await cookies()).get('session')?.value)
  if (!session) redirect('/login')
  if (!canDelete(session, userId)) throw new Error('Forbidden')

  await db.user.delete({ where: { id: userId } })
}
```

同样地，页面本身也要能独立挡住越权访问——因为页面可能被直接请求，或者 matcher 被改过。

**为什么必须这样**：proxy 的判断基于「请求里带了什么」，而授权需要判断「这个身份能不能对这个资源做这个操作」。后者需要访问数据库、需要知道资源归属，这些都不该在 proxy 里做（官方明确说 proxy 不应用于慢速数据获取）。

## 在 proxy 里 `fetch`：缓存选项全部无效

```ts
// proxy.ts
// 这两个 fetch 选项在 Proxy 中完全无效
await fetch('https://example.com/api', {
  cache: 'force-cache',        // 无效
  next: { revalidate: 60 },    // 无效
  next: { tags: ['posts'] },   // 无效
})
```

原因：proxy 在渲染管线之外执行，不参与 Next.js 的数据缓存体系。官方文档原文是「Using fetch with `options.cache`, `options.next.revalidate`, or `options.next.tags`, has no effect in Proxy」。

这也意味着 proxy 里的 `fetch` **每次请求都会真的发出去**。如果你在里面查数据库或调外部 API，每个请求都会增加一段延迟——这正是官方说「Proxy 不应依赖共享模块或全局变量」「不应用于慢速数据获取」的实际含义。

## 简单重定向：优先用 `next.config.ts`

官方在 Use cases 里明确写了：

> 对于简单的重定向，先考虑用 `next.config.ts` 的 `redirects` 配置。只有当需要访问请求数据或更复杂的逻辑时，才用 Proxy。

```ts
// next.config.ts —— 这类静态映射不需要 proxy
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/old-blog/:slug', destination: '/blog/:slug', permanent: true },
    ]
  },
}

export default nextConfig
```

判断标准：

| 场景 | 用哪个 |
|---|---|
| 固定的旧路径 → 新路径映射 | `next.config.ts` 的 `redirects` |
| 需要读 cookie / header 才能决定 | proxy |
| 需要根据用户语言重写 | proxy（见第 26 章） |
| 需要 A/B 实验分流 | proxy |
| 需要在响应上加安全头 | `next.config.ts` 的 `headers`（比 proxy 更早执行） |

原因不只是「配置比代码简单」：`redirects` 在构建期就被静态分析、可以预编译成跳转表，不消耗每次请求的 Node.js 执行时间。

## NextResponse 常用能力

```ts
// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  // 1. 重定向
  // return NextResponse.redirect(new URL('/home', request.url))

  // 2. 重写：URL 不变，内容换成另一个路由的
  // return NextResponse.rewrite(new URL('/internal/home', request.url))

  // 3. 透传请求头给上游
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-tenant', 'acme')
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // 4. 设置响应头与 cookie
  response.headers.set('x-proxy-ran', '1')
  response.cookies.set('seen', '1', { httpOnly: true, sameSite: 'lax' })

  return response
}
```

两个容易写错的地方：

- 给**上游**传头用 `NextResponse.next({ request: { headers } })`。写成 `NextResponse.next({ headers })` 会把头暴露给**客户端**，语义完全不同。
- 不要塞过大的 header，会触发 `431 Request Header Fields Too Large`。

### 第二个参数：`event.waitUntil`

```ts
// proxy.ts
import type { NextFetchEvent, NextRequest } from 'next/server'

export function proxy(request: NextRequest, event: NextFetchEvent) {
  // 响应发送后仍继续执行的后台任务，适合日志、埋点
  event.waitUntil(
    fetch('https://example.com/log', {
      method: 'POST',
      body: JSON.stringify({ pathname: request.nextUrl.pathname }),
    })
  )
  return NextResponse.next()
}
```

`waitUntil` 让 promise 在响应返回后继续存活，不会阻塞用户。用类型简写可以省掉手写参数类型：

```ts
// proxy.ts
import type { NextProxy } from 'next/server'

export const proxy: NextProxy = (request, event) => {
  event.waitUntil(Promise.resolve())
  return Response.json({ pathname: request.nextUrl.pathname })
}
```

注意：proxy 也可以直接返回 `Response`（不必是 `NextResponse`）来短路请求：

```ts
// proxy.ts
export function proxy(request: NextRequest) {
  if (!request.headers.has('x-api-key')) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
}
```

## 常见坑

- **现象**：升级到 16 后，`middleware.ts` 里的代码不执行了。
  **原因**：文件名和导出函数名都不对——16 期望 `proxy.ts` + `export function proxy`。
  **解法**：跑 `npx @next/codemod@canary middleware-to-proxy .`，或手工改名。

- **现象**：在 `proxy.ts` 里写 `export const runtime = 'edge'`，启动直接报错。
  **原因**：`runtime` 配置项在 proxy 文件中不被支持，Proxy 固定 Node.js runtime。
  **解法**：删掉这行。确实需要 Edge 时，退回 `middleware.ts`（已废弃，未来会移除）。

- **现象**：加了 proxy 之后，页面样式全丢，控制台报 CSS 文件 307 跳转。
  **原因**：没配 `matcher`，proxy 在**所有请求**上运行，把 `_next/static` 里的资源也一起重定向了。
  **解法**：加负向匹配 `'/((?!api|_next/static|_next/image|favicon.ico).*)'`。

- **现象**：proxy 里读到的 `request.cookies` 是空的，但浏览器明明带着 cookie。
  **原因**：matcher 里加了 `has` / `missing` 条件，请求被过滤掉了，proxy 根本没运行。
  **解法**：临时去掉 `has` / `missing` 验证，或把条件放宽后再逐步收紧。

- **现象**：在 proxy 里 `fetch` 加了 `next: { revalidate: 60 }`，但每次请求还是真的打出去。
  **原因**：`cache` / `next.revalidate` / `next.tags` 在 Proxy 中无效。
  **解法**：把数据获取移出 proxy，放到页面或 Route Handler 里，那里缓存才生效。

- **现象**：改了一次 matcher 之后，某个后台页面的鉴权失效了，但没有任何报错。
  **原因**：Server Function 不是独立路由，它跟随宿主路由的匹配结果；matcher 排除该路径后，proxy 和其中的鉴权一起被跳过。
  **解法**：永远在 Server Function 和页面内部做独立鉴权，不把 proxy 当唯一防线。

- **现象**：proxy 里查了数据库做权限判断，页面首字节时间明显变长。
  **原因**：proxy 在渲染之前同步执行，且其中的 `fetch` 不受缓存影响，每个请求都实打实跑一次。
  **解法**：proxy 只做基于请求头 / cookie 的轻量判断，数据查询下沉到页面或 Server Function。

- **现象**：`NextResponse.next({ headers })` 之后，客户端能读到本该只在服务端用的头。
  **原因**：`headers` 直接写在顶层会作用于**响应**，暴露给客户端。
  **解法**：给上游传头必须写成 `NextResponse.next({ request: { headers } })`。

- **现象**：重定向逻辑写在 proxy 里，但静态导出（`output: 'export'`）时报错。
  **原因**：Proxy 不支持 static export。
  **解法**：改用 `next.config.ts` 的 `redirects`，或在托管平台侧配置重定向。

## API / 配置速查

| 项 | 值 / 签名 | 说明 |
|---|---|---|
| 文件名 | `proxy.ts` / `proxy.js` | 项目根或 `src/` 下，与 `app/` 同级 |
| 自定义 `pageExtensions` 时 | `proxy.page.ts` | 跟随 `pageExtensions` |
| 导出 | `export function proxy(req, event?)` 或 `export default` | 只能导出**一个** proxy 函数 |
| `config.matcher` | `string \| string[] \| Array<{ source, locale?, has?, missing? }>` | 值必须是常量 |
| `request` | `NextRequest` | `nextUrl`、`cookies`、`headers` |
| `event` | `NextFetchEvent` | 只有 `waitUntil(promise)` |
| `NextProxy` | 全局类型 | 自动推导参数类型 |
| `runtime` | **不可用** | 设置即报错 |
| `skipProxyUrlNormalize` | `boolean` | 关闭 URL 规范化 |
| `skipTrailingSlashRedirect` | `boolean` | 关闭自动尾斜杠重定向 |
| `fetch` 的 `cache` / `next.revalidate` / `next.tags` | **无效** | proxy 不参与数据缓存 |

## 延伸阅读

- [官方文档：Proxy（Getting Started）](https://nextjs.org/docs/app/getting-started/proxy)
- [官方文档：proxy.js 文件约定](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [官方文档：Authentication 指南](https://nextjs.org/docs/app/guides/authentication)
- [官方文档：Content Security Policy（proxy + nonce）](https://nextjs.org/docs/app/guides/content-security-policy)
- [官方文档：NextResponse](https://nextjs.org/docs/app/api-reference/functions/next-response)
- [官方文档：next.config.js 的 redirects](https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects)
