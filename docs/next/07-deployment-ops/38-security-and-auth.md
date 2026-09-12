# 38 · 安全与认证

> **一句话结论**：服务端组件和客户端组件运行在**互相隔离的模块系统**里，默认是安全的——但把数据传过去的那一刻就可能泄露。防御的核心不是记住哪些 API 安全，而是**建立数据访问层（Data Access Layer）**：只有它碰 `process.env` 和数据库，它返回裁剪过的最小 DTO。UI 层的检查只负责隐藏元素，**不负责保护数据**。

## 最小可运行示例

```ts
// data/dal.ts
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const verifySession = cache(async () => {
  const cookie = (await cookies()).get('session')?.value
  const session = await decrypt(cookie)

  if (!session?.userId) {
    redirect('/login')
  }

  return { isAuth: true, userId: session.userId }
})
```

```ts
// data/user-dto.ts
import 'server-only'
import { verifySession } from './dal'

export async function getProfileDTO(slug: string) {
  const session = await verifySession()
  const rows = await sql`SELECT * FROM users WHERE slug = ${slug}`
  const user = rows[0]

  // 只返回这次查询需要的字段，不是整个用户对象
  return {
    username: user.username,
    // 只有管理员或同团队成员能看到手机号
    phonenumber:
      session.userId === user.id || user.team === session.team
        ? user.phonenumber
        : null,
  }
}
```

```tsx
// app/profile/[slug]/page.tsx
import { getProfileDTO } from '@/data/user-dto'

export default async function Page(props: PageProps<'/profile/[slug]'>) {
  const { slug } = await props.params
  const profile = await getProfileDTO(slug)
  return <h1>{profile.username}</h1>
}
```

`import 'server-only'` 让这个模块**一旦被客户端组件 import 就构建失败**。这是防线的第一层，也是最有效的一层——它把「不小心把密钥逻辑引到浏览器」变成一个编译错误。

## 服务端/客户端边界

首次加载时，服务端组件和客户端组件**都在服务端运行**以生成 HTML。但它们跑在**相互隔离的模块系统**里。

| | 服务端组件 | 客户端组件 |
|---|---|---|
| 运行位置 | 仅在服务端 | 预渲染时在服务端跑，但**必须遵循浏览器代码的安全假设** |
| 数据访问 | 可安全访问环境变量、密钥、数据库、内部 API | **不得**访问特权数据或 `server-only` 模块 |

默认安全，但**可能被破坏**——破坏方式几乎总是「把数据传过去」：

```tsx
// app/contact/page.tsx —— 错误示范
import { getUserDetails } from '@/data/user'
import { UserCard } from './user-card'

export default async function Page(props: PageProps<'/contact/[id]'>) {
  const { id } = await props.params
  const user = await getUserDetails(id)

  // 把整个对象传给了客户端组件 —— 内部字段全部泄露到浏览器
  return <UserCard user={user} />
}
```

```tsx
// app/contact/page.tsx —— 正确做法
export default async function Page(props: PageProps<'/contact/[id]'>) {
  const { id } = await props.params
  const user = await getUserDetails(id)

  // 只传需要展示的字段
  return <UserCard firstName={user.firstName} lastName={user.lastName} />
}
```

几个默认的保护：

- **函数和类默认已被阻止**传递给客户端组件（不可序列化）。
- **环境变量默认只在服务端可用**，`NEXT_PUBLIC_` 前缀的才会暴露。
- `server-only` 包能让模块在客户端环境导入时构建失败。

### 绝对不能跨越边界的数据

| 类别 | 说明 |
|---|---|
| 密钥 / 私有令牌 | `AUTH_TOKEN`、API key、加密密钥 |
| 数据库原始记录 | Server Action 返回值会被序列化发给客户端，不要返回完整记录 |
| 超范围的数据 | 客户端组件的 props 类型不该「比需要的更宽」 |
| `process.env` | 只有数据访问层能碰它 |

**Server Action 的返回值尤其容易忽略**——它的返回值会被序列化发送到客户端，所以「返回整个数据库记录」和「直接打印到页面上」是等价的泄露。

### 推荐的三种数据获取模式

官方建议**选一种并避免混用**，这样开发者和安全审计人员对「数据从哪来、在哪过滤」有清晰预期。

