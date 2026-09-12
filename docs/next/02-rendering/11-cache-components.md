# 11 · 缓存模型 Cache Components

> **一句话结论**：16 的缓存模型翻了个面——**数据默认是动态的，缓存必须显式选择**。一个 `cacheComponents: true` 取代了 `experimental.ppr`、`experimental.dynamicIO`、`experimental.useCache` 三个开关，缓存用 `'use cache'` 声明，生命周期用 `cacheLife` 描述，失效用 `cacheTag` 打标。PPR 随之成为 App Router 的默认渲染行为，不再需要任何路由级声明。

## 最小可运行示例

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

```tsx
// app/lib/data.ts
import { cacheLife, cacheTag } from 'next/cache'

export async function getProducts() {
  'use cache'
  cacheLife('hours')
  cacheTag('products')
  return db.query('SELECT * FROM products')
}

// 没有 'use cache'，每次请求都重算
export async function getLiveInventory() {
  return db.query('SELECT * FROM inventory')
}
```

```tsx
// app/page.tsx
import { getProducts } from '@/app/lib/data'

export default async function Page() {
  const products = await getProducts()

  return (
    <ul>
      {products.map((p: { id: string; name: string }) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  )
}
```

`getProducts()` 的结果会被缓存、进静态外壳，按小时在后台重建，并且能被 `revalidateTag('products', 'max')` 或 `updateTag('products')` 按需失效。`getLiveInventory()` 什么都不用加就每次请求重算——**默认动态，加指令才缓存**，这就是整个模型。

## 核心语义变化：为什么官方要这么改

这是本章最需要理解的一段，比记住 API 重要得多。

**旧 App Router 是隐式缓存**：`fetch` 默认缓存、路由默认静态，开发者经常遇到"为什么我的数据不更新"——数据改了页面还是旧的，因为框架默默帮你缓存了。排查这类问题要先知道框架"背着你"做了什么。

**Cache Components 改成完全 opt-in**：页面、布局、API 路由里的动态代码**默认在请求时执行**，要缓存必须显式声明 `'use cache'`。这个方向性调整解决三个问题：

1. **可预测性**。"这段有没有缓存"变成可以直接读出来的事实，不需要脑内模拟框架的默认值推断规则。
2. **失效问题消失大半**。隐式缓存最痛的场景是"忘了它被缓存了，所以忘了失效"；写下 `'use cache'` 的那一刻就知道后面需要一个失效路径。
3. **静态外壳不再是二选一**。旧模型下"路由静态还是动态"必须在构建期决定；新模型下每个组件各自决定，静态外壳自动变大。

代价是多写一点，换来的是"数据不更新"从"排查框架行为"变成"检查有没有写缓存指令"。

### 三个实验开关合并

| 旧 | 新 |
|---|---|
| `experimental.ppr` | **已移除**，演进为 Cache Components |
| `experimental.dynamicIO` | **重命名为 `cacheComponents`** |
| `experimental.useCache` | 并入 Cache Components |
| `export const experimental_ppr`（路由级） | **已移除** |

开启后 `dynamic`、`revalidate`、`fetchCache` 这些路由段配置会**直接报错**，迁移方式见 [08 渲染策略总览](./08-rendering-strategies.md)。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 3 条。

## `'use cache'` 指令

缓存的都是**返回值**，可以加在三个层级。被缓存的函数和组件**必须是 `async`**。

### 函数级

```ts
// app/lib/data.ts
import { cacheLife } from 'next/cache'

export async function getUsers() {
  'use cache'
  cacheLife('hours')
  return db.query('SELECT * FROM users')
}
```

数据级缓存的用处是：同一份数据被多个组件用到，或者想让数据独立于 UI 被缓存。

### 组件级

```tsx
// app/components/bookings.tsx
export async function Bookings({ type = 'haircut' }: { type: string }) {
  'use cache'

  const response = await fetch(
    `https://api.example.com/bookings?type=${encodeURIComponent(type)}`
  )
  const data = await response.json()

  return <div>{/* ... */}</div>
}
```

只要序列化后的 props 每次相同，缓存条目就会被复用。整页缓存也一样，把指令加在 `page` 组件顶部即可。

### 文件级

放在文件顶部时，该文件**所有导出**都变成缓存函数，且都必须是 `async`——框架函数导出也一视同仁，`generateMetadata` 和 `generateStaticParams` 同样要 `async`。

```ts
// app/lib/reports.ts
'use cache'

