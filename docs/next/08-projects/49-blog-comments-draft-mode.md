# 49 · Blog C：评论与草稿模式

> **一句话结论**：Draft Mode 会绕过 **Next.js 自己的**所有缓存层，但**绕不过你自己写的缓存**——Redis、模块级 `Map`、任何按 slug 作键的自建缓存，都会把草稿内容泄漏给公开访客。这是本章唯一必须记住的事，其余都是细节。

## 最小可运行示例

```prisma
// prisma/schema.prisma（新增片段）
model Comment {
  id        String   @id @default(cuid())
  postSlug  String
  author    String
  body      String

  // 审核状态：先入库再审核，避免「提交即公开」被刷
  approved  Boolean  @default(false)

  createdAt DateTime @default(now())

  // 评论列表按文章查、按时间倒序
  @@index([postSlug, approved, createdAt(sort: Desc)])
}
```

```ts
// app/actions/comments.ts
'use server'

import { z } from 'zod'
import { updateTag } from 'next/cache'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'

const commentSchema = z.object({
  postSlug: z.string().min(1).max(200),
  author: z.string().trim().min(1, { error: '请填写昵称' }).max(40),
  body: z
    .string()
    .trim()
    .min(2, { error: '评论太短了' })
    .max(2000, { error: '评论不能超过 2000 字' }),
  // 蜜罐字段：正常用户看不到它，爬虫会填
  website: z.string().max(0).optional(),
})

export type CommentState = {
  errors?: Record<string, string[]>
  message?: string
  ok?: boolean
}

export async function submitComment(
  _prev: CommentState,
  formData: FormData
): Promise<CommentState> {
  const parsed = commentSchema.safeParse({
    postSlug: formData.get('postSlug'),
    author: formData.get('author'),
    body: formData.get('body'),
    website: formData.get('website') ?? undefined,
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  // 蜜罐被填了：假装成功，不写入。
  // 告诉爬虫「失败了」会让它调整策略，告诉它「成功了」它下次还会来
  if (parsed.data.website) return { ok: true }

  // 文章必须存在，否则任何人都能往任意 slug 下灌评论
  const post = await getPostBySlug(parsed.data.postSlug)
  if (!post) return { message: '文章不存在' }

  await prisma.comment.create({
    data: {
      postSlug: parsed.data.postSlug,
      author: parsed.data.author,
      body: parsed.data.body,
    },
  })

  // 评论进审核队列，公开列表还没变，不需要失效缓存。
  // 审核通过的那一步才需要 updateTag(`comments:${slug}`)
  return { ok: true }
}
```

```tsx
// app/blog/[slug]/comment-form.tsx
'use client'

import { useActionState, useOptimistic, useRef } from 'react'
import { submitComment } from '@/app/actions/comments'
import { SubmitButton } from '@/components/submit-button'

type Comment = { id: string; author: string; body: string; createdAt: string }

export function CommentSection({
  postSlug,
  comments,
}: {
  postSlug: string
  comments: Comment[]
}) {
  const [optimistic, addOptimistic] = useOptimistic(
    comments,
    (state, next: Comment) => [next, ...state]
  )

  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction] = useActionState(
    async (prev: Parameters<typeof submitComment>[0], formData: FormData) => {
      addOptimistic({
        id: `optimistic-${Date.now()}`,
        author: String(formData.get('author') ?? ''),
        body: String(formData.get('body') ?? ''),
        createdAt: new Date().toISOString(),
      })

      const result = await submitComment(prev, formData)
      if (result.ok) formRef.current?.reset()
      return result
    },
    {}
  )

  return (
    <section className="mt-16">
      <h2 className="mb-6 text-xl font-semibold">
        {optimistic.length > 0 ? `${optimistic.length} 条评论` : '评论'}
      </h2>

      <form ref={formRef} action={formAction} className="mb-10 space-y-3">
        <input type="hidden" name="postSlug" value={postSlug} />

        {/* 蜜罐：用 CSS 藏起来而不是 type="hidden"，
            爬虫会跳过 hidden 但会尝试填普通输入框 */}
        <div className="absolute -left-[9999px]" aria-hidden="true">
          <label htmlFor="website">网址</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>

        <input
          name="author"
          placeholder="昵称"
          required
          maxLength={40}
          className="w-full rounded border px-3 py-2"
        />
        {state.errors?.author && (
          <p className="text-sm text-red-600">{state.errors.author[0]}</p>
        )}

        <textarea
          name="body"
          rows={4}
          placeholder="说点什么…"
          required
          maxLength={2000}
          className="w-full rounded border px-3 py-2"
        />
        {state.errors?.body && (
          <p className="text-sm text-red-600">{state.errors.body[0]}</p>
        )}

        <SubmitButton>发表评论</SubmitButton>
      </form>

      <ul className="space-y-6">
        {optimistic.map((comment) => {
          const pending = comment.id.startsWith('optimistic-')
          return (
            <li key={comment.id} className={pending ? 'opacity-50' : undefined}>
              <div className="flex items-baseline gap-3">
                <span className="font-medium">{comment.author}</span>
                <time className="text-sm text-slate-400">
                  {new Date(comment.createdAt).toLocaleString('zh-CN')}
                </time>
                {pending && <span className="text-xs text-slate-400">待发布</span>}
              </div>
              <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
```

