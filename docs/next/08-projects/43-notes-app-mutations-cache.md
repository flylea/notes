# 43 · Notes App C：数据变更与缓存

> **一句话结论**：**私人数据用 `'use cache: private'` 缓存在浏览器，共享数据用 `'use cache'` 缓存在服务端**；失效时按口诀选 API——用户自己刚写完要立刻看到 → `updateTag`，别人改动需要广播 → `revalidateTag(tag, 'max')`，只重跑动态逻辑 → `refresh()`。

## 最小可运行示例

```ts
// app/actions/notes.ts
'use server'

import { redirect } from 'next/navigation'
import { revalidateTag, updateTag } from 'next/cache'
import { requireUserId } from '@/lib/auth'
import { createNoteSchema, updateNoteSchema } from '@/lib/validations/note'
import * as notes from '@/lib/dal/notes'

export type NoteActionState = {
  errors?: Record<string, string[]>
  message?: string
}

export async function createNote(
  _prev: NoteActionState,
  formData: FormData
): Promise<NoteActionState> {
  // 1. 鉴权。Server Action 是独立入口，页面级的检查不算数
  const userId = await requireUserId()

  // 2. 校验。schema 只检查形状，归属问题靠 userId 从会话派生
  const parsed = createNoteSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content') ?? '',
    tagIds: formData.getAll('tagIds').map(String),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  // 3. 写入。authorId 来自会话，不来自表单
  const note = await notes.createNote(userId, parsed.data)

  // 4. 失效：当前用户要立刻看到自己刚建的这条
  updateTag(`notes:${userId}`)
  updateTag(`note:${note.id}`)

  redirect(`/notes/${note.id}`)
}

export async function updateNote(
  noteId: string,
  _prev: NoteActionState,
  formData: FormData
): Promise<NoteActionState> {
  const userId = await requireUserId()

  const parsed = updateNoteSchema.safeParse({
    title: formData.get('title') ?? undefined,
    content: formData.get('content') ?? undefined,
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  // DAL 内部把 authorId 写进 where，改不到别人的数据
  const updated = await notes.updateNote(noteId, userId, parsed.data)
  if (!updated) return { message: '笔记不存在或无权修改' }

  updateTag(`notes:${userId}`)
  updateTag(`note:${noteId}`)
  return {}
}

export async function deleteNote(noteId: string) {
  const userId = await requireUserId()

  const deleted = await notes.deleteNote(noteId, userId)
  if (!deleted) return { ok: false as const }

  updateTag(`notes:${userId}`)
  updateTag(`note:${noteId}`)
  return { ok: true as const }
}
```

四个动作的顺序是有讲究的：**鉴权 → 校验 → 写入 → 失效**。任何一步提前返回，后面的都不会执行。特别是「鉴权必须在最前面」——不能等写完数据库再检查归属。

## 私人数据：`'use cache: private'`

笔记是私人数据。把它放进服务端共享缓存有两个问题：**占内存**（每个用户一份），以及**一旦缓存键写错就是越权泄露**。

正确的做法是用 `'use cache: private'`——它允许在缓存作用域里访问 `cookies()` 这类请求期 API，但结果**只缓存在浏览器**，不写服务端共享存储。

```ts
// lib/dal/notes.ts（缓存部分）
import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'

export async function getMyNotes() {
  'use cache: private'
  // private 作用域里可以读 cookies()，这是它和 'use cache' 的关键差别
  cacheLife('minutes')

  const userId = (await cookies()).get('session')?.value
  if (!userId) return []

  // 打上用户维度的标签，失效时按用户精确失效
  cacheTag(`notes:${userId}`)

  const rows = await prisma.note.findMany({
    where: { authorId: userId, archived: false },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  })

  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    updatedAt: n.updatedAt.toISOString(),
  }))
}
```

`'use cache: private'` 带来的实际收益：用户在列表 → 详情 → 返回列表时，列表**不需要重新请求服务端**，直接命中浏览器里那份。这是 SPA 那种「秒回」体验，但不需要客户端状态管理库。

代价要说清楚：**浏览器缓存只对当前这个用户、这个浏览器有效**。换设备、清缓存、换浏览器都是冷的。它优化的是「同一个会话里的重复导航」，不是「首次加载」。

### 共享数据：普通 `'use cache'`

标签色板、站点统计、公告这类**所有人看到同一份**的数据，用普通 `'use cache'`，进服务端共享缓存：

