# 50 · SaaS A：多租户架构

> **一句话结论**：多租户的技术难点不在路由，在**缓存键**。路由写错了最多是 404，缓存键写漏了 `tenantId` 就是把 A 客户的数据端给 B 客户——这是能上新闻的事故。**铁律：任何被缓存的租户数据，`cacheTag` 里必须带租户标识；`tenantId` 必须作为函数参数显式传入，不能靠 `headers()` 在缓存作用域里偷偷读。**

## 最小可运行示例

```
app/
├─ _sites/                    # 租户路由的落点，下划线前缀表示「不对应 URL 段」
│  └─ [tenant]/
│     ├─ layout.tsx
│     ├─ page.tsx
│     └─ dashboard/
│        └─ page.tsx
├─ (marketing)/               # 主站，租户之外的内容
│  ├─ page.tsx
│  └─ pricing/
│     └─ page.tsx
└─ proxy.ts
```

```ts
// proxy.ts
import { NextResponse, type NextRequest } from 'next/server'

// 保留子域名：这些不是租户，走主站
const RESERVED = new Set(['www', 'app', 'api', 'admin', 'status'])
const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? 'example.com'

export function proxy(request: NextRequest) {
  const url = request.nextUrl
  const host = request.headers.get('host') ?? ''
  const hostname = host.split(':')[0]

  // 1. 自定义域名（客户把自己域名 CNAME 过来）
  //    生产环境这里应该查数据库或 Redis，不能用本地 Map
  const customTenant = resolveTenantByDomain(hostname)
  if (customTenant) {
    return NextResponse.rewrite(
      new URL(`/_sites/${customTenant}${url.pathname}`, request.url),
      // 把租户信息透传给服务端组件，避免它们再解析一次 host
      { request: { headers: withTenantHeader(request.headers, customTenant) } }
    )
  }

  // 2. 子域名
  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = hostname.slice(0, -(ROOT_DOMAIN.length + 1))

    if (sub && !sub.includes('.') && !RESERVED.has(sub)) {
      return NextResponse.rewrite(
        new URL(`/_sites/${sub}${url.pathname}`, request.url),
        { request: { headers: withTenantHeader(request.headers, sub) } }
      )
    }
  }

  // 3. 主站（根域名、www、保留子域）
  return NextResponse.next()
}

function withTenantHeader(source: Headers, tenant: string): Headers {
  const headers = new Headers(source)
  headers.set('x-tenant', tenant)
  return headers
}

function resolveTenantByDomain(domain: string): string | null {
  // 占位实现。真实实现走 Redis（域名 → 租户 slug 的映射，TTL 5 分钟）
  return null
}

export const config = {
  matcher: [
    // 跳过静态资源和 API，它们不需要租户路由
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|woff2)$).*)',
  ],
}
```

```ts
// lib/tenant.ts
import 'server-only'

import { headers } from 'next/headers'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'

export type Tenant = {
  id: string
  slug: string
  name: string
  plan: 'free' | 'pro' | 'enterprise'
}

// React.cache：同一次请求里多次调用只查一次库
export const getTenant = cache(async (): Promise<Tenant | null> => {
  const slug = (await headers()).get('x-tenant')
  if (!slug) return null

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, plan: true },
  })

  return tenant
})

export async function requireTenant(): Promise<Tenant> {
  const tenant = await getTenant()
  if (!tenant) notFound()
  return tenant
}
```

```ts
// lib/dal/posts.ts
import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'
import { prisma } from '@/lib/db'

/**
 * 关键点：tenantId 是**参数**，不是从 headers() 里读的。
 * 缓存作用域内不能访问 headers()，而且即使能，靠 headers 决定缓存键
 * 也是危险的——一旦漏掉，缓存会跨租户串号。
 */
export async function listPosts(tenantId: string) {
  'use cache'
  cacheLife('minutes')
  // 缓存键里必须带租户维度
  cacheTag(`posts:${tenantId}`)

  const rows = await prisma.post.findMany({
    // 查询也必须带租户维度
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: { id: true, title: true, updatedAt: true },
  })

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updatedAt.toISOString(),
  }))
}
```

```tsx
// app/_sites/[tenant]/page.tsx
import { notFound } from 'next/navigation'
import { requireTenant } from '@/lib/tenant'
import { listPosts } from '@/lib/dal/posts'

export default async function TenantHome() {
  const tenant = await requireTenant()
  // 把具体的 tenant.id 传进去，而不是在缓存函数内部读 headers
  const posts = await listPosts(tenant.id)

  return (
    <section>
      <h1>{tenant.name}</h1>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </section>
  )
}
```