**模式一：外部 HTTP API（零信任）**。适合已有大型应用或后端团队独立管理 API 的情况。从服务端组件用 `fetch` 调现有 REST / GraphQL 端点，把鉴权和字段裁剪的责任交给 API。

**模式二：数据访问层 DAL（新项目推荐）**。一个内部库，满足三个条件：只在服务端运行（`import 'server-only'`）、执行授权检查、返回安全最小的 DTO。

```ts
// data/user-dto.ts
import 'server-only'
import { getCurrentUser } from './auth'

function canSeeUsername(viewer: User) {
  return true
}

function canSeePhoneNumber(viewer: User, team: string) {
  return viewer.isAdmin || team === viewer.team
}

export async function getProfileDTO(slug: string) {
  const [rows] = await sql`SELECT * FROM user WHERE slug = ${slug}`
  const userData = rows[0]
  const currentUser = await getCurrentUser()

  // 只返回本次查询相关的数据
  return {
    username: canSeeUsername(currentUser) ? userData.username : null,
    phonenumber: canSeePhoneNumber(currentUser, userData.team)
      ? userData.phonenumber
      : null,
  }
}
```

用 `cache` 包装是因为同一次渲染里可能多个组件都要拿当前用户，`cache` 保证只查一次。

**模式三：组件级数据访问（仅原型）**

直接在服务端组件里写数据库查询。风险是很容易顺手把整个对象传给客户端组件。缓解方式是在传之前显式清理：

```ts
// data/user.ts
export async function getUser(slug: string) {
  const [rows] = await sql`SELECT * FROM user WHERE slug = ${slug}`
  const user = rows[0]
  return { name: user.name } // 只返回公共字段
}
```

## Taint API

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    taint: true,
  },
}
export default nextConfig
```

启用后可用两个 React 实验 API：

```ts
// data/user.ts
import { experimental_taintObjectReference } from 'react'

export async function getUserDetails(id: string): Promise<UserDetails> {
  const user = await db.queryUserById(id)

  experimental_taintObjectReference(
    'Do not use the entire user info object. Instead, select only the fields you need.',
    user
  )

  return user
}
```

标记后，**传整个对象给客户端组件会抛错**，但读单个字段仍然可以：

```tsx
// app/contact/page.tsx —— 抛错：把整个对象传过去了
export default async function Page(props: PageProps<'/contact/[id]'>) {
  const { id } = await props.params
  const userDetails = await getUserDetails(id)
  return <UserCard user={userDetails} />
}
```

```tsx
// app/contact/page.tsx —— 正常：只传需要的字段
export default async function Page(props: PageProps<'/contact/[id]'>) {
  const { id } = await props.params
  const userDetails = await getUserDetails(id)
  return <UserCard firstName={userDetails.firstName} lastName={userDetails.lastName} />
}
```

`experimental_taintUniqueValue` 用于单个值，签名是 `(message, obj, value)`：

```ts
// data/config.ts
import { experimental_taintUniqueValue } from 'react'

export async function getSystemConfig(): Promise<SystemConfig> {
  const config = await configService.getConfigDetails()

  experimental_taintUniqueValue(
    'Do not pass configuration tokens to the client',
    config,
    config.SERVICE_API_KEY
  )

  return config
}
```

传 `SERVICE_API_KEY` 会抛错，即使中间赋给了新变量也一样。但**从污染值派生出来的新值不会**——`\`version::${config.SERVICE_API_KEY}\`` 这种拼接结果能传过去。

### Taint 的限制

| 限制 | 说明 |
|---|---|
| 只按引用追踪 | 复制对象会得到一个未被污染的新对象，保证全部丢失 |
| `process.env` 只保护对象引用 | 读单个变量（`process.env.MY_VAR`）再传，或 `{ ...process.env }`，都不受保护 |
| 不追踪派生值 | 拼接、计算出来的值需要单独污染 |
| 有生命周期 | 值的保护只在引用作用域内有效 |

官方明确警告：**不要把 taint 当成唯一的防护手段**。它是额外的防御层，正确做法仍然是在 DAL 里过滤和清理数据。