```ts
// lib/dal/stats.ts
import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'
import { prisma } from '@/lib/db'

export async function getGlobalStats() {
  'use cache'
  cacheLife('hours')
  cacheTag('stats')

  const [notes, users] = await Promise.all([
    prisma.note.count(),
    prisma.user.count(),
  ])

  return { notes, users }
}
```

判断标准只有一句话：**这份数据的值对所有用户相同吗？** 相同 → `'use cache'`；不同 → `'use cache: private'`；不确定 → 不缓存。

## `updateTag` 还是 `revalidateTag`：实战判断

这是本章最容易做错的决定。两个 API 的差别不是「新旧」，是**语义**。

| | `updateTag(tag)` | `revalidateTag(tag, 'max')` |
|---|---|---|
| 语义 | read-your-writes：立刻过期，下一个请求**等待**新数据 | stale-while-revalidate：先给陈旧内容，后台重建 |
| 可用位置 | **仅 Server Actions** | Server Actions 和 Route Handlers |
| action 响应里带重渲染 | **是** | **否**（有意跳过） |
| 用户看到的结果 | 提交后立刻看到自己的变更 | 提交后可能还看到旧的，下次访问才更新 |

**判断口诀**：

```
自己写的，自己立刻要看到        → updateTag(tag)
给所有人下次请求时失效          → revalidateTag(tag, 'max')
只重跑动态数据，不动缓存        → refresh()
```

### 落到 Notes App 的具体场景

| 操作 | 用什么 | 为什么 |
|---|---|---|
| 用户新建笔记 | `updateTag` | 他必须立刻在新页面看到这条 |
| 用户编辑笔记 | `updateTag` | 同上 |
| 用户删除笔记 | `updateTag` | 删除后列表里不能还留着 |
| 后台批量归档 30 天前的笔记 | `revalidateTag(tag, 'max')` | 用户不关心什么时候生效，别让请求阻塞 |
| 管理员改站点公告 | `revalidateTag('stats', 'max')` | 广播失效，不需要当前管理员立刻看到 |
| 页面里有未缓存的动态计数 | `refresh()` | 计数不在缓存里，`updateTag` 无从下手 |

```ts
// app/actions/archive-stale.ts
'use server'

import { revalidateTag } from 'next/cache'

export async function archiveStaleNotes() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const { count } = await prisma.note.updateMany({
    where: { updatedAt: { lt: cutoff }, archived: false },
    data: { archived: true },
  })

  // 影响面很大，不值得让触发者阻塞等待。让其他用户下次访问时后台重建
  revalidateTag('stats', 'max')

  return { archived: count }
}
```

> **这里有个反直觉的点**：`revalidateTag(tag, 'max')` 之后，**触发者自己**看到的页面也可能是旧的——因为它有意不在 action 响应里带重渲染。如果你既想让触发者立刻看到、又想让其他人后台刷新，两个都调：`updateTag` 管当前用户，`revalidateTag` 管其他人。

### 为什么单参数形式不能用了

`revalidateTag('notes')` 在 16 里**会报 TypeScript 错误**。新签名需要第二个参数——一个 cacheLife profile，用来决定陈旧内容可以存在多久：

```ts
revalidateTag('notes', 'max')            // 推荐：一年窗口，总是先给陈旧内容
revalidateTag('stats', 'days')
revalidateTag('products', { expire: 3600 })
revalidateTag('notes')                   // ⚠️ 已弃用
```

准确说法是**已弃用 + 行为退化**，不是「立刻不能用」：单参数形式压制类型错误后仍能跑，但行为等同 `{ expire: 0 }`——立即过期、不走 SWR。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 5 条。

## 乐观更新：`useOptimistic`

`updateTag` 保证的是「服务端返回的数据是新的」。但从用户点下按钮到服务端返回，中间有几十到几百毫秒。`useOptimistic` 填的就是这段空白。

### 乐观删除