## 评论系统的三个设计决策

### 先入库、后审核，而不是先审核

`approved` 默认 `false`。用户提交后立刻看到自己的评论（乐观 UI），但**其他人看不到**。

对比「提交即公开」：

| | 先入库后审核 | 提交即公开 |
|---|---|---|
| 垃圾评论暴露窗口 | 无 | 到被发现为止 |
| 用户体验 | 自己的评论立即可见 | 立即可见 |
| 实现复杂度 | 多一个审核流程 | 少 |
| 内容责任 | 可控 | 不可控 |

乐观 UI 让「待审核」这件事在体验上不可见——用户看到的是「我的评论已经发出去了」。

### 蜜罐而不是验证码

```tsx
// app/blog/[slug]/comment-form.tsx（片段）
<div className="absolute -left-[9999px]" aria-hidden="true">
  <input id="website" name="website" tabIndex={-1} autoComplete="off" />
</div>
```

蜜罐的原理：正常用户看不到这个字段（移出视口 + `aria-hidden` + `tabIndex={-1}`），但简单的爬虫会「填满所有输入框」。填了就是机器人。

**为什么用 CSS 移出视口而不是 `type="hidden"`**：`type="hidden"` 是表单里常见的正常字段，爬虫会跳过；普通 `<input>` 更容易被无差别填充。

**被填了之后要假装成功**，不要返回错误。返回错误等于告诉爬虫「这个字段有问题」，它会调整策略。返回成功则让它以为得手了。

**蜜罐拦不住定向攻击**，它只拦无差别扫描。真正的防护是**限流**——按 IP 或按会话限制提交频率。限流状态放 Redis 或数据库，不要放模块级 `Map`（多实例下每个实例一份，等于没限）。

### 评论列表的缓存

```ts
// lib/comments.ts
import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'
import { prisma } from '@/lib/db'

export async function getApprovedComments(postSlug: string) {
  'use cache'
  cacheLife('minutes')
  cacheTag(`comments:${postSlug}`)

  const rows = await prisma.comment.findMany({
    where: { postSlug, approved: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, author: true, body: true, createdAt: true },
  })

  return rows.map((r) => ({
    id: r.id,
    author: r.author,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
  }))
}
```

审核通过时失效：`updateTag(\`comments:${postSlug}\`)`。用 `updateTag` 而不是 `revalidateTag`，因为审核者点完「通过」就希望立刻在页面上看到结果（read-your-writes），详见 [43 章](./43-notes-app-mutations-cache.md)。

评论列表用 `cacheLife('minutes')` + `cacheTag` 的组合：正常的评论积累靠时间自然刷新，紧急下架靠 `updateTag` 立即生效。

## Draft Mode：预览未发布内容

三步走，官方文档的结构就是这个。

### 第一步：Route Handler 开启

```ts
// app/api/draft/route.ts
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPostBySlug } from '@/lib/posts'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const slug = searchParams.get('slug')

  // 密钥只存在于本应用和 CMS 之间。用环境变量，不要硬编码
  if (!secret || secret !== process.env.DRAFT_SECRET) {
    return new Response('Invalid token', { status: 401 })
  }
  if (!slug) {
    return new Response('Missing slug', { status: 400 })
  }

  // 关键：先确认这篇内容真的存在，再开启 Draft Mode
  const post = getPostBySlug(slug)
  if (!post) {
    return new Response('Invalid slug', { status: 401 })
  }

  const draft = await draftMode()
  draft.enable()

  // 重定向到「查出来的 slug」，不是 searchParams 里的 slug。
  // 直接 redirect(slug) 是开放重定向漏洞——攻击者可以构造
  // ?slug=https://evil.com 把你导到钓鱼站
  redirect(`/blog/${post.slug}`)
}
```

