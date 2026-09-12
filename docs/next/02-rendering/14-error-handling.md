# 14 · 错误处理

> **一句话结论**：错误分两类，处理方式完全相反。**预期错误**（表单校验失败、资源不存在）是业务流程的一部分，用**返回值**表达，不要 throw；**未捕获异常**（bug、依赖挂了）用**错误边界**兜住。分界线是："这个错误是否属于程序的正常路径"——是就走返回值，不是就交给边界。

## 最小可运行示例

```ts
// app/actions.ts
'use server'

import { z } from 'zod'

const schema = z.object({ title: z.string().min(1, 'Title is required') })

type FormState = { message?: string }

// 预期错误：用返回值表达，不 throw
export async function createPost(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validated = schema.safeParse({ title: formData.get('title') })
  if (!validated.success) return { message: 'Title is required' }

  const res = await fetch('https://api.vercel.app/posts', {
    method: 'POST',
    body: JSON.stringify(validated.data),
  })
  if (!res.ok) return { message: 'Failed to create post' }

  return {}
}
```

```tsx
// app/ui/form.tsx
'use client'

import { useActionState } from 'react'
import { createPost } from '@/app/actions'

const initialState = { message: '' }

export function Form() {
  const [state, formAction, pending] = useActionState(createPost, initialState)

  return (
    <form action={formAction}>
      <input type="text" name="title" required />
      {state.message && <p aria-live="polite">{state.message}</p>}
      <button disabled={pending}>Create Post</button>
    </form>
  )
}
```

上面两个文件处理"用户填错了"。程序真的坏掉时用的是另一条通道——`error.tsx` 错误边界，见下一节。

## 预期错误：用返回值表达

预期错误是在应用的正常运转中**会**发生的错误——表单校验失败、请求失败、资源不存在。这类错误应该被显式处理并返回给客户端：**不要用 `try`/`catch` 加 throw，而是把预期错误建模成返回值。**

**为什么不能用 throw？** 三个理由：

1. **throw 会触发错误边界**，把整段 UI 换成错误页。用户填错一个字段，不该让整个表单消失。
2. **throw 的语义是"这里出 bug 了"**。校验失败不是 bug，是正常路径，混在一起会让监控告警充满噪音。
3. **返回值天然可序列化、可被 `useActionState` 消费**。throw 出来的东西要跨网络传给客户端，信息会被剥离（见下文 `error.message` 的说明）。

`aria-live="polite"` 让屏幕阅读器播报错误消息——错误提示只是视觉上显示是不够的。服务端组件取数时同理，根据响应直接决定渲染什么或 `redirect`。

## 未捕获异常：用边界兜住

未捕获异常是**不该在正常流程中出现**的错误，代表 bug 或依赖故障。这类错误应该 throw 出去，由错误边界接住。

### `error.tsx`：路由段级的错误边界

```tsx
// app/dashboard/error.tsx
'use client' // 错误边界必须是客户端组件

import { useEffect } from 'react'

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error) // 上报到错误监控服务
  }, [error])

  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => retry()}>Try again</button>
    </div>
  )
}
```

`error.js` 把路由段及其嵌套子节点包进一个 React Error Boundary。边界内抛错时，`error` 组件作为 fallback 渲染。错误会**冒泡到最近的父级错误边界**，所以可以在路由层级的不同位置放 `error.tsx` 实现分级处理。

| Prop | 说明 |
|---|---|
| `error` | 转发给客户端组件的 `Error` 实例 |
| `retry` | 重新尝试：重新取数并重新渲染边界的子节点。成功的话 fallback 被替换成渲染结果 |
| `reset`（仍存在） | 大多数情况应该用 `retry()`。只有需要**清空错误状态、重新渲染子节点但不重新取数**时才用它 |

**`retry` 是 16.3 才转正的**：`v16.2.0` 里叫 `unstable_retry`，`v16.3.0` 稳定为 `retry`。查到的旧写法如果还在用 `reset`，先判断是不是真的需要"不重新取数"这个语义。

### `error.message` 在开发和生产下不一样

这一条直接影响你怎么设计错误提示：