```tsx
// app/notes/note-list.tsx
'use client'

import { useOptimistic, useTransition } from 'react'
import Link from 'next/link'
import { deleteNote } from '@/app/actions/notes'

type Note = { id: string; title: string; updatedAt: string }

export function NoteList({ notes }: { notes: Note[] }) {
  const [optimisticNotes, removeOptimistic] = useOptimistic(
    notes,
    (state, id: string) => state.filter((n) => n.id !== id)
  )

  return (
    <ul className="divide-y divide-slate-200">
      {optimisticNotes.map((note) => (
        <li key={note.id} className="flex items-center justify-between py-3">
          <Link href={`/notes/${note.id}`} className="hover:underline">
            {note.title}
          </Link>
          <DeleteButton id={note.id} onOptimistic={removeOptimistic} />
        </li>
      ))}
    </ul>
  )
}

function DeleteButton({
  id,
  onOptimistic,
}: {
  id: string
  onOptimistic: (id: string) => void
}) {
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      // 必须包在 transition 里，否则 React 会警告并且乐观状态会闪一下
      onOptimistic(id)
      const result = await deleteNote(id)
      if (!result.ok) {
        // 不需要手动回滚。transition 结束后 optimisticNotes 自动回到 notes
        console.error('删除失败')
      }
    })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="text-sm text-slate-500 hover:text-red-600 disabled:opacity-40"
    >
      删除
    </button>
  )
}
```

**回滚是自动的，这是 `useOptimistic` 最容易被误解的地方**。它的乐观状态只在 transition **挂起期间**生效。transition 一结束（无论成功还是失败），组件重新用真实的 `notes` props 渲染。所以「删除失败要恢复」不需要写回滚代码——失败时乐观状态消失，被删的那条自然回来。

前提是**服务端返回后 props 必须已经更新**。如果 action 里忘了 `updateTag`，服务端重新渲染拿到的还是旧列表，被删的那条会「复活」——这才是真正的 bug 现象。

### 乐观新增

```tsx
// app/notes/new/note-form.tsx
'use client'

import { useActionState, useOptimistic } from 'react'
import { useRouter } from 'next/navigation'
import { createNote } from '@/app/actions/notes'

type Draft = { title: string; content: string }

export function NoteForm({ initialDrafts }: { initialDrafts: Draft[] }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(createNote, {})

  const [drafts, addDraft] = useOptimistic(
    initialDrafts,
    (state, draft: Draft) => [...state, draft]
  )

  return (
    <>
      <form
        action={async (formData: FormData) => {
          addDraft({
            title: String(formData.get('title')),
            content: String(formData.get('content') ?? ''),
          })
          await formAction(formData)
        }}
        className="space-y-4"
      >
        <input name="title" required className="w-full rounded border px-3 py-2" />
        {state.errors?.title && (
          <p className="text-sm text-red-600">{state.errors.title[0]}</p>
        )}
        <textarea name="content" rows={8} className="w-full rounded border px-3 py-2" />
        <button disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-white">
          {pending ? '保存中…' : '创建'}
        </button>
      </form>

      {/* 乐观列表：服务端返回前就显示出来 */}
      <ul className="mt-8 space-y-2 text-sm text-slate-500">
        {drafts.map((d, i) => (
          <li key={i} className="opacity-60">
            {d.title} <span className="text-xs">（保存中）</span>
          </li>
        ))}
      </ul>
    </>
  )
}
```

这里包了一层 `async` 的客户端函数来「先加乐观项、再调真正的 action」。这个包装函数本身不是 Server Action——它在客户端执行，只是转发 `FormData`。渐进增强会**失效**（JS 未加载时这层包装不执行），换来的是乐观 UI。取舍要明确。

## 常见坑

- **现象**：`revalidateTag('notes')` 报 TypeScript 错误 `Expected 2 arguments, but got 1`。
  **原因**：16 起 `revalidateTag` 需要第二个参数（cacheLife profile）。
  **解法**：补 `'max'`：`revalidateTag('notes', 'max')`。Server Action 里更推荐直接用 `updateTag('notes')`。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 5 条。

- **现象**：调了 `revalidateTag('notes', 'max')`，但用户提交完还是看到旧数据，刷新一下才对。
  **原因**：`revalidateTag` 配 SWR profile 时**有意不在 action 响应里带重渲染**，页面要等之后某次读取才反映变化。
  **解法**：需要 read-your-writes 的场景用 `updateTag`。两者语义不同，不是「新旧替代」关系。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 6 条。

- **现象**：乐观删除之后，被删的那条又「复活」了。
  **原因**：action 里忘了失效缓存。transition 结束后组件用真实 props 重新渲染，而 props 还是旧列表。
  **解法**：确认 action 里调了 `updateTag`。如果用的是 `'use cache'` 缓存的列表，还要确认 `cacheTag` 的字符串和 `updateTag` 的字符串**完全一致**（区分大小写）。

