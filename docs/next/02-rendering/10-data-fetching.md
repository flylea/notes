# 10 · 数据获取

> **一句话结论**：服务端组件里直接 `await` 数据就够了，不需要 `getServerSideProps`，也不需要 `useEffect` + `useState` 那套。`fetch` 默认**不缓存**，要缓存得显式选。多个互不依赖的请求用 `Promise.all` 并发发起，同一请求内重复调用用 `React.cache` 去重。

## 最小可运行示例

```tsx
// app/blog/page.tsx
export default async function Page() {
  const data = await fetch('https://api.vercel.app/blog')
  const posts = await data.json()

  return (
    <ul>
      {posts.map((post: { id: string; title: string }) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

把组件写成 `async` 函数，直接 await，就完了。

也可以直接查数据库——服务端组件只在服务端渲染，凭证和查询逻辑不会进客户端包：`const allPosts = await db.select().from(posts)`。但直连数据库不等于免鉴权，请求的认证与授权仍然要自己保证。

## 为什么这样设计：数据在渲染时进入组件树

旧模型里，数据获取发生在**组件树渲染之前**：`getStaticProps` / `getServerSideProps` 在组件外把数据取好，再作为 props 传给树。RSC 换了个方向：组件**在渲染过程中自己取数据**——服务端组件只在服务端运行，可以在渲染里访问数据库、文件系统、内部服务或密钥，不需要先有一个 API 路由把数据暴露给客户端。

这不只是写法便利，它消掉了三层间接：不需要为每个数据源写内部 API 路由；不需要把数据"钻"过很多层组件（prop drilling），需要数据的组件自己取；不需要为首屏数据写一套 `useEffect` + `useState` 加载状态。

## `fetch` 的缓存语义

Next.js 扩展了 Web `fetch` API，让每个服务端请求可以设置自己的持久化缓存与失效语义。

```ts
// app/lib/data.ts
fetch(`https://...`, { cache: 'force-cache' | 'no-store' })
```

| `cache` 值 | 行为 |
|---|---|
| **默认（`auto no cache`）** | 开发环境每次请求都从远端取；`next build` 时因为路由会被静态预渲染而只取一次。如果路由上检测到请求期 API，则每次请求都取 |
| `no-store` | 每次都从远端取，即使路由上没检测到请求期 API |
| `force-cache` | 先查服务端缓存。匹配条件是 URL、method、headers、body，任一项不同就分开缓存。命中且新鲜则用缓存；无命中或已陈旧则从远端取并更新缓存。**只存 200 状态的响应** |

**这里有个反直觉的地方**：`fetch` **默认不缓存**。缓存是 opt-in 的，要缓存得写 `cache: 'force-cache'`。这和早期 App Router 的隐式缓存行为相反，也是很多人"为什么数据不更新 / 为什么数据没缓存"困惑的来源。

同样的 opt-in 逻辑适用于 `POST` 请求、以及带 `authorization` 或 `cookie` 头的请求——只要你显式写 `force-cache`，它们也会被缓存。Draft Mode 会完全绕过缓存（既不读也不写）。

### 失效控制

```ts
// app/lib/data.ts
// 按秒设置缓存寿命
fetch(`https://...`, { next: { revalidate: false | 0 | number } })
```

| `next.revalidate` | 含义 |
|---|---|
| `false` | 无限期缓存，等价于 `revalidate: Infinity`（HTTP 缓存仍可能淘汰旧资源） |
| `0` | 不缓存该资源 |
| `number` | 缓存寿命最多 n 秒 |

两条容易踩的规则：

- 单个 `fetch` 设的 `revalidate` 比路由的默认值低时，**整条路由**的重验证间隔会被拉低。同一路由里两个 URL 相同的 fetch 设了不同的 `revalidate`，取**较小**的那个。
- 冲突的组合（比如 `{ revalidate: 3600, cache: 'no-store' }`）**两者都会被忽略**，开发模式下会在终端打一条警告。这类错误很隐蔽，看到数据行为异常时先检查这里。

### `next.tags` 与按需失效

```ts
// app/lib/data.ts
fetch(`https://...`, { next: { tags: ['collection'] } })
```

打上 tag 之后就能用 `revalidateTag` 按需失效。tag 长度上限 256 字符，单个请求最多 128 个 tag。

在 Cache Components 下更常用的写法是 `'use cache'` + `cacheTag`，语义更明确、作用范围更可控，见 [11 缓存模型 Cache Components](./11-cache-components.md)。

### 请求内的自动去重（memoization）

使用 `GET` 且 URL 和选项相同的 `fetch` 请求，在**一次服务端渲染过程中自动 memoized**。在多个服务端组件、布局、页面、`generateStaticParams`、`generateViewport` 里调同一个 fetch，Next.js 只执行一次并共享结果。

这**不等于缓存**：memoization 只活一次渲染过程，缓存跨请求存活。两者是不同层次的东西。

想关掉 memoization，传一个 `AbortController` 的 signal：

```ts
// app/lib/data.ts
const { signal } = new AbortController()
fetch(url, { signal })
```

Route Handlers 里不适用 memoization，因为它们不属于 React 组件树。

## 并行请求优于瀑布流

这是数据获取里影响最大的一条实践。

**瀑布流**：多个 `await` 顺序写下来，后一个要等前一个完成。总耗时是两者之和。

```tsx
// app/artist/[username]/page.tsx
import { getArtist, getAlbums } from '@/app/lib/data'

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params

  // 这些请求是顺序的，总耗时是两者之和
  const artist = await getArtist(username)
  const albums = await getAlbums(username)

  return <div>{artist.name}</div>
}
```

**并行**：先调用（请求立刻发起），再用 `Promise.all` 一起 await。总耗时是两者中较慢的那个。

```tsx
// app/artist/[username]/page.tsx
import Albums from './albums'