| 限制 | 说明 |
|---|---|
| 只按引用追踪 | 复制对象会得到一个未被污染的新对象，保证全部丢失 |
| `process.env` 只保护对象引用 | 读单个变量（`process.env.MY_VAR`）再传，或 `{ ...process.env }`，都不受保护 |
| 不追踪派生值 | 拼接、计算出来的值需要单独污染 |
| 有生命周期 | 值的保护只在引用作用域内有效 |

官方明确警告：**不要把 taint 当成唯一的防护手段**。它是额外的防御层，正确做法仍然是在 DAL 里过滤和清理数据。

## 认证：会话管理

认证拆成三个概念：**认证（Authentication，验证身份）**、**会话管理（Session Management，跨请求跟踪状态）**、**授权（Authorization，决定能访问什么）**。

会话有两种：

| | 无状态会话 | 数据库会话 |
|---|---|---|
| 存储 | 会话数据（或令牌）放在浏览器 cookie 里 | 数据库，浏览器只拿加密的会话 ID |
| 优点 | 简单 | 更安全，可服务端强制失效 |
| 缺点 | 实现不当不安全 | 更复杂，占用服务器资源 |
| 推荐库 | [Jose](https://github.com/panva/jose) | [iron-session](https://github.com/vvo/iron-session) |

```bash
openssl rand -base64 32
# 把结果存成 SESSION_SECRET 环境变量
```

```ts
// data/session.ts
import 'server-only'
import { cookies } from 'next/headers'

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const session = await encrypt({ userId, expiresAt })
  const cookieStore = await cookies()

  cookieStore.set('session', session, {
    httpOnly: true,
    secure: true,
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
}
```

cookie 选项里 `httpOnly` 阻止客户端 JS 读取，`secure` 只走 HTTPS，`sameSite: 'lax'` 是多数场景的平衡点，`expires` / `maxAge` 控过期，`path` 定生效路径。**cookie 必须在服务端设置**——客户端设置的 cookie 可被篡改。

payload 里**只放最小的唯一标识**（用户 ID、角色），不要放 PII（手机、邮箱、信用卡）或密码。因为无状态会话的 payload 在浏览器里，虽然加密了，但没有必要承担这个风险。

## 授权检查

分两类：**乐观检查**（用 cookie 里的会话数据，快）和**安全检查**（查数据库，慢但可信）。

### Proxy 里的乐观检查

```ts
// proxy.ts
import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/app/lib/session'

const protectedRoutes = ['/dashboard']
const publicRoutes = ['/login', '/signup', '/']

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isProtectedRoute = protectedRoutes.includes(path)
  const isPublicRoute = publicRoutes.includes(path)

  const cookie = req.cookies.get('session')?.value
  const session = await decrypt(cookie)

  if (isProtectedRoute && !session?.userId) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  if (isPublicRoute && session?.userId && !path.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
```

**Proxy 在每个路由（包括预取路由）上运行**，所以它只能做读 cookie 的乐观检查——在里面查数据库会显著拖慢所有导航。Proxy 的定位是网络边界，**不是完整的会话管理方案**。

### 服务端组件里

```tsx
// app/dashboard/page.tsx
import { verifySession } from '@/app/lib/dal'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
  const session = await verifySession()
  const userRole = session?.user?.role

  if (userRole === 'admin') return <AdminDashboard />
  if (userRole === 'user') return <UserDashboard />
  redirect('/login')
}
```

### 不要只在布局里检查

**布局在导航时不会重新渲染**（部分渲染），所以布局里的会话检查不会在每次路由变化时执行。而且布局**无法控制**子路由是否渲染——路由段和并行路由槽由路由器渲染。

正确做法是**在数据源附近或即将条件渲染的组件附近检查**。

流式渲染还有个坑：在布局顶层 `await` `cookies()` / `headers()` / DAL 会**延迟首个流式块**。如果只有部分外壳需要会话数据（比如用户菜单），把 `await` 移到嵌套的服务端组件里并用 `<Suspense>` 包起来。

### Server Actions 和 Route Handlers

```ts
// app/actions.ts
'use server'

import { verifySession } from '@/app/lib/dal'

export async function serverAction(formData: FormData) {
  const session = await verifySession()
  if (session?.user?.role !== 'admin') return null
  // 对已授权用户执行操作
}
```

```ts
// app/api/admin/route.ts
import { verifySession } from '@/app/lib/dal'

export async function GET() {
  const session = await verifySession()
  if (!session) return new Response(null, { status: 401 })       // 未认证
  if (session.user.role !== 'admin') return new Response(null, { status: 403 })  // 无权限
  // 继续
}
```

**每个 Server Action 和 Route Handler 内部都要重新校验。** 不要依赖 Proxy 或布局层的检查——UI 层的检查只隐藏元素，不保护数据。直接构造请求打 Server Action 端点，UI 层的检查完全不参与。

## Authentication with Cache Components

启用 `cacheComponents` 后，认证有个特殊的约束：**会话读取发生在请求时，无法进入静态外壳**。

启用后，即时导航校验会**标记每个读取会话的路由**（因为它们无法预渲染进静态外壳）。不必在发布前全部解决——可以在页面或布局上设 `export const instant = false` 让它继续阻塞，然后逐路由改造。

### 为什么普通 `use cache` 不行

读当前用户 = 读会话 cookie + 查用户。但**普通 `use cache` 无法调用 `cookies()`**（会抛异常），`use cache: remote` 同样不能。也**不能「先取出来再传进去」**——会话助手在自己的代码深处读 cookie，没有可提取的值；而且校验要把 token 过期时间和当前时间比较，读取本身就是「请求 + 时间」依赖的。

### 解法：`use cache: private`

```ts
// lib/auth.ts
import 'server-only'
import { redirect } from 'next/navigation'
import { getSession } from './session'
import { findUserById } from './data'

export type User = { id: string; name: string }

export async function getCurrentUser(): Promise<User> {
  'use cache: private'

  const { userId } = await getSession()
  if (!userId) {
    redirect('/login')
  }

  const user = await findUserById(userId)
  if (!user) {
    redirect('/login')
  }

  return { id: user.id, name: user.name }
}
```

`use cache: private` 直接读 `cookies()` / `headers()` / `searchParams`，**结果只保留在浏览器中，绝不在服务端**。它不接受 `connection()`。

`redirect()` 通过抛异常中断渲染而非返回值，所以**不会被缓存**——只有成功解析的用户会被缓存。

### 必须放在 `<Suspense>` 之后

```tsx
// app/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { getAnnouncements } from '@/lib/data'

export default function Page() {
  return (
    <main>
      {/* 有缓存，进静态外壳 */}
      <Announcements />

      {/* 读会话，必须落在边界之后 */}
      <Suspense fallback={<p>Loading your dashboard…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  )
}

async function Announcements() {
  'use cache'
  const announcements = await getAnnouncements()
  return <ul>{announcements.map((a) => <li key={a}>{a}</li>)}</ul>
}

async function Dashboard() {
  const user = await getCurrentUser()
  return <h1>Welcome, {user.name}</h1>
}
```

**在 `<Suspense>` 边界外读 `cookies()` 是构建错误。** 边界的作用是把页面拆成「静态外壳」和「流式传入的动态部分」——边界外的部分立即返回，只有边界后的部分等请求。

**不要把会话读取放在布局顶层**——那会把整个 segment（包括 `{children}`）挡在该请求之后。

### 缓存会话派生数据

两种方式：

**方式一：把 user id 传进普通 `use cache` 函数**——结果留在服务端，以 id 为缓存键：

```ts
// lib/data.ts
import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { getCurrentUser } from './auth'

export async function getNotes() {
  const user = await getCurrentUser()
  return getNotesByUserId(user.id)
}

// 关键：不导出，调用者无法传别人的 id
async function getNotesByUserId(userId: string) {
  'use cache'
  cacheTag(`notes:${userId}`)
  cacheLife('minutes')

  return db.query.notes.findMany({
    where: (notes, { eq }) => eq(notes.userId, userId),
  })
}
```

`getNotesByUserId` **保持不导出**是安全性的来源——在导出的 getter 内部解析用户，外部无法越权。

**方式二：在 `use cache: private` 作用域内读取**——只留在浏览器，绝不进服务端。

> **缓存键和标签是明文存储的。** 缓存函数的参数和捕获变量会被序列化进缓存键，`cacheTag` 的值按原样存储，两者都不做哈希。**基于稳定标识符（如 user id）做键和标签，把 token、密码、原始邮箱排除在外。**

### 更新会话派生数据

```ts
// app/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { updateTag } from 'next/cache'
import { getSession } from '@/lib/session'
import { saveNote } from '@/lib/data'

export async function addNote(formData: FormData) {
  // 在 action 内重新读会话做自我授权，不信任客户端
  const { userId } = await getSession()
  if (!userId) redirect('/login')

  await saveNote(userId, String(formData.get('note') ?? '').trim())
  updateTag(`notes:${userId}`)
}
```

`updateTag()` 提供 **read-your-writes**——当前用户立刻看到自己刚写的更新。它只能在 Server Actions 里用。

三个失效 API 的区别见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 6 条。

## Server Actions 安全

### 内置防护

**加密的 Action ID**。Server Actions 编译后得到一个加密 ID，客户端拿到的只是这个 ID，不是函数名或源码。这防止了通过猜测端点名来调用未暴露的 action。

**来源校验**。Next.js 把请求 `Origin` 头的 host 和应用自己的 host（取自 `x-forwarded-host` 或 `host`）比对，不一致就拒绝。**不提供 `Origin` 头的请求会被放行并给出警告**（而非拒绝）——所以这不是一道严密的墙，是防 CSRF 的辅助层。

```js
// next.config.js
module.exports = {
  experimental: {
    serverActions: {
      allowedOrigins: ['my-proxy.com', '*.my-proxy.com'],
    },
  },
}
```

| 模式 | 匹配 | 不匹配 |
|---|---|---|
| `my-proxy.com` | `my-proxy.com` | `my-proxy.com:8443`、`app.my-proxy.com` |
| `*.my-proxy.com` | `app.my-proxy.com` | `my-proxy.com`、`app.my-proxy.com:8443` |
| `**.my-proxy.com` | `app.my-proxy.com`、`app.eu.my-proxy.com` | `my-proxy.com` |
| `my-proxy.com:8443` | `my-proxy.com:8443` | `my-proxy.com` |

`*` 匹配恰好一个 host 标签，`**` 匹配一个或多个（**只能在开头**）。不支持部分替换（不能写 `app-*.my-proxy.com`），端口不能通配。反向代理转发公开 host（通过 `x-forwarded-host`）时不需要配这个；**要填的是浏览器地址栏里的 host，不是服务端看到的内部 host**。这个检查**在生产环境也运行**。

**体积限制**。默认请求体上限 1MB，防止解析大载荷消耗服务器资源。

```js
// next.config.js
module.exports = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}
```

接受字节数或 `bytes` 支持的字符串（`'500kb'`、`'3mb'`）。限制作用于**原始 HTTP 请求体**，包含 `multipart/form-data` 的边界、part 头和字段元数据的开销。**典型 multipart 上传要额外留 10–20 KB 余量**，别把限制卡在刚好等于文件大小。

**多实例的加密密钥**。`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 必须在所有实例上一致，否则滚动部署时报 "Failed to find Server Action"。base64 编码的 AES 密钥，长度 16 / 24 / 32 字节，Next.js 默认生成 32 字节。

### 必须自己做的事

```ts
// app/actions.ts
'use server'

import { verifySession } from '@/data/dal'
import { z } from 'zod'

const schema = z.object({ title: z.string().min(1).max(200) })

export async function createPost(formData: FormData) {
  // 1. 授权：在 action 内重新校验
  const session = await verifySession()
  if (!session) throw new Error('Unauthorized')

  // 2. 校验：把 FormData 当不可信输入
  const parsed = schema.safeParse({ title: formData.get('title') })
  if (!parsed.success) return { error: 'Invalid input' }

  // 3. 写入
  const post = await db.posts.create({ ...parsed.data, authorId: session.userId })

  // 4. 返回值：只返回 UI 需要的，不是原始数据库记录
  return { id: post.id, title: post.title }
}
```

四步都不能省。第 4 步尤其容易被忽略——Server Action 的返回值会被序列化发给客户端。官方建议：把数据库访问移到 `server-only` 的 DAL 里，对昂贵操作考虑限流。

## CSP

```ts
// proxy.ts
import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `

  const contentSecurityPolicyHeaderValue = cspHeader.replace(/\s{2,}/g, ' ').trim()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicyHeaderValue)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', contentSecurityPolicyHeaderValue)

  return response
}

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

**`Content-Security-Policy` 要同时设在请求头和响应头上。** 请求头上的是给 Next.js 读的——它在服务端渲染时从这个头里解析 nonce。

Next.js 自动把 nonce 应用到：框架脚本（React、Next.js runtime）、页面专属 JS bundle、框架生成的内联样式和脚本、以及任何用了 `nonce` prop 的 `<Script>` 组件。**所以不用手动给每个标签加 nonce。**

自定义脚本要手动传：

```tsx
// app/page.tsx
import { headers } from 'next/headers'
import Script from 'next/script'

export default async function Page() {
  const nonce = (await headers()).get('x-nonce')

  return (
    <Script
      src="https://www.googletagmanager.com/gtag/js"
      strategy="afterInteractive"
      nonce={nonce}
    />
  )
}
```

开发环境需要 `'unsafe-eval'`——React 用它来重建服务端错误栈。**生产环境不需要**，React 和 Next.js 生产下都不用 `eval`。

### Nonce 的代价

| 影响 | 说明 |
|---|---|
| 强制动态渲染 | 每个请求生成新页面和新 nonce |
| 静态优化与 ISR 禁用 | 页面无法预渲染 |
| CDN 无法缓存 | 除非额外配置 |
| **与 PPR 不兼容** | 静态外壳的脚本无法访问 nonce |
| 服务器负载增加 | 每个请求都要 SSR |
| 托管成本更高 | 需要更多服务器资源 |

页面可以显式声明动态渲染：

```ts
// app/page.tsx
import { connection } from 'next/server'

export default async function Page() {
  await connection()
  // 页面内容
}
```

**什么时候值得付这个代价**：有严格安全要求禁止 `'unsafe-inline'`、应用处理敏感数据、需要在阻止其他脚本的同时允许特定内联脚本、合规要求强制严格 CSP。

不需要 nonce 的话，直接在 `next.config` 里设静态 CSP 头（`script-src` / `style-src` 用 `'unsafe-inline'` 替代 nonce），走 `async headers()` 返回 `Content-Security-Policy`。这个方案**保留静态优化和 CDN 缓存**，代价是必须用 `'unsafe-inline'`，防护强度低一档。完整示例见[官方文档：Content Security Policy](https://nextjs.org/docs/app/guides/content-security-policy)。

## 常见坑

- **现象**：客户端组件里打印 `process.env`，看到的是空对象。
  **原因**：环境变量默认只在服务端可用，只有 `NEXT_PUBLIC_` 前缀的会被内联。
  **解法**：不要把密钥给客户端。需要的数据走服务端组件传 props，或通过 Route Handler 转发。

- **现象**：Server Action 返回的数据库记录里带上了密码哈希，出现在客户端。
  **原因**：Server Action 的返回值会被序列化发给客户端。
  **解法**：只返回 UI 需要的字段。DAL 返回 DTO，不返回原始记录。

- **现象**：某个用户在 dashboard 里看到了别人的数据。
  **原因**：授权只在布局层或 Proxy 层做了检查，而布局在导航时不重新渲染；或者缓存键里没带 user id。
  **解法**：在数据源附近检查；`"use cache"` 的缓存键要包含 user id，且 `cacheTag` 也用 id。

- **现象**：在 `use cache` 函数里调 `cookies()` 直接抛异常。
  **原因**：普通 `use cache` 和 `use cache: remote` 都不能读 `cookies()` / `headers()`。
  **解法**：在缓存函数外面读出值再传进去，或改用 `use cache: private`。

- **现象**：构建时报错说 `<Suspense>` 边界外访问了 `cookies()`。
  **原因**：Cache Components 下读请求 API 必须落在 `<Suspense>` 边界之后。
  **解法**：把读会话的组件包进 `<Suspense>`；不要在布局顶层 await。

- **现象**：滚动部署时报 "Failed to find Server Action"。
  **原因**：多实例的 Server Action 加密密钥不一致。
  **解法**：所有实例用同一个 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`。

- **现象**：上传文件时 Server Action 报载荷过大。
  **原因**：默认上限 1MB，且限制作用于原始请求体（含 multipart 开销）。
  **解法**：调 `serverActions.bodySizeLimit`，并给 multipart 开销留 10–20 KB 余量。

- **现象**：加了 CSP 后页面白屏，控制台报脚本被阻止；或者启用 nonce 后所有页面变成动态渲染、ISR 失效。
  **原因**：前者是 `script-src` 没允许必要的源，或 nonce 没正确传递；后者是 nonce 需每请求生成，与静态渲染、ISR、PPR 都不兼容。
  **解法**：确认 `Content-Security-Policy` 同时设在请求头和响应头，自定义脚本传了 `nonce`，第三方脚本域名进了 `script-src`。不想付动态渲染的代价就改用 `next.config` 的静态头方案。

## 旧写法 vs 新写法

| 场景 | 旧写法 | 16 写法 |
|---|---|---|
| 中间件 | `middleware.ts` / `export function middleware` | **`proxy.ts` / `export function proxy`** |
| 会话读取与缓存 | 直接 `cookies()` | **`"use cache: private"`** + `<Suspense>` |
| 立即生效的失效 | — | `updateTag()`（仅 Server Actions） |
| 失效标签 | `revalidateTag('posts')` | `revalidateTag('posts', 'max')` |
| 缓存 API | `unstable_cacheLife` / `unstable_cacheTag` | `cacheLife` / `cacheTag` |
| 请求 API | 同步 `cookies()` | `await cookies()` |
| Edge runtime 鉴权 | `export const runtime = 'edge'` | **弃用**，Proxy 固定 Node.js |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 1、3、6、7 条。

## API / 配置速查

| 配置 / API | 类型 | 默认 | 说明 |
|---|---|---|---|
| `experimental.taint` | boolean | `false` | 启用 Taint API |
| `experimental.serverActions.allowedOrigins` | string[] | 同源 | 额外允许的 action 调用来源 |
| `experimental.serverActions.bodySizeLimit` | number \| string | `1mb` | 请求体上限 |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | base64 string | 自动生成 | 多实例必须一致 |
| `experimental_taintObjectReference` | `(msg, obj) => void` | — | 污染对象引用 |
| `experimental_taintUniqueValue` | `(msg, obj, value) => void` | — | 污染单个值 |
| `verifySession` | `() => Promise<{ isAuth, userId }>` | — | DAL 里的会话校验（自定义） |
| `updateTag` | `(tag) => void` | — | read-your-writes，仅 Server Actions |
| `revalidateTag` | `(tag, profile) => void` | — | 标记失效 |
| `connection` | `() => Promise<void>` | — | 强制动态渲染 |

| 会话类型 | 存储 | 推荐库 |
|---|---|---|
| 无状态 | 浏览器 cookie | Jose |
| 数据库 | 数据库 + 加密会话 ID | iron-session |

| CSP 方案 | 静态优化 | CDN 缓存 | 与 PPR 兼容 | 防护强度 |
|---|---|---|---|---|
| Nonce（Proxy） | 禁用 | 需额外配置 | **不兼容** | 高 |
| 静态头（next.config） | 保留 | 保留 | 兼容 | 中（需 `'unsafe-inline'`） |

## 延伸阅读

- [官方文档：Data Security](https://nextjs.org/docs/app/guides/data-security)
- [官方文档：Authentication](https://nextjs.org/docs/app/guides/authentication)
- [官方文档：Authentication with Cache Components](https://nextjs.org/docs/app/guides/authentication-with-cache-components)
- [官方文档：Content Security Policy](https://nextjs.org/docs/app/guides/content-security-policy)
- [官方文档：serverActions 配置](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)
- [官方文档：taint](https://nextjs.org/docs/app/api-reference/config/next-config-js/taint)
- [官方文档：cookies](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [官方博客：How to think about security in Next.js](https://nextjs.org/blog/security-nextjs-server-components-actions)
- [React 文档：experimental_taintObjectReference](https://react.dev/reference/react/experimental_taintObjectReference)
- [React 文档：experimental_taintUniqueValue](https://react.dev/reference/react/experimental_taintUniqueValue)
- [The Copenhagen Book（Web 安全基础）](https://thecopenhagenbook.com/)