## 路由：子域名还是路径

| | 子域名 `acme.example.com` | 路径 `example.com/acme` |
|---|---|---|
| 租户感知 | 强，URL 即身份 | 弱，容易被忽略 |
| 自定义域名 | 天然支持 | 不支持 |
| Cookie 隔离 | **天然隔离**（cookie 按域划分） | 需手动隔离 |
| SEO | 每个租户独立站点权重 | 权重共享给主域 |
| 本地开发 | 需要 `*.localhost` 或 hosts | 直接可用 |
| 证书 | **通配符证书**（`*.example.com`） | 一张证书 |
| 相对路径 bug | 无 | **容易漏写租户前缀** |

**本项目选子域名**，两个决定性理由：

**Cookie 隔离是安全属性，不是便利性。** 子域名下，`acme.example.com` 设置的 cookie 默认不会发给 `other.example.com`（除非显式设置 `Domain=.example.com`）。路径方案下所有租户共享一个域，会话 cookie 天然是全站可见的——你必须靠代码保证「拿到的 session 属于这个租户」，而这是会忘的。

**自定义域名是 SaaS 的付费点。** 企业客户几乎一定会要求「用自己的域名」。子域名架构下，自定义域名只是 DNS 的 CNAME + 一次 `host` 查询；路径架构下，同一个 URL 前缀要服务两种入口，逻辑会分叉。

**代价要认**：通配符证书、本地开发的 hosts 配置、以及「子域名解析」这一步需要每次请求都做（所以要用缓存）。

### 本地开发

```bash
# /etc/hosts（macOS / Linux）或 C:\Windows\System32\drivers\etc\hosts
127.0.0.1 acme.localhost
127.0.0.1 globex.localhost
```

```
# .env.local
ROOT_DOMAIN=localhost:3000
```

然后访问 `http://acme.localhost:3000`。注意 `host` 头会带端口，所以解析时先 `split(':')[0]` 再去比对域名——本章 `proxy.ts` 里那行 `const hostname = host.split(':')[0]` 就是这个原因。忘了它，本地开发时子域名解析会全部失败，而生产环境正常。

## 数据隔离：三种强度

| 模型 | 实现 | 隔离强度 | 成本 |
|---|---|---|---|
| **行级隔离** | 每张表带 `tenantId`，所有查询带 `where` | 中（依赖代码正确） | 低 |
| **数据库级 RLS** | Postgres 行级安全策略，由数据库强制 | **高** | 中 |
| **独立库/实例** | 每租户一个数据库 | 最高 | 高（迁移、备份、连接池） |

### 行级隔离的正确做法

```prisma
// prisma/schema.prisma（片段）
model Tenant {
  id    String @id @default(cuid())
  slug  String @unique
  name  String
  plan  String @default("free")

  posts   Post[]
  members Member[]

  createdAt DateTime @default(now())
}

model Post {
  id       String @id @default(cuid())
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  title   String
  content String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 每个查询都是「先按租户过滤，再按其他条件」
  // 索引列顺序必须反映这个访问模式
  @@index([tenantId, updatedAt(sort: Desc)])
}

model Member {
  id       String @id @default(cuid())
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  userId String
  role   String @default("member")

  // 同一个用户在同一租户下只能有一条成员记录，
  // 但可以在多个租户下各有一条 —— 这是多租户的关键约束
  @@unique([tenantId, userId])
  @@index([userId])
}
```

**`@@unique([tenantId, userId])` 而不是 `@@unique([userId])`。** 后者会限制「一个用户只能属于一个租户」，直接把产品模型限死了。多租户应用里用户跨租户是常态。

**所有查询都必须带 `tenantId`。** 这个约束太容易违反，所以要靠结构而不是纪律来保证：