async function getArtist(username: string) {
  return (await fetch(`https://api.example.com/artist/${username}`)).json()
}

async function getAlbums(username: string) {
  return (await fetch(`https://api.example.com/artist/${username}/albums`)).json()
}

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params

  // 先发起请求
  const artistData = getArtist(username)
  const albumsData = getAlbums(username)

  // 再一起等待，总耗时是两者中较慢的那个
  const [artist, albums] = await Promise.all([artistData, albumsData])

  return (
    <>
      <h1>{artist.name}</h1>
      <Albums list={albums} />
    </>
  )
}
```

关键在于 `fetch` 是**调用即发起**的。上面先调用 `getArtist(username)` 而不 await，请求已经飞出去了；等到 `Promise.all` 才真正等待，所以两次请求是重叠的。

> `Promise.all` 有一个失败就整体失败的特性。需要部分成功时用 `Promise.allSettled`。另外注意：**任何一个组件内部**，多个 `async`/`await` 只要顺序写下来就仍然是串行的——布局和页面之间天然并行，但组件内部不会。

### 有依赖关系时用 Suspense 隔离

有些请求确实有依赖：`<Playlists>` 需要先拿到 `artist.id` 才能取。

```tsx
// app/artist/[username]/page.tsx
import { Suspense } from 'react'

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const artist = await getArtist(username)

  return (
    <>
      <h1>{artist.name}</h1>
      {/* 播放列表加载时显示 fallback */}
      <Suspense fallback={<div>Loading...</div>}>
        <Playlists artistID={artist.id} />
      </Suspense>
    </>
  )
}

async function Playlists({ artistID }: { artistID: string }) {
  const playlists = await getArtistPlaylists(artistID)
  return (
    <ul>
      {playlists.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  )
}
```

这样播放列表能在艺术家数据就绪后流式补上，而不是阻塞整页。但页面本身仍然要等 `getArtist` 才能显示任何东西——所以要保证第一个请求足够快，否则它挡住了后面一切。实在快不了就考虑缓存它（如果数据不常变）。

### 预加载：把请求提前

组件渲染得晚，即使请求输入早就有了，它的数据请求也会晚开始。预加载就是在阻塞工作之前先把请求发出去：先调用取数函数（不 await），再在消费数据的组件里调同一个函数。

```tsx
// app/item/[id]/page.tsx
import Item, { preload } from './item'
import { checkIsAvailable } from '@/app/lib/data'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  preload(id) // 先发起
  const isAvailable = await checkIsAvailable(id) // 这个跑的时候，item 请求在并行进行

  return isAvailable ? <Item id={id} /> : null
}
```

**前提是取数函数要能去重**，否则 `<Item>` 里那次调用会重新发一遍请求：`fetch` 的相同请求自动 memoized；ORM 查询用 `React.cache` 包起来；Cache Components 下加 `'use cache'`（读运行期数据的用 `'use cache: private'`）。预加载函数要放在消费数据的组件旁边，这样组件被移动或删除时依赖关系容易发现。

## 用 `React.cache` 在同一请求内去重

`fetch` 之外的取数（ORM、数据库查询）没有自动去重，用 `React.cache` 包一层：

```ts
// app/lib/user.ts
import { cache } from 'react'
import { db, eq, users } from '@/lib/db'

