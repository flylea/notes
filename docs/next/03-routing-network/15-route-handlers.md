# 15 · Route Handlers

> **一句话结论**：`app/**/route.ts` 是 App Router 里唯一能返回任意 HTTP 响应的入口——用 Web 标准的 `Request` / `Response` 写，**默认不缓存**，且**不能和同段的 `page.tsx` 共存**。判据很简单：外部系统主动打进来（webhook、移动端、第三方）或要返回非 HTML（JSON / XML / 文件 / 流）用它；自家组件改数据用 Server Actions。

## 最小可运行示例

```ts
// app/api/posts/route.ts
import type { NextRequest } from 'next/server'

// GET 默认在请求时执行，不缓存
export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? 10)
  const posts = await db.post.findMany({ take: limit })

  return Response.json({ posts })
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { title?: string }

  if (!body.title) {
    return Response.json({ error: 'title is required' }, { status: 400 })
  }

  const post = await db.post.create({ data: { title: body.title } })
  return Response.json({ post }, { status: 201 })
}
```

访问 `/api/posts` 就拿到 JSON。没有 `bodyParser` 配置，没有 `export default`，没有 `req.res` 那套 Node 风格对象——因为 Route Handler 的入参和返回值就是 Web 标准本身。

## 支持的 HTTP 方法

`route.ts` 可以导出七个函数：`GET`、`POST`、`PUT`、`PATCH`、`DELETE`、`HEAD`、`OPTIONS`。调用未导出的方法时返回 `405 Method Not Allowed`。

`OPTIONS` 是唯一有默认实现的——不导出它时，Next.js 会依据同文件里已定义的方法自动补上正确的 `Allow` 响应头：

```ts
// app/api/echo/route.ts
// 只定义了 GET，OPTIONS 由框架生成，Allow: GET, OPTIONS
export async function GET() {
  return Response.json({ ok: true })
}
```

### 动态路由参数

`context.params` 是 **Promise**，必须 `await`。TypeScript 下用全局可用的 `RouteContext` 辅助类型拿强类型：

```ts
// app/users/[id]/route.ts
import type { NextRequest } from 'next/server'

export async function GET(_req: NextRequest, ctx: RouteContext<'/users/[id]'>) {
  const { id } = await ctx.params
  return Response.json({ id })
}
```

`RouteContext` 不需要 import，类型在 `next dev`、`next build` 或 `next typegen` 期间生成。`params` 转 Promise 是 16 的全局变更，见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条。

## 缓存：默认不缓存，要缓存得显式声明

这是最容易踩错的地方。旧 App Router 里 `GET` 处理器**默认静态化**，从 15 起改成了默认动态，16 延续这一行为。

```ts
// app/items/route.ts
// 显式静态化：构建时执行一次，之后所有请求命中同一份结果
export const dynamic = 'force-static'

export async function GET() {
  const res = await fetch('https://data.example.com/items')
  return Response.json({ items: await res.json() })
}
```

关键细节：**只有 `GET` 可以缓存**。同一个文件里的 `POST` / `PUT` / `DELETE` 即使在缓存的 `GET` 旁边，也一律不缓存。

### 开启 Cache Components 之后

`cacheComponents: true` 时，`GET` 路由处理器的模型和普通 UI 路由完全一致——默认在请求时执行，不访问未缓存数据或运行时数据时可以预渲染，用 `use cache` 把未缓存数据纳入静态响应。

```ts
// app/api/products/route.ts
import { cacheLife } from 'next/cache'

export async function GET() {
  const products = await getProducts()
  return Response.json(products)
}

async function getProducts() {
  'use cache'
  cacheLife('hours')

  return await db.query('SELECT * FROM products')
}
```

`use cache` **不能直接写在 Route Handler 的函数体里**，必须抽到一个辅助函数中——原因是缓存边界需要一个具名的函数作用域来挂载。

预渲染在遇到以下任一情况时中止，转为请求时渲染：

- 网络请求、数据库查询、异步文件系统操作
- 访问 `req.url`、`request.headers`、`request.cookies`、`request.body` 等请求对象属性
- 调用 `cookies()`、`headers()`、`connection()` 等运行时 API
- 非确定性操作（如 `Math.random()`）

```ts
// app/api/user-agent/route.ts
import { headers } from 'next/headers'

export async function GET() {
  // 读 headers() → 预渲染在此中止，改为请求时执行
  const headersList = await headers()
  return Response.json({ userAgent: headersList.get('user-agent') })
}
```

### 路由段配置速查

`route.ts` 和 `page.tsx`、`layout.tsx` 共用同一套路由段配置：