- **从客户端组件转发的错误**：显示原始 `Error` 消息。
- **从服务端组件转发的错误**：显示**一条通用消息加一个标识符**，防止泄漏敏感细节。这个标识符在 `error.digest` 里。

`error.digest` 是抛出的错误自动生成的哈希，用来和服务端日志里的对应错误匹配。所以**不要指望把服务端的错误消息直接渲染给用户看**——生产环境下它会是通用的。用 `digest` 在服务端日志里定位，给用户看的是你自己设计的提示文案。

### 组件级的错误边界：`catchError`

`error.tsx` 绑定在路由段上。想给树里任意位置加错误边界（不受路由结构约束），用 `next/error` 的 `catchError`：

```tsx
// app/custom-error-boundary.tsx
'use client'

import { catchError, type ErrorInfo } from 'next/error'

function ErrorFallback(props: { title: string }, { error, retry }: ErrorInfo) {
  return (
    <div>
      <h2>{props.title}</h2>
      <p>{error.message}</p>
      <button onClick={() => retry()}>Try again</button>
    </div>
  )
}

export default catchError(ErrorFallback)
```

用法是把它当组件包住任意子树：`<ErrorBoundary title="Dashboard Error">{children}</ErrorBoundary>`。这是实现"只有这一块崩了、其余照常"的手段。

### `global-error.tsx`：根布局的错误

`error.tsx` **不包同段的 `layout.js` 和 `template.js`**（它包的是下一层级的布局）。要处理根布局的错误，用 `app/global-error.tsx`：

```tsx
// app/global-error.tsx
'use client' // 错误边界必须是客户端组件

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    // global-error 必须自带 html 和 body 标签
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => retry()}>Try again</button>
      </body>
    </html>
  )
}
```

两个必须记住的限制：