export async function getMonthlyTotals(accountId: string) {
  return db.orders.aggregate({ where: { accountId }, _sum: { amount: true } })
}

export async function getTopProducts() {
  return db.products.findMany({ orderBy: { sales: 'desc' }, take: 10 })
}
```

一个容易忽略的推论：**每个路由段是独立入口、独立缓存**。要预渲染整条路由，得给 `page`、`layout`、以及所有平行路由槽位都加上指令。

> 缓存指令在文件顶部时，它的导出函数可以被客户端组件 import 并直接调用——它们在服务端执行并返回结果，类似 Server Function。但更推荐在服务端调用、把结果当 props 往下传。

### 缓存键是怎么生成的

这是理解"为什么缓存没命中"的关键。一个缓存条目的键由四部分组成：

1. **Build ID** —— 每次构建唯一，变了就让所有缓存条目失效。配了 `deploymentId` 则由它覆盖。
2. **Function ID** —— 函数在代码中的位置与签名的安全哈希。
3. **可序列化的参数** —— 组件的 props 或函数的参数。
4. **HMR 刷新哈希** —— 仅开发环境。

**闭包捕获的变量也会被自动纳入**，绑定成参数参与缓存键：

```ts
// app/lib/data.ts
async function Component({ userId }: { userId: string }) {
  const getData = async (filter: string) => {
    'use cache'
    // 缓存键同时包含 userId（闭包捕获）和 filter（参数）
    return fetch(`/api/users/${userId}/data?filter=${filter}`).then((r) => r.json())
  }

  return getData('active')
}
```

不同的 `userId` 和 `filter` 组合产生独立的缓存条目。这通常是你想要的，但不小心捕获了每次都变的变量（比如 `Date.now()` 的结果）时，缓存永远不会命中。

**所有缓存都限定在单次部署内。** 新部署等于全新的预渲染产物，`'use cache'` 条目不会跨部署延续——连持久化的 `use cache: remote` 也不会，因为缓存键里含 Build ID。

### 缓存条目存在哪

| 存放位置 | 说明 |
|---|---|
| **预渲染 HTML** | 构建期渲染成 HTML 存盘（自托管）或存在平台持久存储里（走 CDN）。这就是静态外壳、以及 ISR 升级后的具体页面；`revalidate` 和 `expire` 控制何时重建 |
| **共享存储** | 默认是**每实例的内存 LRU**，在 serverless 上是临时的。`use cache: remote` 可移到跨实例共享的持久 cache handler，但这是一次网络往返，只有**高命中率**时才划算 |
| **浏览器** | payload 随客户端导航或预取的 RSC 一起发到浏览器，在 `stale` 窗口内保持新鲜。`use cache: private` 的结果只存在这里 |

运行环境差异很大：**serverless** 下缓存条目通常不跨请求存活（每次请求可能是不同实例），构建期缓存正常工作；**自托管**下跨请求存活，用 `cacheMaxMemorySize` 控制大小。需要跨部署持久化的数据，用 `unstable_cache`（非 fetch 函数）或 `fetch` 缓存。

## `cacheLife`：给缓存一个寿命

每个 `'use cache'` 作用域都**建议**配一个 `cacheLife`。不配的话隐式的 `default` profile 会生效——能跑，但"这段缓存活多久"这个事实就从调用点消失了。

```ts
// app/lib/data.ts
import { cacheLife } from 'next/cache'