```ts
// app/posts/route.ts
export const dynamic = 'auto'
export const dynamicParams = true
export const revalidate = 60
export const fetchCache = 'auto'
export const runtime = 'nodejs'
```

| 配置项 | 作用 |
|---|---|
| `dynamic` | `'auto'` / `'force-dynamic'` / `'force-static'` / `'error'` |
| `dynamicParams` | 未由 `generateStaticParams` 生成的参数是否在请求时生成 |
| `revalidate` | 缓存重新验证秒数，`false` 表示永久缓存 |
| `fetchCache` | 控制段内 `fetch` 的默认缓存行为 |
| `runtime` | `'nodejs'`（默认）/ `'edge'` |
| `preferredRegion` | **已废弃**，不要再写 |

## 流式响应

Route Handler 可以直接返回 `ReadableStream`，这是做 AI 补全、大文件导出、SSE 的标准姿势：

```ts
// app/api/stream/route.ts
const encoder = new TextEncoder()

async function* generate() {
  yield encoder.encode('<p>One</p>')
  await new Promise((r) => setTimeout(r, 200))
  yield encoder.encode('<p>Two</p>')
  await new Promise((r) => setTimeout(r, 200))
  yield encoder.encode('<p>Three</p>')
}

function iteratorToStream(iterator: AsyncGenerator<Uint8Array>) {
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next()
      if (done) {
        controller.close()
      } else {
        controller.enqueue(value)
      }
    },
  })
}

export async function GET() {
  return new Response(iteratorToStream(generate()), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
```

`ReadableStream` 的 `pull` 是按需拉取——下游没消费就不推进迭代器，所以不需要自己写背压逻辑。

## CORS

Route Handler 里没有自动 CORS。用标准 Web API 手工设置：

```ts
// app/api/public/route.ts
export async function GET() {
  return Response.json(
    { ok: true },
    {
      headers: {
        'Access-Control-Allow-Origin': 'https://example.com',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  )
}

// 预检请求必须显式处理，否则浏览器拿不到 CORS 头
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://example.com',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}
```

要给**多个** Route Handler 统一加 CORS 头，用 Proxy 或 `next.config.ts` 的 `headers`，别在每个文件里复制一遍。

## 接收 Webhook

Webhook 的核心约束是「**必须先验签，再解析**」——因为签名通常算在原始 body 字节上，`request.json()` 之后就拿不到原始文本了：

```ts
// app/api/webhooks/stripe/route.ts
import { createHmac, timingSafeEqual } from 'node:crypto'

export async function POST(request: Request) {
  // 1. 取原始文本，不要先 json()
  const raw = await request.text()
  const signature = request.headers.get('x-signature') ?? ''

  // 2. 用密钥验签
  const expected = createHmac('sha256', process.env.WEBHOOK_SECRET!)
    .update(raw)
    .digest('hex')

  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  // timingSafeEqual 要求等长，长度不等直接判定失败
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response('Invalid signature', { status: 401 })
  }

  // 3. 验签通过后才解析
  const event = JSON.parse(raw) as { type: string; data: unknown }
  await handleEvent(event)

  return new Response('OK', { status: 200 })
}
```

Webhook 端点几乎总是要关掉缓存和静态化——第三方 POST 本来就命中不了 `GET` 缓存，但如果你在同段还放了 `export const dynamic = 'force-static'`，会让整段的构建行为变得难预测。Webhook 文件里别写 `dynamic`。

## Route Handler vs Server Actions

两者都能「在服务端跑代码」，但定位完全不同。判据看**谁发起调用**：

| 判据 | Route Handler | Server Action |
|---|---|---|
| 调用方 | 外部系统：webhook、移动端、第三方、其他服务 | 自家 React 组件：表单、按钮、事件回调 |
| 协议 | 完整 HTTP 语义（方法、状态码、任意 headers） | 固定为 POST + 框架私有 header |
| 返回值 | 任意 `Response`：JSON、XML、文件、`ReadableStream` | 可序列化的值；`redirect` / `notFound` 由框架处理 |
| 缓存失效 | 手动调 `revalidateTag` / `revalidatePath` | 内置，且能用 `updateTag` / `refresh` |
| 渐进增强 | 无，必须有 JS 或外部客户端 | 有，表单在 JS 未加载时也能提交 |
| CSRF 防护 | 自己实现 | 框架内置 Origin / Host 校验 |
| 类型安全 | 手写请求与响应类型 | 端到端推导，改签名编译期就报错 |
| 可被 CDN / 缓存层处理 | 可以（GET + `force-static`） | 不行，永远是动态 POST |