1. **必须自带 `<html>` 和 `<body>`**。它激活时会替换根布局或模板。
2. **不支持 `metadata` / `generateMetadata` 导出**，因为错误边界必须是客户端组件。替代方案是用 React 的 [`<title>`](https://react.dev/reference/react-dom/components/title) 组件。

另外，`global-error` 和内置的 500 页面渲染自己的文档，**不会包含你的全局样式**，所以应用级的主题切换到不了这里，默认 UI 只跟随操作系统的配色方案。

### 错误边界抓不到什么

**错误边界抓不到事件处理器里的错误**。它们的设计目标是捕获**渲染期**的错误以显示 fallback UI，而事件处理器和异步代码在渲染之后运行。这类情况要自己 catch 并存储：

```tsx
// app/ui/button.tsx
'use client'

import { useState } from 'react'

export function Button() {
  const [error, setError] = useState<Error | null>(null)

  const handleClick = () => {
    try {
      // 做一些可能失败的工作
      throw new Error('Exception')
    } catch (reason) {
      setError(reason as Error)
    }
  }

  if (error) return <p>出错了：{error.message}</p>
  return <button type="button" onClick={handleClick}>Click me</button>
}
```

**但有一个例外**：`useTransition` 的 `startTransition` 里未处理的错误**会**冒泡到最近的错误边界。这个差异的实际意义：**调用 Server Action 时如果包在 `startTransition` 里，错误会走错误边界**。所以 action 里该用返回值表达的预期错误不要 throw——throw 了会把你精心做的表单 UI 换成错误页。

## `not-found.tsx` 与 `notFound()`

资源不存在属于预期错误，Next.js 给它单独开了一条通道。

```tsx
// app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { getPostBySlug } from '@/lib/posts'

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post) notFound()

  // 这里 post 已经确定有值——notFound() 返回 never
  return <div>{post.title}</div>
}
```

```tsx
// app/blog/[slug]/not-found.tsx
export default function NotFound() {
  return <div>404 - Page Not Found</div>
}
```

调用 `notFound()` 会抛出一个 `NEXT_HTTP_ERROR_FALLBACK;404` 错误，终止所在路由段的渲染，同时 Next.js 注入 `<meta name="robots" content="noindex" />` 防止被索引。**不需要写 `return notFound()`**——它抛异常终止函数执行，TypeScript 从 `never` 返回类型理解这一点，所以前面的检查之后变量会被正确收窄。

**能用在哪里**：服务端组件、Server Functions、Route Handlers。在 Route Handler 里它会返回一个 `404` 给调用方。

`not-found.js` 在组件层级里渲染在 `loading.js` 和 `page.js` **之间**，被同段的 `loading.js` 的 `<Suspense>` 边界和 `error.js` 的错误边界包裹。状态码行为：

| 情况 | 状态码 |
|---|---|
| 非流式响应 | `404` |
| 流式响应 | `200`，靠 `noindex` meta 标签防止索引 |

> 另有实验性的 `global-not-found.js`（需 `experimental.globalNotFound: true`），用于请求的 URL **完全匹配不到任何路由**的情况。它绕过正常渲染，要自己 import 全局样式和字体。

## `redirect()` 的正确用法与限制

| 参数 | 类型 | 说明 |
|---|---|---|
| `path` | `string` | 目标 URL，可以是相对或绝对路径 |
| `type` | `'replace'`（默认）或 `'push'`（Server Actions 里的默认） | 跳转方式 |

默认行为：在 Server Actions 里用 `push`（往浏览器历史栈加一条），**其他地方都用 `replace`**。可以用 `RedirectType.replace` / `RedirectType.push` 显式指定，但 `type` 参数在服务端组件里**没有效果**。

```tsx
// app/team/[id]/page.tsx
import { redirect } from 'next/navigation'

export default async function Profile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const team = await fetchTeam(id)

  if (!team) redirect('/login')

  return <div>{/* ... */}</div>
}
```

### 它抛异常，所以有两条硬性约束

1. **在 Server Actions 和 Route Handlers 里，必须写在 `try` 块外面。** 它抛的是 `NEXT_REDIRECT` 控制流异常，被 `try/catch` 吞掉就失效了。同理，`redirect` 之后的代码不会执行——需要新数据的场景要把重新验证放在它前面。
2. **不要在客户端组件的事件处理器里用**，那里用 `useRouter` hook。

其他行为：在客户端组件的**渲染过程中**可以用（不是事件处理器里），首次页面加载走 SSR 时会执行服务端重定向；接受绝对 URL，可以跳外部链接；想在渲染之前就重定向，用 `next.config.js` 的 redirects 或 Proxy；需要 308 永久重定向用 `permanentRedirect`。

### 为什么是 307 和 308

`redirect()` 默认用 `307` 而不是 `302`，原因在于方法保持：`302` 是临时重定向，会把请求方法从 `POST` 改成 `GET`；`307` 保持 `POST`；`308` 是永久重定向且保持方法。从 `/users` 重定向到 `/people` 时，如果发的是 `POST /users` 想创建用户，按 `302` 的语义会被改成 `GET /people`——这没道理，创建用户应该 POST 到 `/people`，`307` 解决了这个问题。**一个例外**：Server Action 的表单提交用 `303`，让浏览器用 `GET` 跟随重定向。JS 可用时，Server Action 走的是客户端导航而不是 HTTP 重定向。

## 流式渲染下的错误恢复

流式让错误处理多了一条时间线：**错误发生在流开始之前还是之后**。响应头（含状态码）在流开始时就已经发给客户端，**流开始后无法再修改状态码或响应头**——本节所有行为都源于这条约束。

如果组件在流开始之后抛错，最近的 `error.js` 边界会接住它，用错误 UI 替换那个失败的组件，**页面其余部分保持完好**。

| 流开始后调用的 | 实际行为 |
|---|---|
| `notFound()` | 无法返回 404，改为注入 `<meta name="robots" content="noindex">` |
| `redirect()` | 无法返回 HTTP 重定向头，退化成客户端跳转 |

响应体在以下情况开始流式发送：Suspense fallback 渲染时（比如 `loading.tsx`），或者组件在 `<Suspense>` 边界下挂起时。所以要拿到真实的 HTTP 状态码，**把 `notFound()` 放在任何 `await` 和任何 Suspense 边界之前**：

```tsx
// app/post/[slug]/page.tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { PostContent } from './post-content'

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const exists = await checkSlugExists(slug) // 快速存在性检查
  if (!exists) notFound() // 真正的 404，在任何 Suspense 边界之前

  return (
    <Suspense fallback={<p>Loading post...</p>}>
      <PostContent slug={slug} />
    </Suspense>
  )
}
```

想既保留 shell 和加载 UI、又处理不存在的情况，可以把检查放在 `<Suspense>` 包住的组件里。这时异常会传播到最近的 `not-found` 边界，在已发出的页面 shell 里就地渲染——代价是状态码只能是 200：

```tsx
// app/blog/[slug]/page.tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'

async function getPost(slug: string) {
  const res = await fetch(`https://api.example.com/posts/${slug}`)
  if (res.status === 404) notFound() // 资源不存在（预期）
  if (!res.ok) throw new Error(`Failed to load post: ${res.status}`) // 取数失败（异常）
  return res.json()
}