export async function getProducts() {
  'use cache'
  cacheLife('hours')
  return db.query('SELECT * FROM products')
}
```

### 三个时间属性

| 属性 | 含义 |
|---|---|
| `stale` | **客户端**可以不做服务端校验就用缓存数据的时长。这期间客户端路由直接显示缓存内容、不发请求。它还决定内容能否进 App Shell |
| `revalidate` | 服务端后台重建缓存的频率。超过后请求到达时：先返回缓存 → 后台重建 → 更新缓存。类似 ISR |
| `expire` | 服务端**必须**重建的上限。超过且没有流量时，下一个请求同步等待新内容。设了 `revalidate` 又设 `expire` 时，`expire` 必须更长，否则报错 |

### 预置 profile

| Profile | 适用场景 | `stale` | `revalidate` | `expire` |
|---|---|---|---|---|
| `default` | 标准内容 | 5 分钟 | 15 分钟 | 永不过期 |
| `seconds` | 实时数据 | 30 秒 | 1 秒 | 1 分钟 |
| `minutes` | 频繁更新 | 5 分钟 | 1 分钟 | 1 小时 |
| `hours` | 每天多次更新 | 5 分钟 | 1 小时 | 1 天 |
| `days` | 每天更新 | 5 分钟 | 1 天 | 1 周 |
| `weeks` | 每周更新 | 5 分钟 | 1 周 | 30 天 |
| `max` | 极少变化 | 5 分钟 | 30 天 | 1 年 |

### 自定义与内联 profile

在 `next.config.ts` 里注册具名 profile，或在使用点直接传对象：

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    biweekly: { stale: 1209600, revalidate: 86400, expire: 1209600 },
  },
}

export default nextConfig
```

```tsx
// app/page.tsx
import { cacheLife } from 'next/cache'

export default async function Page() {
  'use cache'
  cacheLife({ stale: 3600, revalidate: 900, expire: 86400 })
  return <div>Page</div>
}
```

省略的属性从 `default` profile 继承，内联对象和自定义 profile 都遵循这个规则。也可以重新定义内置 profile（包括 `default` 和 `max`），但要在项目里写清楚——`cacheLife('hours')` 应该反映你设的值。改 `default` 还会连带改变"没调 `cacheLife` 的 `use cache` 作用域"所用的寿命。类型签名在 `next dev`、`next build` 或 `next typegen` 时根据 `next.config.ts` 生成，编辑器里的补全和 JSDoc 反映的是你设的值。

### 太短的寿命会被踢出预渲染

这条规则直接影响"我的内容为什么没进静态外壳"：

| 条件 | 后果 |
|---|---|
| `revalidate` 为 `0`，或 `expire` 小于 5 分钟 | **排除出预渲染**，变成请求期解析的"动态空洞" |
| `stale` 小于 30 秒 | **排除出预渲染**，因为预取会在用户点击前就过期 |
| `stale` ≥ 30 秒但小于 5 分钟 | 进预渲染，但**排除出 App Shell** |

预置 profile 里只有 `seconds` 会踩到（`expire` 是 1 分钟）。这条规则让静态和动态内容能混在同一页里：静态部分预渲染，短寿命缓存形成"这里的数据是请求期取的"边界，给它包 `<Suspense>` 提供 fallback 就行。

另外，`stale` 控制的是**客户端缓存**，不是 `Cache-Control` 头——服务端通过 `x-nextjs-stale-time` 响应头把 stale 时间发给客户端，客户端路由用它决定何时重新验证，**强制最少 30 秒**，保证预取的链接在用户点击前不会失效（这个下限只作用于基于时间的过期）。在 Server Action 里调用 `revalidateTag`、`revalidatePath`、`updateTag` 或 `refresh` 时，**整个客户端缓存会被立刻清空**，绕开 stale 时间。

## `cacheTag`：打标签以便按需失效

```ts
// app/lib/data.ts
import { cacheTag } from 'next/cache'

export async function getProducts() {
  'use cache'
  cacheTag('products')
  return db.query('SELECT * FROM products')
}
```

打上标签后用 `revalidateTag` 或 `updateTag` 失效（详见 [12 重新验证](./12-revalidating.md)）。同一个标签可以在多个函数里复用，一次失效全部生效。

`cacheLife` 和 `cacheTag` 都是**跨客户端和服务端缓存层生效**的——在一处配置缓存语义，它在所有地方都适用。

> **API 名称变化**：`unstable_cacheLife` → `cacheLife`，`unstable_cacheTag` → `cacheTag`。去掉 `unstable_` 前缀意味着官方承诺了 API 稳定性。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 4 条。

## 约束：缓存作用域里不能做什么

缓存函数运行在**隔离环境**里，这些限制保证缓存行为可预测、安全。

### 不能访问请求期 API