export const getUser = cache(async (id: string) => {
  return db.query.users.findFirst({ where: eq(users.id, id) })
})
```

```tsx
// app/dashboard/page.tsx
import { getUser } from '../lib/user'

export default async function DashboardPage() {
  const user = await getUser('1')
  if (!user) return null
  return <h1>Dashboard for {user.name}</h1>
}
```

同一个请求内、参数相同的调用会返回同一份 memoized 结果。多个组件都可以直接调 `getUser('1')`，不用层层传 props。

`React.cache` 的作用域**只限当前请求**，每个请求有自己的 memoization 作用域，请求之间不共享。要跨请求缓存请用 `'use cache'`。

> 注意：`React.cache` 在 `'use cache'` 边界**内部是隔离的**。在缓存函数外面通过 `React.cache` 存的值，在缓存函数里面读不到。往缓存作用域里传数据要用函数参数。

## 客户端获取：什么时候需要

服务端能拿到数据时，优先在服务端取。客户端获取只在两种情况下才是必要的：

- 数据依赖**只有客户端才知道的状态**（当前滚动位置、客户端本地存储、用户尚未提交的输入）。
- 数据在**用户交互之后**才产生（点"加载更多"、实时搜索联想、轮询）。

两种做法：

### 把 Promise 传给客户端组件，用 `use` 读

服务端开始取数但**不 await**，把 promise 当 prop 传下去，客户端组件用 React 的 `use` API 读。这样请求在客户端运行之前就已经开始，客户端不需要挂载后再发一次。

```tsx
// app/blog/page.tsx
import Posts from '@/app/ui/posts'
import { Suspense } from 'react'

export default function Page() {
  // 不 await
  const posts = getPosts()

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Posts posts={posts} />
    </Suspense>
  )
}
```

```tsx
// app/ui/posts.tsx
'use client'
import { use } from 'react'