`draft.enable()` 设置一个名为 `__prerender_bypass` 的 cookie。携带这个 cookie 的后续请求会绕过缓存。

**这里用 `GET` 是因为 CMS 的「预览」按钮会在新标签页打开一个 URL**，而浏览器打开新标签页只能是 `GET`。但 `GET` 本应是幂等的，而这个操作改变了后续请求的行为——所以**退出预览用 `POST`**（通过 Server Action），语义上更正确。

### 第二步：渲染草稿

```tsx
// app/blog/[slug]/page.tsx
import { draftMode } from 'next/headers'
import { getPostBySlug } from '@/lib/posts'
import { PreviewBanner } from '@/components/preview-banner'

export default async function PostPage({ params }: PageProps<'/blog/[slug]'>) {
  const { slug } = await params
  const { isEnabled } = await draftMode()

  // 草稿模式下允许读到未发布的内容
  const post = getPostBySlug(slug, { includeDrafts: isEnabled })
  if (!post) notFound()

  const { default: Content } = await import(`@/content/${slug}.mdx`)

  return (
    <article>
      {isEnabled && <PreviewBanner />}
      <h1>{post.title}</h1>
      <div className="prose">
        <Content />
      </div>
    </article>
  )
}
```

**如果草稿和已发布内容在同一个 URL 提供（大多数 headless CMS 是这样），取数代码一行都不用改**——Draft Mode 自动绕过缓存，`fetch` 直接打到上游拿最新草稿。只有草稿走**另一个端点**时才需要在 `fetch` 前分支：

```ts
// lib/cms.ts —— 草稿走独立端点时才需要
const { isEnabled } = await draftMode()
const base = isEnabled ? '/preview' : '/published'
const res = await fetch(`https://cms.example.com${base}/posts/${slug}`)
```

分支只决定**从哪读**，缓存绕过的行为两个分支都有。

### 第三步：预览横幅与退出

```tsx
// components/preview-banner.tsx
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'

async function exitPreview() {
  'use server'
  const draft = await draftMode()
  draft.disable()
  redirect('/')
}

export async function PreviewBanner() {
  const { isEnabled } = await draftMode()
  if (!isEnabled) return null

  return (
    <aside
      role="status"
      className="mb-6 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm"
    >
      <span>正在预览草稿内容，访客看不到这一版。</span>
      <form action={exitPreview}>
        <button type="submit" className="underline">
          退出预览
        </button>
      </form>
    </aside>
  )
}
```

**退出用 `<form>` + Server Action，不要用 `<Link>`。** `Link` 会被预取——用户还没点，预取请求就把 cookie 清掉了。表单不预取，无论 `method` 是什么。

## 草稿与公开缓存的隔离：三层防线

这是本章的核心。先说清楚 Draft Mode 到底绕过了什么。

| 缓存层 | Draft Mode 下是否绕过 |
|---|---|
| `fetch` 缓存 | **绕过**，直接打网络 |
| `'use cache'` 组件/函数 | **绕过**，每次请求重新执行，结果**不写入**缓存 |
| `unstable_cache` | **绕过**，读写都不发生 |
| ISR 响应缓存 | **绕过**，页面以 `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` 提供 |
| **你自己写的 Redis / Map 缓存** | **不绕过** ← 问题在这里 |
| **CDN 缓存** | **不绕过** ← 第二层问题 |

### 防线一：不要在自建缓存里存草稿数据

```ts
// lib/cache.ts —— 反面示例
const memory = new Map<string, unknown>()

export async function cached(key: string, fn: () => Promise<unknown>) {
  if (memory.has(key)) return memory.get(key)
  const value = await fn()
  memory.set(key, value)
  return value
}
```

```ts
// app/blog/[slug]/page.tsx —— 反面示例
const post = await cached(`post:${slug}`, () => fetchPost(slug))
```

**这个组合是致命的。** 编辑器在 Draft Mode 下访问 `/blog/hello`，`fetchPost` 拿到了草稿内容，`cached` 把它以 `post:hello` 为键写进了内存。之后所有访客请求 `/blog/hello`，命中的是这份草稿。

**正确做法**：自建缓存的键里**必须包含「是不是草稿」这个维度**，或者干脆不在草稿路径上用自建缓存。

```ts
// lib/cache.ts —— 正确做法
import { draftMode } from 'next/headers'