缓存函数和组件**不能**访问 `cookies()`、`headers()`、`searchParams`。这个限制**沿着调用栈传播**——缓存函数调用的 helper 里读了这些，一样会失败，报 `next-request-in-use-cache`。

麻烦的是错误时机：在动态渲染的路由上，这个问题在路由真正运行时才暴露，所以可能**通过 `next build` 却在 `next start` 下失败**。

正确做法是**在缓存作用域外面把值读出来，当参数传进去**：

```tsx
// app/profile/page.tsx
import { cookies } from 'next/headers'
import { Suspense } from 'react'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProfileContent />
    </Suspense>
  )
}

// 这个组件不缓存，负责读运行期数据
async function ProfileContent() {
  const session = (await cookies()).get('session')?.value
  return <CachedContent sessionId={session} />
}

// 缓存组件只接收提取出来的值，sessionId 成为缓存键的一部分
async function CachedContent({ sessionId }: { sessionId: string }) {
  'use cache'
  return <div>{await fetchUserData(sessionId)}</div>
}
```

请求时如果找不到匹配的缓存条目，`<CachedContent />` 会执行并把结果存下来供后续相同 `sessionId` 的请求复用。注意它因为被请求数据"把守"，**不会进预渲染的静态外壳**；运行时默认缓存在内存里，而内存在 serverless 上不跨请求存活，所以可能每次请求都重新求值。需要持久共享缓存就用 `'use cache: remote'`。

### 随机值和当前时间

`Math.random()`、`Date.now()`、`crypto.randomUUID()` 这类操作每次执行都产出不同值，Cache Components 要求你显式处理。

**要每次请求唯一**：先调 `connection()` 推迟到请求期，再用 `<Suspense>` 包住。

```tsx
// app/page.tsx
import { connection } from 'next/server'
import { Suspense } from 'react'

async function UniqueContent() {
  await connection()
  return <p>Request ID: {crypto.randomUUID()}</p>
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <UniqueContent />
    </Suspense>
  )
}
```

**要让所有用户看到同一个值**：把它缓存起来。

```tsx
// app/page.tsx
export default async function Page() {
  'use cache'
  return <p>Build ID: {crypto.randomUUID()}</p>
}
```

`performance.now()` 是例外——它是给遥测用的，Next.js 不把它当作需要守护的值。

### Draft Mode 与 `React.cache`

**Draft Mode** 开启时，所有缓存函数和组件**每次请求都重新执行**，结果不写入缓存。在 `use cache` 作用域里可以读 `draftMode()` 的 `isEnabled`，但 `cookies()` 和 `headers()` 仍然不允许；调 `enable()` 或 `disable()` 会抛错。

**`React.cache` 在 `use cache` 边界内是隔离的**，在缓存函数外面通过 `React.cache` 存的值在里面读不到：

```tsx
// app/components/child.tsx
import { cache } from 'react'

const store = cache(() => ({ current: null as string | null }))

async function Child() {
  'use cache'
  // store() 在这里返回一个全新的空对象，看不到外面写进去的值
  return <div>{store().current}</div>
}
```

往缓存作用域里传数据要用函数参数。

## 序列化限制

缓存函数的**参数和返回值都必须可序列化**，而且是**两套不同的序列化系统**：参数走 React Server Components 序列化（更严格），返回值走 React Client Components 序列化。这意味着**你可以返回 JSX 元素，但不能把 JSX 元素当参数接收**（除非用穿透模式）。

| 可以作为参数 | 只能作为返回值 | 不支持 |
|---|---|---|
| 原始类型：`string`、`number`、`boolean`、`null`、`undefined` | JSX 元素 | 类实例 |
| 普通对象 `{ key: value }`、数组 | | 普通函数（穿透除外） |
| `Date`、`Map`、`Set`、`TypedArray`、`ArrayBuffer` | | `Symbol`、`WeakMap`、`WeakSet` |
| React 元素（仅穿透） | | `URL` 实例 |

最常见的翻车是把 ORM 返回的实体对象直接当参数传进缓存组件——那是类实例，必须先把需要的字段取出来。

### 穿透模式：不可序列化的参数怎么用

你可以接收不可序列化的值，**只要不去内省它们**。这让 `children` 和 Server Actions 的组合模式能成立。