async function Article({ slug }: { slug: string }) {
  return <article>{(await getPost(slug)).title}</article>
}

export default async function PostPage({ params }: PageProps<'/blog/[slug]'>) {
  const { slug } = await params
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <Article slug={slug} />
    </Suspense>
  )
}
```

注意 `getPost` 里两条路分开走：`404` 走 `notFound()`（预期），其他非 2xx 走 `throw`（异常）。

**需要真实 404 时**，检查就不能发生在流开始之后。两个办法：把检查提到所有 `await` 和 Suspense 边界之前（如上文）；或者在 [`proxy`](../03-routing-network/16-proxy.md) 里检查——它在页面渲染之前运行，HTTP 状态码还可控，可以 rewrite 到 not-found 路由或直接产生 404 响应。Proxy 里的检查要保持快，别在里面取完整内容。开启 Cache Components 后每条动态路由都会先流一个静态外壳，所以后一种办法往往是唯一能拿到真实 404 的路径。

## 常见坑

- **现象**：表单校验失败时，整个页面被错误页替换了。
  **原因**：在校验失败的分支里 `throw` 了。throw 会触发错误边界，把整段 UI 换成 fallback。
  **解法**：预期错误**用返回值表达**。把校验结果作为 action 的返回值，客户端用 `useActionState` 的 `state` 渲染提示。只有真正的 bug 才 throw。

- **现象**：本地开发时错误提示很详细，生产环境只显示"An error occurred"加一串哈希。
  **原因**：这是有意设计。从服务端组件转发的错误在生产环境下只显示通用消息加标识符，防止泄漏敏感细节。开发环境会序列化原始 `message` 方便调试。
  **解法**：用 `error.digest` 去服务端日志里定位具体错误。给用户看的提示文案自己设计，不要依赖错误对象里的消息。

- **现象**：升级到 16 后 `error.tsx` 里的 `reset()` 行为不符合预期，或者查到别人用 `unstable_retry`。
  **原因**：`retry` 在 `v16.2.0` 时叫 `unstable_retry`，`v16.3.0` 才稳定为 `retry`。`reset` 仍然存在，但语义不同——它清空错误状态并重新渲染子节点，**不重新取数**。
  **解法**：需要"重新取数并重新渲染"用 `retry()`（绝大多数场景）。只有确实需要不重新取数时才用 `reset()`。

- **现象**：事件处理器里抛错，错误边界没反应，控制台一片红。
  **原因**：错误边界的设计目标是捕获**渲染期**错误。事件处理器和普通异步代码在渲染之后运行，不在边界覆盖范围内。
  **解法**：自己 `try/catch` 并用 `useState` / `useReducer` 存起来，再更新 UI。**例外**：`useTransition` 的 `startTransition` 里未处理的错误**会**冒泡到最近的错误边界——所以调用 Server Action 时不要随手 throw，否则会把表单 UI 换成错误页。

- **现象**：不存在的详情页返回 200，搜索引擎收录了。
  **原因**：`notFound()` 在流开始之后才触发。`200 OK` 已经发出，状态码改不了，Next.js 只能注入 `noindex` 兜底。
  **解法**：把存在性检查提到所有 `await` 和 Suspense 边界之前。需要绝对可靠就用 Proxy 在渲染前检查。注意流式响应下 `not-found.js` 返回的就是 200，非流式才返回 404。

- **现象**：`redirect()` 完全没生效，后面的代码还在跑。
  **原因**：它被包在 `try/catch` 里了。`redirect` 抛的是控制流异常，被 catch 吞掉就失效。
  **解法**：把 `redirect` 移到 `try` 块**外面**。同理，它之后的代码不会执行——需要新数据的场景把 `updateTag` / `revalidatePath` 放在它前面。

- **现象**：`notFound()` 调了，404 页面没渲染，服务端日志出现 `⨯ unhandledRejection: NEXT_HTTP_ERROR_FALLBACK;404`。
  **原因**：`notFound()` 靠抛异常工作，必须发生在渲染路径上——组件里，或者组件 await 的函数里。留在一个没有被 await 的 promise 里，异常会抛到没人接住的地方。
  **解法**：确保调用发生在被 await 的调用链上。另外，如果它被 `try/catch` 包住，中断异常也会被吞掉——需要就近捕获其他错误时，先用 `unstable_rethrow` 把这个中断放行。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 错误边界重试 | `reset()` | **`retry()`**（`v16.3.0` 起稳定，之前叫 `unstable_retry`） |
| 组件级错误边界 | 手写 `class extends Component` | **`catchError`**（`next/error`） |
| 表单校验失败 | `throw new Error(...)` | **返回 `{ errors }` 对象** |
| 全局 404 页面 | 只能靠根 `not-found.js` | `global-not-found.js`（实验性，`experimental.globalNotFound`） |
| `notFound()` 的调用点 | 不讲究位置 | 要在流开始**之前**才能拿到真实 404 |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条（请求 API 转异步，影响 `params` 在存在性检查里的写法）。

## API / 配置速查

| 文件 / API | 作用 | 关键约束 |
|---|---|---|
| `error.tsx` | 路由段级错误边界 | 必须是客户端组件；包同段 `loading`/`not-found`/`page`/嵌套 `layout`；**不包**同段 `layout`、`template` |
| `global-error.tsx` | 根布局错误 | 必须自带 `<html>` 和 `<body>`；不支持 `metadata` |
| `not-found.tsx` | `notFound()` 的 UI | 渲染在 `loading.js` 和 `page.js` 之间 |
| `global-not-found.tsx` | 全应用 404（实验性） | 需 `experimental.globalNotFound: true`；绕过正常渲染，自己 import 样式 |
| `notFound()` | 抛出 404 | 会注入 `noindex`；可用在服务端组件、Server Functions、Route Handlers |
| `redirect(path, type)` | 重定向 | 抛异常，必须写在 `try` 外；客户端事件处理器里用 `useRouter` |
| `permanentRedirect()` | 308 永久重定向 | — |
| `catchError(fn)` | 组件级错误边界 | 从 `next/error` 导入，`ErrorInfo` 提供 `error` 和 `retry` |

| `error.tsx` 的 props | 说明 |
|---|---|
| `error` | `Error & { digest?: string }` |
| `error.digest` | 服务端日志匹配用的哈希 |
| `retry` | 重新取数并重新渲染子节点 |
| `reset` | 清空错误状态并重新渲染，**不重新取数** |

| 流式下的错误场景 | 结果 |
|---|---|
| 组件在流开始后抛错 | 最近的 `error.js` 就地替换该组件，页面其余部分完好 |
| 流开始后 `notFound()` | 状态码保持 200，注入 `noindex` |
| 流开始后 `redirect()` | 退化为客户端跳转 |

## 延伸阅读

- [官方文档：Error Handling](https://nextjs.org/docs/app/getting-started/error-handling)
- [官方文档：`error.js`](https://nextjs.org/docs/app/api-reference/file-conventions/error)
- [官方文档：`not-found.js`](https://nextjs.org/docs/app/api-reference/file-conventions/not-found)
- [官方文档：`notFound()`](https://nextjs.org/docs/app/api-reference/functions/not-found)
- [官方文档：`redirect()`](https://nextjs.org/docs/app/api-reference/functions/redirect)
- [官方文档：`catchError`](https://nextjs.org/docs/app/api-reference/functions/catchError)
- [官方文档：`loading.js` 的状态码说明](https://nextjs.org/docs/app/api-reference/file-conventions/loading#status-codes)
- [React 文档：错误边界](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