```ts
// lib/dal/posts.ts
import 'server-only'

import { cache } from 'react'
import { prisma } from '@/lib/db'

/**
 * 租户作用域的查询包装。所有租户数据的访问都必须经过它。
 * 这样「忘了带 tenantId」变成「拿不到函数」，而不是「查到了别人的数据」。
 */
export function tenantDb(tenantId: string) {
  return {
    posts: {
      list: cache(async () =>
        prisma.post.findMany({
          where: { tenantId },
          orderBy: { updatedAt: 'desc' },
          take: 50,
        })
      ),

      get: cache(async (postId: string) =>
        prisma.post.findFirst({
          // 归属校验和查询是同一次往返，不存在「先查再判断」的窗口
          where: { id: postId, tenantId },
        })
      ),

      create: async (data: { title: string; content: string }) =>
        prisma.post.create({ data: { ...data, tenantId } }),

      delete: async (postId: string) => {
        const result = await prisma.post.deleteMany({
          where: { id: postId, tenantId },
        })
        return result.count > 0
      },
    },
  }
}
```

调用方拿到的是 `tenantDb(tenant.id)`，它**没有**不传租户的方法。这比「每个查询手动记得加 `tenantId`」可靠得多。

### 数据库级 RLS

行级隔离的漏洞来源永远是「某个查询忘了带 `tenantId`」。Postgres 的 RLS 把这条约束下沉到数据库：

```sql
-- prisma/migrations/<ts>_enable_rls/migration.sql
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Post"
  USING ("tenantId" = current_setting('app.current_tenant', true));

-- 应用连接用的角色不能是超级用户（超级用户绕过 RLS）
ALTER TABLE "Post" FORCE ROW LEVEL SECURITY;
```

每个请求开始时设置会话变量：

```ts
// lib/db.ts
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient().$extends({
  query: {
    async $allOperations({ args, query }) {
      // 从 AsyncLocalStorage 或显式参数拿到当前租户
      const tenantId = currentTenantId()
      if (!tenantId) return query(args)

      return prisma.$transaction([
        prisma.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`,
        query(args),
      ])
    },
  },
})
```

**RLS 的代价**：

- 每条查询多一次 `set_config`，或者需要一个事务包住。
- Prisma 的扩展 API 和连接池的交互需要仔细验证——`set_config` 的第三个参数 `true` 表示「事务级」，出事务就失效，这正是你想要的。
- 调试变难：查询返回空结果时，可能是条件不对，也可能是 RLS 拦了。

**取舍建议**：行级隔离 + 租户作用域的 DAL 已经能覆盖大多数场景。**只有在「多租户数据隔离是合规要求」时才上 RLS**——它是防御性的第二层，不是第一层的替代。

## 缓存键设计：多租户最容易翻车的地方

### 反面教材

```ts
// lib/dal/posts.ts —— 会出事故的写法
export async function listPosts() {
  'use cache'
  cacheTag('posts')

  // ❌ 在缓存作用域里读 headers 决定查哪个租户
  const slug = (await headers()).get('x-tenant')
  const tenant = await prisma.tenant.findUnique({ where: { slug } })
  return prisma.post.findMany({ where: { tenantId: tenant!.id } })
}
```

这段代码在**运行时会直接报错**：`'use cache'` 作用域内不能访问 `headers()`，会抛 `next-request-in-use-cache`。

这是 Cache Components 的一个**保护机制**，不是限制。它拦下的正是这类事故——如果 `headers()` 在缓存作用域里可用，那么缓存键里就**没有**租户维度，`acme` 的列表会被缓存成一份，`globex` 的请求命中同一份。

**框架在这里帮了你。** 一旦你为了绕开这个错误把 `headers()` 挪到外面，你实际上是被迫把租户 ID 变成了参数——而参数会进缓存键。这就是正确性。

### 正确写法：租户 ID 作为参数

```ts
// lib/dal/posts.ts
export async function listPosts(tenantId: string) {
  'use cache'
  cacheLife('minutes')
  cacheTag(`posts:${tenantId}`)   // ① 标签带租户
  return prisma.post.findMany({ where: { tenantId } })  // ② 查询带租户
}
```

两层保护：

1. **参数进缓存键**。`listPosts('t_acme')` 和 `listPosts('t_globex')` 是两个不同的缓存条目，物理上不可能命中同一份。
2. **标签带租户**。`updateTag('posts:t_acme')` 只失效 acme 的缓存，不会连带把 globex 的也刷掉（也不该刷掉）。

### 标签命名规范

标签是字符串，拼错了不会报错——只会**静默失效**。用生成函数统一：

```ts
// lib/cache-tags.ts
export const tags = {
  tenantPosts: (tenantId: string) => `posts:${tenantId}`,
  tenantPost: (tenantId: string, postId: string) => `post:${tenantId}:${postId}`,
  tenantMembers: (tenantId: string) => `members:${tenantId}`,
  tenantUsage: (tenantId: string) => `usage:${tenantId}`,

  // 跨租户的全局数据（例如「支持的支付方式」）才允许不带租户
  plans: 'plans',
} as const
```

**函数名里带 `tenant` 前缀是有意的**：调用处看到 `tags.tenantPosts(...)` 就知道它必须传租户 ID。写成 `tags.posts(...)` 会让人以为可以不带。

### 缓存键的完整组成

回忆 [11 缓存模型](../02-rendering/11-cache-components.md)：一个缓存条目的键由 Build ID、函数 ID、可序列化参数、HMR 哈希组成。**租户 ID 是通过「可序列化参数」这一项进来的。**

这意味着一件重要的事：**闭包捕获的变量也会进缓存键**。所以下面这种写法也是安全的：

```ts
// lib/dal/posts.ts
export async function makePostLoader(tenantId: string) {
  return async () => {
    'use cache'
    cacheTag(`posts:${tenantId}`)
    return prisma.post.findMany({ where: { tenantId } })
  }
}
```

`tenantId` 被闭包捕获，自动进缓存键。**但不要依赖这个**——显式传参比依赖闭包捕获可读得多，而且在代码审查时一眼能看出来。

### 跨租户的聚合数据

「平台上有多少个租户」这类数据是**跨租户**的，用普通标签：

```ts
// lib/dal/platform.ts
import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'
import { prisma } from '@/lib/db'