```tsx
// app/components/cached-wrapper.tsx
async function CachedWrapper({ children }: { children: ReactNode }) {
  'use cache'
  // 不读、不改 children，只是把它透传出去
  return (
    <div className="wrapper">
      <header>Cached Header</header>
      {children}
    </div>
  )
}

// 用法：children 可以是动态的
export default function Page() {
  return (
    <CachedWrapper>
      <DynamicComponent /> {/* 不缓存，只是透传 */}
    </CachedWrapper>
  )
}
```

Server Actions 也可以穿过缓存组件——同样**不要在缓存函数里调用它**：

```tsx
// app/page.tsx
import ClientComponent from './ClientComponent'

export default async function Page() {
  const performUpdate = async () => {
    'use server'
    await db.update()
  }

  return <CachedComponent performUpdate={performUpdate} />
}

async function CachedComponent({ performUpdate }: { performUpdate: () => Promise<void> }) {
  'use cache'
  // 不要在缓存函数里调用它，只是透传
  return <ClientComponent action={performUpdate} />
}
```

**"只透传、不读取"是这个模式成立的前提。** 一旦在缓存函数体内引用了这些 JSX 槽位，它们就进入了缓存条目，缓存键会变得不可控。

## 完整的「缓存 / 不缓存」对照示例

这是一个把静态、缓存、流式三种情况放在同一页的完整例子：

```tsx
// app/blog/page.tsx
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { cacheLife, cacheTag } from 'next/cache'

export default function BlogPage() {
  return (
    <>
      {/* 1. 静态内容：构建期预渲染 */}
      <h1>Our Blog</h1>

      {/* 2. 缓存内容：进静态外壳 */}
      <BlogPosts />

      {/* 3. 请求期动态内容：流式补齐 */}
      <Suspense fallback={<p>Loading your preferences...</p>}>
        <UserPreferences />
      </Suspense>
    </>
  )
}

type Post = { id: string; title: string; author: string; date: string }

// 所有人看到同一份文章列表，每小时重验证
async function BlogPosts() {
  'use cache'
  cacheLife('hours')
  cacheTag('posts')

  const res = await fetch('https://api.vercel.app/blog')
  const posts: Post[] = await res.json()

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>
          {post.title} — {post.author}
        </li>
      ))}
    </ul>
  )
}

// 依赖 cookie 的 UI，每次请求都重新计算
async function UserPreferences() {
  const theme = (await cookies()).get('theme')?.value || 'light'
  return <aside>Your theme: {theme}</aside>
}
```

预渲染时，header（静态）和 blog posts（`use cache`）进静态外壳，user preferences 的 fallback 也进外壳；存在 cookie 里的偏好设置则在请求时流进来。关键对比：**读 `cookies()` 不再把整条路由变成动态的**——旧模型里这会拖垮整页，现在运行期访问只影响它所在的 Suspense 边界，静态和缓存内容照样在初始 HTML 里发出。

## PPR 成为默认行为

开启 `cacheComponents` 后，**Partial Prerendering（部分预渲染，PPR）就是 App Router 的默认渲染行为**，`experimental.ppr` 配置和路由级 `experimental_ppr` 都已移除。

构建时 Next.js 渲染整棵组件树，按每个组件用到的 API 决定处理方式：

| 组件用到的能力 | 处理方式 |
|---|---|
| `'use cache'` | 结果进缓存、进静态外壳（前提是寿命足够长） |
| `<Suspense>` | fallback 进静态外壳，内容请求期流式补齐 |
| 可预测的值（模块 import、`fs.readFileSync`、纯计算） | 构建期完成，自动进静态外壳 |
| 随机值与时间戳 | 用 `connection()` + `<Suspense>` 得到每请求唯一值，或用 `use cache` 让所有人共享一个 |

产出物是静态外壳——包含首次加载用的 HTML 和客户端导航用的序列化 RSC Payload，所以用户无论直接访问 URL 还是从别的页面跳过来，都能立刻拿到完整渲染的内容；每个外壳都能直接从 CDN 提供，不必回源。外壳里装什么取决于构建期已知多少信息：动态参数已知时是具体内容，未知时是 **App Shell**（与 URL 无关的可复用版本），具体版本在首次访问后由 ISR 补上。