export async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  // 草稿请求直接穿透，不进缓存也不读缓存
  const { isEnabled } = await draftMode()
  if (isEnabled) return fn()

  // 即使如此，键里也带上环境维度，双保险
  const namespaced = `${process.env.NODE_ENV}:${key}`

  const hit = await store.get(namespaced)
  if (hit) return JSON.parse(hit) as T

  const value = await fn()
  await store.set(namespaced, JSON.stringify(value), { EX: 300 })
  return value
}
```

**为什么还要加环境维度**：预览环境（preview deployment）和正式环境可能共用同一个 Redis。`preview:post:hello` 和 `production:post:hello` 必须是两个键，否则预览环境的草稿会流到正式站。

### 防线二：草稿请求绝不触发失效

```ts
// app/actions/moderate.ts —— 反面示例
'use server'

import { revalidateTag } from 'next/cache'
import { draftMode } from 'next/headers'

export async function saveDraft(slug: string, content: string) {
  await prisma.post.upsert({ where: { slug }, create: {...}, update: { content } })

  // ❌ 在 Draft Mode 下调用失效，等于告诉缓存「用现在这份（草稿）数据重建」
  revalidateTag(`post:${slug}`, 'max')
}
```

`revalidateTag` 的语义是「标记缓存陈旧，下次请求时重建」。如果这次调用的上下文是草稿请求，重建出来的缓存条目**可能就是草稿内容**——它会被所有人看到。

**规则**：`updateTag` / `revalidateTag` / `revalidatePath` / `refresh` 只在**发布动作**里调用，不在保存草稿的动作里调用。

```ts
// app/actions/publish.ts
'use server'

import { updateTag } from 'next/cache'
import { draftMode } from 'next/headers'

export async function publishPost(slug: string) {
  const draft = await draftMode()

  await prisma.post.update({ where: { slug }, data: { published: true } })

  // 发布时可能正处于 Draft Mode（编辑器点完发布就在预览页）。
  // 此时失效是安全的：重建会从「已发布」分支取数
  updateTag(`post:${slug}`)
  // 但不要顺手 disable —— 编辑器可能还想继续预览
}
```

### 防线三：预览响应不能被 CDN 缓存

Next.js 对 Draft Mode 下的页面已经设置了正确的 `Cache-Control`：

```
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
```

`private` 是关键——它告诉 CDN「这是给单个用户的，不要缓存」。

**但这条头只在页面确实走了 Draft Mode 分支时才生效。** 如果你的平台配置里有一条「所有 HTML 响应缓存 60 秒」的规则，它会覆盖掉应用设置的头。上线前用 curl 验证：

```bash
# 带上 bypass cookie 请求，确认响应头里没有 public / max-age
curl -sI -H "Cookie: __prerender_bypass=<token>" https://example.com/blog/hello \
  | grep -i cache-control