export async function getPlatformStats() {
  'use cache'
  cacheLife('hours')
  cacheTag('platform:stats')   // 不带租户，因为它本来就是全局的

  const [tenants, users] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
  ])

  return { tenants, users }
}
```

**判断标准**：这份数据的值对**所有租户相同**吗？相同 → 不带租户；不同 → 必须带。

### 缓存检查清单

| 检查项 | 通过标准 |
|---|---|
| `'use cache'` 函数签名 | 租户 ID 是**显式参数**，不在函数体内读 `headers()` |
| `cacheTag` | 带租户标识（全局数据除外） |
| 数据库查询 | `where` 里带 `tenantId` |
| 失效调用 | `updateTag` 的标签与 `cacheTag` **完全一致** |
| 自建缓存（Redis） | 键里带 `tenantId` 前缀 |
| 预览环境 | 键里额外带环境前缀，防止预览数据流入正式环境 |

## 常见坑

- **现象**：A 客户看到了 B 客户的数据。
  **原因**：几乎总是缓存键里漏了 `tenantId`。可能是 `cacheTag` 没带，可能是自建 Redis 的键没带，也可能是 `tenantId` 通过闭包捕获但捕获错了对象。
  **解法**：按上面的检查清单逐条核对。用 `NEXT_PRIVATE_DEBUG_CACHE=1` 观察缓存命中情况——如果两个租户的请求命中了同一批缓存条目，问题就在这里。

- **现象**：构建时报 `next-request-in-use-cache`，指向一个多租户的缓存函数。
  **原因**：`'use cache'` 作用域里读了 `headers()` 来获取租户。
  **解法**：这是**框架在救你**。把 `headers()` 挪到缓存边界外，把 `tenantId` 当参数传进去。

- **现象**：本地开发时所有请求都落到主站，子域名不生效。
  **原因**：`host` 头带了端口（`acme.localhost:3000`），域名比对失败。
  **解法**：解析前先 `host.split(':')[0]`。同时确认 `/etc/hosts` 里有 `acme.localhost` 的映射。

- **现象**：`updateTag('posts')` 之后，所有租户的列表都刷新了，缓存命中率骤降。
  **原因**：标签没带租户维度，一次失效打穿了所有租户的缓存。
  **解法**：标签带租户：`updateTag(\`posts:${tenantId}\`)`。用 `lib/cache-tags.ts` 里的函数统一生成。

- **现象**：一个用户加入第二个租户时报唯一约束冲突。
  **原因**：`Member` 表用了 `@@unique([userId])` 而不是 `@@unique([tenantId, userId])`。
  **解法**：唯一约束必须包含租户维度。

- **现象**：客户配置自定义域名后，`proxy` 里每次请求都要查一次数据库，延迟明显。
  **原因**：域名 → 租户的映射没有缓存。
  **解法**：用 Redis 缓存这个映射（TTL 5 分钟左右）。Proxy 对**每个请求**执行，包括 `Link` 的预取，在这里查库是不可接受的。

- **现象**：子域名站点之间互相能读到对方的 cookie。
  **原因**：登录时把 cookie 的 `Domain` 设成了 `.example.com`（顶级域），而不是留空（默认当前主机）。
  **解法**：不要显式设置 `Domain`。让 cookie 绑定到具体子域名。确实需要跨子域共享的（比如 SSO）才显式设置，并接受隔离性的损失。

- **现象**：租户的自定义域名没有通配符证书覆盖，HTTPS 报错。
  **原因**：通配符证书 `*.example.com` 只覆盖一级子域名，不覆盖客户的自有域名。
  **解法**：自定义域名需要平台侧按域名自动签发证书（ACME 流程），或者让客户自己上传证书。这是**平台能力**，不是应用代码能解决的。

- **现象**：租户 slug 用了中文或大写字母，导致 URL 异常。
  **原因**：域名不区分大小写，且国际域名需要 punycode 转换。
  **解法**：slug 强制小写 ASCII 字母数字加连字符，在创建租户时用 Zod 校验：`z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/)`。同时维护一个保留字列表（`www`、`api`、`admin` 等）。

- **现象**：`_sites` 目录名带下划线，但 URL 里访问 `/_sites/acme` 却返回 404。
  **原因**：下划线前缀是 Next.js 的约定，表示「这个目录不参与 URL 路由」——所以 `/_sites/acme` 本来就不该能访问。
  **解法**：这是**正确行为**。租户只能通过 `proxy` 的 rewrite 进入。如果想验证 rewrite 是否生效，去看 `x-tenant` 请求头。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 租户路由 | `middleware.ts` | **`proxy.ts`** |
| 运行时环境 | 可配 `runtime = 'edge'` | **固定 Node.js runtime** |
| 缓存租户数据 | `unstable_cache(fn, [tenantId])` | **`'use cache'` + `cacheTag(\`x:${tenantId}\`)`** |
| 缓存作用域内读 headers | 隐式允许（会串号） | **直接报错 `next-request-in-use-cache`** |
| 变更后失效 | `revalidateTag(\`posts:${tenantId}\`)` | **`updateTag(\`posts:${tenantId}\`)`** |
| 读取 host | `req.headers.get('host')` | 同上（Proxy 里）；服务端组件用 `await headers()` |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 1、3、5 条。

## API / 配置速查

| API / 配置 | 签名 | 说明 |
|---|---|---|
| `NextResponse.rewrite(url, { request: { headers } })` | — | 重写路径并透传自定义头，URL 不变 |
| `NextResponse.next({ request: { headers } })` | — | 不改路径，只加头 |
| `headers()` | `Promise<Headers>` | **必须 `await`**；不能在 `'use cache'` 作用域内调用 |
| `React.cache(fn)` | `(fn) => fn` | 单请求内去重，避免多次查租户 |
| `cacheTag(tag)` | `(tag: string) => void` | 缓存作用域内打标签，**必须带租户维度** |
| `updateTag(tag)` | `(tag: string) => void` | 仅 Server Actions；标签要与 `cacheTag` 完全一致 |
| `notFound()` | `() => never` | 租户不存在时返回 404（不要区分「不存在」和「无权限」） |
| `config.matcher` | `string[]` | 排除静态资源，减少 Proxy 执行次数 |

| 隔离模型 | 强制方 | 适用 |
|---|---|---|
| 行级 `tenantId` | 应用代码 | 默认选择 |
| 行级 + DAL 包装 | 应用结构（类型系统辅助） | 推荐 |
| Postgres RLS | **数据库** | 有合规要求时 |
| 独立数据库 | 基础设施 | 企业级大客户 |

## 延伸阅读

- [官方文档：Multi-tenant apps](https://nextjs.org/docs/app/guides/multi-tenant)
- [Vercel Platforms Starter Kit（官方推荐的多租户架构）](https://vercel.com/templates/next.js/platforms-starter-kit)
- [官方文档：Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [官方文档：`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache)
- [官方文档：`cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag)
- [官方文档：Data Security](https://nextjs.org/docs/app/guides/data-security)
- [PostgreSQL 文档：Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Prisma 文档：Client Extensions](https://www.prisma.io/docs/orm/prisma-client/client-extensions)