- **现象**：`useOptimistic` 的 setter 在外面调用时控制台报警告，乐观状态只闪一下。
  **原因**：`useOptimistic` 的 setter **必须在 Action（即 `startTransition` 内或 `<form action>` 内）里调用**。在外面调用，React 无法确定乐观状态的结束时机。
  **解法**：包进 `startTransition(async () => { ... })`，或者用 `<form action={...}>`。

- **现象**：在 `'use cache'` 作用域里读 `cookies()` 报 `next-request-in-use-cache`。
  **原因**：普通 `'use cache'` 是**共享缓存**，不能依赖请求期数据——否则同一个缓存条目会被不同用户命中，直接串号。
  **解法**：私人数据用 `'use cache: private'`（它允许读请求期 API，结果只存浏览器），或者把值在缓存边界外读出来当参数传进去。

- **现象**：`updateTag` 在 Route Handler 里调用直接抛错。
  **原因**：`updateTag` 和 `refresh` **只能**在 Server Actions 里用——它们需要在 action 的响应里附带重渲染结果。
  **解法**：Route Handler（比如 webhook）里用 `revalidateTag(tag, 'max')`，或需要立即过期时用 `revalidateTag(tag, { expire: 0 })`。

- **现象**：标签失效没反应，也不报错。
  **原因**：标签**区分大小写**，长度上限 256 字符。超过上限的标签永远不会被赋给缓存数据，失效它是空操作——静默失败。
  **解法**：用常量函数生成标签，避免手写字符串拼错：

  ```ts
  // lib/cache-tags.ts
  export const tags = {
    userNotes: (userId: string) => `notes:${userId}`,
    note: (noteId: string) => `note:${noteId}`,
    stats: 'stats',
  } as const
  ```

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 按标签失效 | `revalidateTag('notes')` | **`revalidateTag('notes', 'max')`** |
| 提交后立刻看到结果 | 只能靠单参数 `revalidateTag` | **`updateTag('notes')`**（仅 Server Actions） |
| 刷新未缓存数据 | 手动 `router.refresh()` | **`refresh()`**（仅 Server Actions） |
| 定时重建 | `export const revalidate = 3600` | `cacheLife('hours')` |
| 用户私有数据缓存 | 无对应能力 | **`'use cache: private'`** |
| 表单状态 | `useFormState`（react-dom） | **`useActionState`（react）** |
| 乐观更新回滚 | 手动保存快照并恢复 | **自动**，transition 结束即回真实状态 |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 5、6 条。

## API / 配置速查

| API | 签名 | 能用在哪 | 语义 |
|---|---|---|---|
| `updateTag` | `(tag: string) => void` | **仅 Server Actions** | 立刻过期，read-your-writes |
| `revalidateTag` | `(tag: string, profile: string \| { expire?: number }) => void` | Server Actions、Route Handlers | stale-while-revalidate |
| `revalidatePath` | `(path: string) => void` | Server Actions、Route Handlers | 按路径失效（走软标签） |
| `refresh` | `() => void` | **仅 Server Actions** | 只重跑未缓存数据 |
| `cacheTag` | `(tag: string) => void` | `'use cache'` / `'use cache: private'` 内 | 打标签 |
| `cacheLife` | `(profile: string \| object) => void` | 同上 | 设置缓存寿命 |
| `useOptimistic` | `(state, reducer) => [optimistic, set]` | 客户端组件 | setter 必须在 transition 内调用 |
| `useTransition` | `() => [pending, startTransition]` | 客户端组件 | 提供 `startTransition`，用于包乐观更新 |

| 指令 | 能否读 `cookies()` | 缓存存哪 | 适用 |
|---|---|---|---|
| `'use cache'` | **否** | 服务端共享存储 / 预渲染 HTML | 所有用户相同的数据 |
| `'use cache: private'` | **是** | **仅浏览器** | 当前用户的私有数据 |
| 不加指令 | 是 | 不缓存，每请求执行 | 实时数据 |

## 延伸阅读

- [官方文档：Revalidating](https://nextjs.org/docs/app/getting-started/revalidating)
- [官方文档：`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag)
- [官方文档：`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
- [官方文档：`refresh`](https://nextjs.org/docs/app/api-reference/functions/refresh)
- [官方文档：`use cache: private`](https://nextjs.org/docs/app/api-reference/directives/use-cache-private)
- [官方文档：How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works)
- [React 文档：`useOptimistic`](https://react.dev/reference/react/useOptimistic)
- [React 文档：`useTransition`](https://react.dev/reference/react/useTransition)