```

期望看到 `private, no-cache, no-store, max-age=0, must-revalidate`。看到 `public, max-age=...` 就说明 CDN 或平台规则覆盖了应用的头。

### 隔离检查清单

| 检查项 | 通过标准 |
|---|---|
| 自建缓存 | 草稿请求穿透；键里含环境维度 |
| 失效调用 | 只在发布动作里，不在草稿保存里 |
| 响应头 | Draft Mode 下是 `private, no-cache, no-store` |
| 预览端点 | 有密钥校验，且 `redirect` 到查出来的 slug |
| 退出方式 | `POST`（Server Action），不是 `Link` |
| 草稿可见性 | 页面 metadata 带 `robots: { index: false }` |
| `sitemap.ts` | 不包含草稿文章 |

## 常见坑

- **现象**：编辑器预览过一篇草稿后，所有访客都看到了这篇草稿。
  **原因**：自建缓存（Redis / 内存 `Map`）没有绕过 Draft Mode。Draft Mode 只绕过 Next.js 内置的缓存层。
  **解法**：自建缓存里先判断 `(await draftMode()).isEnabled`，为真时直接穿透不进缓存。键里额外带上环境前缀。

- **现象**：保存草稿后，正式站的页面变成了草稿内容。
  **原因**：保存草稿的动作里调了 `revalidateTag` / `revalidatePath`。缓存被标记陈旧后，下一次请求（可能就是编辑器的预览请求）用草稿数据重建了缓存。
  **解法**：失效调用只放在**发布**动作里。保存草稿不触发任何缓存失效。

- **现象**：预览页面被 CDN 缓存了，普通访客看到预览横幅。
  **原因**：平台层面的缓存规则覆盖了应用设置的 `Cache-Control`。
  **解法**：用 `curl -I` 带上 `__prerender_bypass` cookie 验证响应头。确认平台规则里没有「缓存所有 HTML」这类无差别配置。

- **现象**：点「退出预览」按钮，cookie 没被清掉，或者还没点就被清了。
  **原因**：用了 `<Link href="/api/draft/exit">`。`Link` 默认预取，预取请求提前触发了退出。
  **解法**：用 `<form action={exitPreview}>` + Server Action（`POST`）。表单不预取。

- **现象**：`draftMode().enable()` 在 `'use cache'` 作用域里报错。
  **原因**：`enable()` 和 `disable()` **不能**在缓存指令作用域内调用。
  **解法**：只在 Route Handler 或 Server Action 里切换 Draft Mode。在 `'use cache'` 作用域里可以**读** `isEnabled`，但不能改。

- **现象**：预览 URL 可以被用来跳转到外部站点。
  **原因**：`redirect(slug)` 直接用了 `searchParams` 里的值，构成开放重定向。
  **解法**：先用 slug 查出真实内容，`redirect` 用**查出来的** slug（或干脆重定向到 `/blog/${post.slug}`）。

- **现象**：草稿文章出现在 sitemap 里。
  **原因**：`sitemap.ts` 调的是 `getAllPosts()`，没有过滤 `draft`。
  **解法**：`getAllPosts()` 默认过滤草稿（见 [47 章](./47-blog-mdx-pipeline.md)），确认 `sitemap.ts` 没有传 `includeDrafts: true`。

- **现象**：评论提交后自己看不到，要刷新。
  **原因**：`useOptimistic` 的 setter 没有包在 transition 里。
  **解法**：乐观更新必须在 `startTransition` 或 `<form action>` 内触发。注意「自己看到」和「别人看到」是两件事：自己的评论靠乐观 UI，别人的靠 `updateTag`。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 读取 Draft Mode | `draftMode()` 同步返回 | **`await draftMode()`** |
| 在缓存里读草稿状态 | 无对应能力 | `'use cache'` 作用域内**可以读** `isEnabled` |
| 缓存失效 | `revalidateTag('comments:x')` | **`updateTag('comments:x')`** |
| 退出预览 | `<Link href="/api/exit-draft">` | **`<form action={serverAction}>`**（`POST`，不被预取） |
| 缓存指令 | `experimental.ppr` / `dynamicIO` | **`cacheComponents: true`** |
| 页面参数 | `params` 同步 | `await params` |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 3、5、7 条。

## API / 配置速查

| API | 签名 | 说明 |
|---|---|---|
| `draftMode()` | `Promise<{ isEnabled, enable, disable }>` | **必须 `await`** |
| `draft.enable()` | `() => void` | 设置 `__prerender_bypass` cookie；**不能在缓存作用域内调用** |
| `draft.disable()` | `() => void` | 清除 cookie；同上限制 |
| `draft.isEnabled` | `boolean` | 可在 `'use cache'` 作用域内读取 |
| `getPostBySlug(slug, { includeDrafts })` | `Post \| null` | 自定义：Draft Mode 下才返回草稿 |
| `updateTag(tag)` | `(tag: string) => void` | 审核/发布后立即失效（仅 Server Actions） |
| `redirect(path)` | `(url: string) => never` | **不要传 `searchParams` 的值**，防开放重定向 |

| Draft Mode 下的缓存行为 | 是否绕过 |
|---|---|
| `fetch` 缓存 | 是 |
| `'use cache'` 组件 / 函数 | 是（且结果不写入） |
| `unstable_cache` | 是 |
| ISR 响应缓存 | 是 |
| 自建 Redis / 内存缓存 | **否** |
| CDN 缓存 | **否**（除非响应头生效） |

| Draft Mode 下的响应头 | 值 |
|---|---|
| `Cache-Control` | `private, no-cache, no-store, max-age=0, must-revalidate` |

## 延伸阅读

- [官方文档：Draft Mode](https://nextjs.org/docs/app/guides/draft-mode)
- [官方文档：`draftMode`](https://nextjs.org/docs/app/api-reference/functions/draft-mode)
- [官方文档：`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache)
- [官方文档：`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag)
- [官方文档：Data Security](https://nextjs.org/docs/app/guides/data-security)
- [官方文档：Self-hosting（自定义 cache handler）](https://nextjs.org/docs/app/guides/self-hosting)
- [React 文档：`useOptimistic`](https://react.dev/reference/react/useOptimistic)