> 用 `generateStaticParams` 决定哪些参数组合在构建期预渲染。不必全量预渲染——每个页面都增加构建工作和存储成本，很多路由在你下次部署前可能根本没人访问。

## 依赖 Node runtime

**Cache Components 需要 Node.js runtime。** 旧的路由段配置 `runtime = 'edge'` 已弃用，在此模式下不受支持；其他服务端 JS 运行时也不保证可用。迁移时删掉 `export const runtime = 'edge'` 这一行，用默认的 Node.js runtime 即可；确实需要边缘行为的路由改用 [Proxy](../03-routing-network/16-proxy.md)。

## `<Activity>` 与导航时的 UI 状态保持

开启 `cacheComponents` 后，Next.js 用 React 的 [`<Activity>`](https://react.dev/reference/react/Activity) 保留客户端导航时的组件状态：导航离开不再卸载上一个路由，而是把它的 Activity 模式设为 `"hidden"`——状态保留、effect 被清理，重新可见时重建。Next.js 只保留最近访问的少数路由，更早的从 DOM 移除，避免无限增长。

依赖"卸载即清空"的代码需要调整：**下拉菜单和弹出层**导航回来时还是打开的，在 `useLayoutEffect` 的 cleanup 里关掉；**带初始化逻辑的对话框**的聚焦 effect 不会重新触发，把状态从 URL 派生；**提交后的表单**输入值和 `useActionState` 结果仍在，能在提交处理器里重置就重置，否则用 cleanup effect。

## 调试缓存

```bash
# 详细缓存日志，生产环境同样可用
NEXT_PRIVATE_DEBUG_CACHE=1 pnpm dev
```

这个环境变量也会记录 ISR 和其他缓存机制；开发环境下来自缓存函数的 `console.log` 会带 `Cache` 前缀。

## 常见坑

- **现象**：构建挂在某条路由上，50 秒后报 `Filling a cache during prerender timed out, likely because request-specific arguments such as params, searchParams, cookies() or uncached data were used inside "use cache".`
  **原因**：缓存函数拿到了一个在**边界外面**创建的、指向运行期数据的 Promise——可能通过 props 传进来、通过闭包访问、或者从共享存储（`Map`）里取出来。它在等一个构建期永远解析不了的值。
  **解法**：把运行期数据在缓存边界外面 await 出来，把**具体值**当参数传进缓存函数。共享存储的场景改用内置 fetch 去重，或者给缓存和非缓存上下文分开用不同的 Map。注意直接调 `cookies()` 或 `headers()` 会立刻报 `next-request-in-use-cache`，不是超时——两者症状不同，别混。

- **现象**：`next build` 通过，`next start` 下某个页面直接 500，报 `next-request-in-use-cache`。
  **原因**：缓存函数（或它调用的某个 helper）间接读了 `cookies()` / `headers()` / `searchParams`。这个限制沿调用栈传播，而静态路由在构建期可能不触发这条路径，所以构建能过。
  **解法**：在缓存作用域外面读运行期值，作为参数传进去。注意 helper 函数——报错点可能在很深的地方，顺着调用栈往上看。

- **现象**：缓存看起来完全没生效，每次都重新执行。
  **原因**：几个常见来源。① 闭包捕获了每次都变的变量（`Date.now()` 的结果、每次新建的对象），缓存键每次都不同。② 用了 `cacheLife('seconds')`，`expire` 只有 1 分钟，被排除出预渲染。③ 在 serverless 上依赖内存缓存，实例是临时的。
  **解法**：检查闭包捕获的变量；确认 profile 的寿命足够长（`revalidate` 不能是 0，`expire` 要 ≥ 5 分钟，`stale` 要 ≥ 30 秒）；需要持久共享缓存时上 `'use cache: remote'`。用 `NEXT_PRIVATE_DEBUG_CACHE=1` 看实际命中情况。

- **现象**：改了代码重新部署，缓存还是旧的。
  **原因**：不是 bug。所有缓存都限定在单次部署内，缓存键包含 Build ID（或 `deploymentId`），新部署等于全新缓存。连持久化的 `use cache: remote` 也一样。
  **解法**：理解这是设计而非故障。需要跨部署持久化的数据用 `unstable_cache` 或 `fetch` 缓存。

- **现象**：给缓存组件传了 `children` 或 Server Action，缓存行为变得不可预测。
  **原因**：穿透模式要求你**只透传、不读取**。一旦在缓存函数体内引用这些槽位，它们就进了缓存条目，缓存键不再可控。
  **解法**：检查缓存函数体里有没有读 `children`（比如 `React.Children.count(children)`、`children.length`）。把它们纯粹当槽位渲染出去。

- **现象**：导航离开再回来，下拉菜单还开着、表单里还留着上次的内容、错误提示还在。
  **原因**：`<Activity>` 保留了路由状态，不再卸载组件。依赖"卸载即清空"的写法失效了。
  **解法**：在 `useLayoutEffect` 的 cleanup 里关下拉；把对话框状态从 URL 派生；表单在提交处理器里显式重置。见 [官方 Preserving UI state 指南](https://nextjs.org/docs/app/guides/preserving-ui-state)。

- **现象**：某块内容没进静态外壳，但 profile 配的是 `'days'`。
  **原因**：可能不是这块内容的问题，而是它所在的 Suspense 边界或它依赖的某个更短寿命的缓存。另外，被请求数据"把守"的缓存组件（先读 cookie 再传参给缓存函数的那种）本来就**不会**进静态外壳。
  **解法**：确认缓存键是否依赖运行期值。依赖了就是预期行为——它在请求时执行并缓存（内存中，serverless 上可能每次重算）。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 开启 PPR | `experimental.ppr: true` + 路由级 `experimental_ppr` | **`cacheComponents: true`**，PPR 成为默认 |
| 开启 `use cache` / 动态 IO 校验 | `experimental.useCache`、`experimental.dynamicIO` | 并入 **`cacheComponents`** |
| 缓存函数 | `unstable_cache(fn, keys, { tags, revalidate })` | **`'use cache'` + `cacheLife` + `cacheTag`** |
| 缓存生命周期 | `unstable_cacheLife` | **`cacheLife`**（去掉 `unstable_`） |
| 缓存标签 | `unstable_cacheTag` | **`cacheTag`**（去掉 `unstable_`） |
| 强制静态 | `export const dynamic = 'force-static'` | `'use cache'` + `cacheLife('max')` |
| 定时重建 | `export const revalidate = 3600` | `cacheLife('hours')` |
| 取数缓存开关 | `export const fetchCache = ...` | **不需要**，`use cache` 作用域内自动缓存 |
| Edge runtime | `export const runtime = 'edge'` | **已弃用**，需要 Node.js runtime |
| 默认缓存行为 | `fetch` 隐式缓存 | **默认动态，缓存需显式声明** |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 3、4 条。

## API / 配置速查

| API / 配置 | 签名 | 说明 |
|---|---|---|
| `cacheComponents` | `boolean` | 开启 Cache Components，PPR 成为默认行为 |
| `'use cache'` | 指令 | 可加在函数、组件、文件顶部；被缓存的函数必须是 `async` |
| `'use cache: private'` | 指令 | 允许在缓存作用域里访问运行期 API，结果只缓存在浏览器 |
| `'use cache: remote'` | 指令 | 用持久化的共享 cache handler，适合高命中率场景 |
| `cacheLife(profile)` | `string \| { stale?, revalidate?, expire? }` | 设置缓存寿命，只能在缓存作用域内调用 |
| `cacheTag(tag)` | `string` | 打标签，供 `revalidateTag` / `updateTag` 失效 |
| `connection()` | `next/server` | 截断预渲染，之后只在请求期执行 |
| `cacheMaxMemorySize` | `next.config.ts` | 自托管下控制内存缓存大小 |
| `NEXT_PRIVATE_DEBUG_CACHE` | 环境变量 | 设为 `1` 打开详细缓存日志 |

## 延伸阅读

- [官方文档：Caching](https://nextjs.org/docs/app/getting-started/caching)
- [官方文档：`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache)
- [官方文档：`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife)
- [官方文档：`cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag)
- [官方文档：`cacheComponents`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
- [官方文档：Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components)
- [官方文档：`use cache: private`](https://nextjs.org/docs/app/api-reference/directives/use-cache-private)
- [官方文档：`use cache: remote`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote)
- [官方文档：Preserving UI state](https://nextjs.org/docs/app/guides/preserving-ui-state)