export default function Posts({ posts }: { posts: Promise<Post[]> }) {
  const allPosts = use(posts)

  return (
    <ul>
      {allPosts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

多个客户端组件需要同一份数据时，把 promise 通过 context 提供，别一个个当 prop 传。

### SWR / React Query

真正需要客户端缓存、重试、焦点重新验证、乐观更新这些能力时，用社区库。它们有自己的缓存、流式和失效语义，和 Next.js 的服务端/客户端缓存是**两套独立系统**。

选型建议：

| 需求 | 选择 |
|---|---|
| 首屏数据 | 服务端组件里直接 await |
| 服务端已开始取、客户端要边流边渲染 | 传 Promise + `use()` |
| 客户端状态驱动的取数、轮询、无限滚动 | SWR / React Query |
| 需要和 Next.js 服务端缓存协同 | 服务端缓存为主，客户端库只处理交互态数据 |

`'use client'` 组件里用 `useSWR(url, fetcher)` 这种写法本身没问题，但要清楚它的缓存和 Next.js 的服务端缓存没有关系。

## 请求 API 全部转异步

这是 16 里影响面最广的变更，几乎所有取数示例都会碰到：

| 旧（同步） | 新（必须 await） |
|---|---|
| `params` | `await params` |
| `searchParams` | `await searchParams` |
| `cookies()` | `await cookies()` |
| `headers()` | `await headers()` |
| `draftMode()` | `await draftMode()` |

```tsx
// app/blog/[slug]/page.tsx
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  // ...
}
```

官方还推荐用 `next typegen` 生成的 `PageProps` / `LayoutProps` 类型代替手写泛型：`PageProps<'/blog/[slug]'>`。

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条。

## 常见坑

- **现象**：以为 `fetch` 默认会缓存，改了远端数据后页面一直显示旧的；或者反过来，以为会缓存，结果每次都请求一遍。
  **原因**：`fetch` 默认是 `auto no cache`——**默认不缓存**。缓存是 opt-in 的。这个默认值在 15 之后就变了，很多教程还在讲旧行为。
  **解法**：明确写出意图。要缓存用 `cache: 'force-cache'` 或 `next: { revalidate: n }`；要每次取最新用 `cache: 'no-store'`。在 Cache Components 下更推荐用 `'use cache'` 把缓存意图写在函数上。

- **现象**：配了 `{ revalidate: 3600, cache: 'no-store' }`，两个设置都没生效，终端还有一条警告。
  **原因**：这两个选项冲突，Next.js 的做法是**两者都忽略**，而不是报错。
  **解法**：二选一。需要定时刷新就用 `revalidate`；需要每次都新就用 `no-store`，然后自己想办法控制频率。

- **现象**：页面明明没几个请求，却要等好几秒；日志里看到请求是一个接一个发生的。
  **原因**：多个 `await` 顺序写在同一个组件里，形成了请求瀑布。后一个请求要等前一个完成才开始。
  **解法**：先调用所有取数函数（不 await），再 `Promise.all` 一起等。有真实依赖关系时，把下游组件包进 `<Suspense>` 让它流式补上，而不是让整个页面等。

- **现象**：同一个请求在一次渲染里跑了两遍（日志里出现重复查询），或者 `preload()` 调了之后组件里又发了一次请求。
  **原因**：`fetch` 的自动去重只覆盖 `GET` 且 URL 和选项相同的请求。ORM / 数据库查询不在覆盖范围内，预加载依赖去重才能生效。
  **解法**：把 ORM 取数函数用 `React.cache` 包起来。注意它只活当前请求，且和 `'use cache'` 作用域是隔离的——别指望用 `React.cache` 往缓存函数里传数据。

- **现象**：升级到 16 后，`params.slug` 直接访问拿到 `undefined`，或者类型报错说不能对 Promise 取属性。
  **原因**：`params`、`searchParams`、`cookies()`、`headers()`、`draftMode()` 全部转成了异步 API，必须 await。
  **解法**：按上面的表格逐个改。类型上把 `params` 标成 `Promise<{...}>`，或者用 `PageProps<'/path'>` 让 `next typegen` 生成。

- **现象**：开发环境里明明用了 `no-store`，数据还是旧的，改了几次都不刷新。
  **原因**：Next.js 在本地开发时会跨 HMR 缓存服务端组件里的 `fetch` 响应（`serverComponentsHmrCache`），默认对所有 fetch 生效，包括 `no-store`。另外，请求带 `cache-control: no-cache` 头时（硬刷新或 DevTools 禁用缓存），`cache`、`next.revalidate`、`next.tags` 会被忽略、直接回源。
  **解法**：导航或整页刷新会清掉 HMR 缓存。需要彻底绕开可以关掉 `serverComponentsHmrCache`。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 页面取数 | `getServerSideProps` / `getStaticProps` | 服务端组件里直接 `await` |
| 客户端取数 | `useEffect` + `useState` | 服务端取好传 props，或传 Promise 给 `use()` |
| 路由参数 | `const { slug } = params` | **`const { slug } = await params`** |
| 读 cookie | `cookies().get('x')` | **`await cookies()`** 后再 `.get('x')` |
| 请求头 | `headers().get('x')` | **`await headers()`** 后再 `.get('x')` |
| 类型声明 | 手写 `{ params: { slug: string } }` | `PageProps<'/blog/[slug]'>`（`next typegen` 生成） |
| 假设 fetch 默认缓存 | 常见 | **默认不缓存**，缓存要显式写 |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条。

## API / 配置速查

| API / 选项 | 签名 | 说明 |
|---|---|---|
| `fetch(url, { cache })` | `'force-cache' \| 'no-store'` | 默认 `auto no cache`，缓存需显式开启 |
| `fetch(url, { next: { revalidate } })` | `false \| 0 \| number`（秒） | 缓存寿命；冲突配置会被双双忽略 |
| `fetch(url, { next: { tags } })` | `string[]` | tag 上限 256 字符，单请求最多 128 个 |
| `React.cache(fn)` | 返回同签名函数 | 同一请求内按参数去重，跨请求不共享 |
| `Promise.all([...])` | — | 并发等待，一失败全失败 |
| `Promise.allSettled([...])` | — | 并发等待，部分失败仍返回 |
| `preload()` | 自定义约定 | 在阻塞工作前先启动请求，需取数函数可去重 |

## 延伸阅读

- [官方文档：Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data)
- [官方文档：`fetch` API 参考](https://nextjs.org/docs/app/api-reference/functions/fetch)
- [官方文档：Data Security](https://nextjs.org/docs/app/guides/data-security)
- [官方文档：Client-side data fetching](https://nextjs.org/docs/app/guides/client-side-data-fetching)
- [React 文档：`cache`](https://react.dev/reference/react/cache)
- [React 文档：`use`](https://react.dev/reference/react/use)