一句话记法：**「外面的人要调我」用 Route Handler，「我自己的页面要改数据」用 Server Action**。用 Server Action 暴露给第三方会缺 HTTP 语义和状态码；用 Route Handler 做表单提交会丢掉渐进增强和自动 CSRF 防护。

## 常见坑

- **现象**：`app/blog/route.ts` 建好后报错，提示路由冲突。
  **原因**：同一路由段不允许同时存在 `route.ts` 和 `page.tsx`——两者都声明了「这个 URL 归我」。
  **解法**：把接口挪到子段，例如 `app/blog/api/route.ts`，或改用 Server Action。

- **现象**：`GET` 返回的数据永远是旧的，改了数据库也不变。
  **原因**：某处写了 `export const dynamic = 'force-static'` 或 `revalidate`，把整段的 `GET` 静态化了。
  **解法**：删掉静态化配置，或在数据变更后调用 `revalidateTag` / `revalidatePath`。

- **现象**：`const { id } = context.params` 拿到的是一个 Promise，`id` 打印出来是 `undefined`。
  **原因**：16 里 `params` 是 Promise，必须 `await`。
  **解法**：`const { id } = await context.params`。参见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条。

- **现象**：浏览器跨域请求接口，控制台报 CORS 错误，但服务端日志显示请求根本没到。
  **原因**：预检 `OPTIONS` 请求没被处理，浏览器直接拦下真正的请求。
  **解法**：显式导出 `OPTIONS` 返回 204 和 CORS 头，或统一交给 Proxy 处理。

- **现象**：Webhook 验签一直失败，但用同样的密钥在本地算出来的签名是对的。
  **原因**：先调了 `request.json()`，body 已经被消费并且重新序列化后字节不一致。
  **解法**：先 `await request.text()` 取原始字符串验签，通过后再 `JSON.parse`。

- **现象**：Route Handler 里用 `'use cache'` 直接标注在 `GET` 函数上，构建报错。
  **原因**：`use cache` 不能作用于 Route Handler 函数体本身。
  **解法**：把缓存逻辑抽到一个具名辅助函数里，在辅助函数顶部写 `'use cache'`。

- **现象**：构建后 `GET` 接口返回 500，日志提示访问了 `headers()` 但路由被静态化。
  **原因**：开启了 Cache Components 时，访问运行时 API 会让预渲染中止；如果同段又强制静态化，就自相矛盾。
  **解法**：去掉强制静态化，或把运行时数据的读取移出该段。

## 旧写法 vs 新写法

| 场景 | 旧（13/14） | 新（16.3） |
|---|---|---|
| `GET` 默认行为 | 静态化 | **动态执行** |
| `context.params` | 同步对象 | **`await context.params`** |
| 类型标注 | 手写 `{ params: { id: string } }` | **`RouteContext<'/users/[id]'>`** |
| `preferredRegion` | 可用 | **已废弃** |
| `dynamic = 'force-dynamic'` 强制刷新 | 常规做法 | 优先用 `revalidateTag(tag, 'max')` |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 5、7 条。

## API / 配置速查

| 导出 / API | 签名 | 说明 |
|---|---|---|
| `GET` | `(request: NextRequest, ctx) => Response \| Promise<Response>` | 唯一可缓存的 HTTP 方法 |
| `POST` / `PUT` / `PATCH` / `DELETE` | 同上 | 一律不缓存 |
| `HEAD` | 同上 | 只返回头 |
| `OPTIONS` | 同上 | 不导出时框架自动生成 |
| `RouteContext<'/path/[id]'>` | 全局类型 | 无需 import，`ctx.params` 为 `Promise` |
| `request.nextUrl.searchParams` | `URLSearchParams` | 解析查询参数 |
| `request.cookies` | `RequestCookies` | 读请求 cookie |
| `Response.json(data, init?)` | `(data, init?) => Response` | 返回 JSON |
| `new ReadableStream({ pull })` | — | 流式响应 |
| `dynamic` | `'auto' \| 'force-dynamic' \| 'force-static' \| 'error'` | 段级缓存模式 |
| `revalidate` | `number \| false` | 缓存秒数 |

## 延伸阅读

- [官方文档：Route Handlers（Getting Started）](https://nextjs.org/docs/app/getting-started/route-handlers)
- [官方文档：route.js 文件约定](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [官方文档：Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)
- [官方文档：Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend)
- [官方文档：NextRequest](https://nextjs.org/docs/app/api-reference/functions/next-request)
- [官方文档：NextResponse](https://nextjs.org/docs/app/api-reference/functions/next-response)
