# 42 · Notes App B：路由与页面

> **一句话结论**：编辑用**平行路由 + 拦截路由**做成模态框，同一个 URL 在两种进入方式下渲染两套 UI——点链接进是模态，直接刷新或分享链接是完整页面。这套机制唯一的硬性成本是：**每个 slot 都必须有 `default.tsx`，否则构建失败**。

## 最小可运行示例

```
app/
├─ layout.tsx                    # 根布局，接收 children 和 modal 两个槽
├─ @modal/
│  ├─ default.tsx                # 必须有：无匹配路由时渲染 null
│  └─ (.)notes/
│     └─ [id]/
│        └─ edit/
│           └─ page.tsx          # 拦截版本：渲染成模态框
├─ notes/
│  ├─ layout.tsx                 # 笔记区布局：标题 + 导航
│  ├─ page.tsx                   # /notes 列表
│  ├─ new/
│  │  └─ page.tsx                # /notes/new
│  └─ [id]/
│     ├─ page.tsx                # /notes/:id 详情
│     └─ edit/
│        └─ page.tsx             # /notes/:id/edit 完整页面版本
└─ page.tsx                      # / 首页，跳转到 /notes
```

```tsx
// app/layout.tsx
export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="mx-auto max-w-3xl px-4 py-8">
          {children}
          {/* 模态槽永远渲染，但 default.tsx 返回 null，所以平时什么都不显示 */}
          {modal}
        </div>
      </body>
    </html>
  )
}
```

```tsx
// app/@modal/default.tsx
// 这个文件不是可选的。没有它，任何没有匹配到 @modal 路由的导航都会 404。
export default function Default() {
  return null
}
```

## 列表页

```tsx
// app/notes/page.tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { listNotes } from '@/lib/dal/notes'
import { requireUserId } from '@/lib/auth'

export const metadata = {
  title: '全部笔记',
}

export default function NotesPage() {
  return (
    <section>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">全部笔记</h1>
        <Link
          href="/notes/new"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
        >
          新建
        </Link>
      </header>

      {/* 列表是请求期数据（依赖会话），必须包在 Suspense 里 */}
      <Suspense fallback={<NoteListSkeleton />}>
        <NoteList />
      </Suspense>
    </section>
  )
}

async function NoteList() {
  const userId = await requireUserId()
  const { notes, nextCursor } = await listNotes(userId)

  if (notes.length === 0) {
    return (
      <p className="text-slate-500">
        还没有笔记。<Link href="/notes/new">写第一条</Link>
      </p>
    )
  }

  return (
    <>
      <ul className="divide-y divide-slate-200">
        {notes.map((note) => (
          <li key={note.id} className="py-3">
            <Link href={`/notes/${note.id}`} className="block hover:underline">
              <span className="font-medium">{note.title}</span>
            </Link>
            <div className="mt-1 flex gap-2 text-xs text-slate-500">
              {note.tags.map((tag) => (
                <span key={tag.id} style={{ color: tag.color }}>
                  #{tag.name}
                </span>
              ))}
              <time dateTime={note.updatedAt}>
                {new Date(note.updatedAt).toLocaleDateString('zh-CN')}
              </time>
            </div>
          </li>
        ))}
      </ul>

      {nextCursor && (
        <Link
          href={`/notes?cursor=${nextCursor}`}
          className="mt-4 inline-block text-sm text-slate-600 hover:underline"
        >
          下一页 →
        </Link>
      )}
    </>
  )
}

function NoteListSkeleton() {
  return (
    <ul className="divide-y divide-slate-200">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="py-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
        </li>
      ))}
    </ul>
  )
}
```

```tsx
// app/notes/loading.tsx
// 有了 Suspense 边界之后这个文件不是必需的，但它让整段路由切换都有兜底
import { NoteListSkeleton } from './note-list-skeleton'

export default function Loading() {
  return <NoteListSkeleton />
}
```

**为什么列表一定要包 `<Suspense>`。** 列表数据依赖 `cookies()`（读会话），这是请求期数据。在 Cache Components 下，请求期数据会在渲染时「截断」预渲染——截断点就是 `<Suspense>` 边界。没有边界，整页都会退化成请求期渲染，静态外壳里只剩一个空 `<body>`。

有了边界，静态外壳里包含标题、「新建」按钮和骨架屏，用户立刻看到页面结构；笔记列表在请求期流式补上。

## 详情页

```tsx
// app/notes/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getNote } from '@/lib/dal/notes'
import { requireUserId } from '@/lib/auth'
import { DeleteNoteButton } from './delete-note-button'

export async function generateMetadata({ params }: PageProps<'/notes/[id]'>) {
  const { id } = await params
  const userId = await requireUserId()
  const note = await getNote(id, userId)

  return { title: note ? note.title : '笔记不存在' }
}

export default async function NotePage({ params }: PageProps<'/notes/[id]'>) {
  const { id } = await params
  const userId = await requireUserId()
  const note = await getNote(id, userId)

  // 查不到和没权限走同一个分支。不要区分「不存在」和「无权访问」——
  // 那会把「这条 ID 存在但属于别人」这个信息泄露出去
  if (!note) notFound()

  return (
    <article>
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/notes" className="hover:underline">
          全部笔记
        </Link>
        <span className="mx-2">/</span>
        <span>{note.title}</span>
      </nav>

      <header className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">{note.title}</h1>
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/notes/${note.id}/edit`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            编辑
          </Link>
          <DeleteNoteButton id={note.id} />
        </div>
      </header>

      <div className="whitespace-pre-wrap text-slate-800">{note.content}</div>
    </article>
  )
}
```

`generateMetadata` 和页面组件都调 `getNote`，但只会打一次数据库——因为 41 章里 `getNote` 被 `React.cache` 包过。这就是那个 `cache` 的用处。

## 平行路由 + 拦截路由：编辑模态

先看两个版本的编辑页。

```tsx
// app/notes/[id]/edit/page.tsx —— 完整页面版本（直接访问 URL 时渲染）
import { notFound } from 'next/navigation'
import { getNote } from '@/lib/dal/notes'
import { requireUserId } from '@/lib/auth'
import { NoteForm } from '@/app/notes/note-form'

export default async function EditNotePage({
  params,
}: PageProps<'/notes/[id]/edit'>) {
  const { id } = await params
  const userId = await requireUserId()
  const note = await getNote(id, userId)

  if (!note) notFound()

  return (
    <section className="py-8">
      <h1 className="mb-6 text-2xl font-semibold">编辑笔记</h1>
      <NoteForm
        mode="edit"
        noteId={note.id}
        defaultValues={{ title: note.title, content: note.content }}
      />
    </section>
  )
}
```

```tsx
// app/@modal/(.)notes/[id]/edit/page.tsx —— 拦截版本（从链接导航时渲染）
import { notFound } from 'next/navigation'
import { getNote } from '@/lib/dal/notes'
import { requireUserId } from '@/lib/auth'
import { NoteForm } from '@/app/notes/note-form'
import { Modal } from '@/components/modal'

export default async function EditNoteModal({
  params,
}: PageProps<'/notes/[id]/edit'>) {
  const { id } = await params
  const userId = await requireUserId()
  const note = await getNote(id, userId)

  if (!note) notFound()

  return (
    <Modal title="编辑笔记">
      <NoteForm
        mode="edit"
        noteId={note.id}
        defaultValues={{ title: note.title, content: note.content }}
      />
    </Modal>
  )
}
```

两个文件的 `params` 类型是**同一个**——`PageProps<'/notes/[id]/edit'>`。因为拦截路由不改变 URL，只是改变了「谁来渲染这个 URL」。

### 拦截的四种写法

| 语法 | 含义 | 本项目用它做 |
|---|---|---|
| `(.)` | 拦截**同级**路由 | `app/@modal/(.)notes/...` 拦截 `app/notes/...` |
| `(..)` | 拦截**上一级**路由 | 从 `app/notes/[id]/` 里拦截 `app/notes/...` |
| `(..)(..)` | 上两级 | 少见 |
| `(...)` | 从 **app 根**拦截 | 深层嵌套时用 |

`(.)` 的语义容易被误解成「任意位置」。准确说法是：**`(.)` 匹配的是与「当前拦截路由所在的目录层级」同级的段**。`app/@modal/(.)notes` 中的 `(.)` 指向 `app/`，所以拼出来的目标是 `app/notes`。

### 为什么需要两套文件

拦截路由**只在客户端导航时生效**。两种进入方式：

```
点 <Link href="/notes/abc/edit">     → 客户端导航 → 匹配 @modal 槽 → 渲染模态
浏览器直接访问 /notes/abc/edit       → 服务端请求 → 无 @modal 匹配 → default.tsx（null）
                                                    + app/notes/[id]/edit/page.tsx
```

**没有拦截版本**：点编辑会整页跳到编辑页，失去上下文。
**没有完整页面版本**：刷新页面或分享链接时，模态框里只有一个表单，背后没有页面——用户在模态里刷新会看到一片空白。

两套文件是这套机制的**代价**，不是冗余。业务逻辑（`NoteForm`）抽成共享组件，两边只是外壳不同。

### 模态外壳

```tsx
// components/modal.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

export function Modal({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
  }, [])

  // 关闭 = 回到上一个历史记录，而不是 router.push('/notes')
  // 这样「编辑页 → 模态」的链路也能正确回退
  function close() {
    router.back()
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={close}
      className="backdrop:bg-slate-900/40 m-auto w-full max-w-lg rounded-lg p-0"
    >
      <div className="p-6">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={close} aria-label="关闭">
            ✕
          </button>
        </header>
        {children}
      </div>
    </dialog>
  )
}
```

用原生 `<dialog>` + `showModal()` 而不是自己搭 div 浮层，白送三件事：**焦点陷阱、Esc 关闭、`::backdrop` 伪元素**。自己实现这三样要几十行代码，而且焦点管理很容易做错。

`router.back()` 而不是 `router.push('/notes')` 是个细节：如果用户是从详情页 `/notes/abc` 点进来的，`back()` 回到详情页；`push('/notes')` 会把他扔回列表，丢失上下文。

## 表单：一个组件服务新建和编辑

```tsx
// app/notes/note-form.tsx
'use client'

import { useActionState } from 'react'
import { createNote, updateNote } from '@/app/actions/notes'
import { SubmitButton } from '@/components/submit-button'

type Props = {
  mode: 'create' | 'edit'
  noteId?: string
  defaultValues?: { title: string; content: string }
}

export function NoteForm({ mode, noteId, defaultValues }: Props) {
  const action = mode === 'create' ? createNote : updateNote.bind(null, noteId!)
  const [state, formAction] = useActionState(action, {})

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium">
          标题
        </label>
        <input
          id="title"
          name="title"
          defaultValue={defaultValues?.title}
          required
          maxLength={200}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
        {state.errors?.title && (
          <p aria-live="polite" className="mt-1 text-sm text-red-600">
            {state.errors.title[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="content" className="mb-1 block text-sm font-medium">
          内容
        </label>
        <textarea
          id="content"
          name="content"
          rows={10}
          defaultValue={defaultValues?.content}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </div>

      <SubmitButton>{mode === 'create' ? '创建' : '保存'}</SubmitButton>
    </form>
  )
}
```

```tsx
// components/submit-button.tsx
'use client'

import { useFormStatus } from 'react-dom'

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
    >
      {pending ? '保存中…' : children}
    </button>
  )
}
```

注意 `updateNote.bind(null, noteId!)` 的第一个参数必须是 `null`（`thisArg` 占位）。写成 `updateNote.bind(noteId)` 会把 ID 绑成 `this`，action 收到的第一个参数变成 `FormData`。详见 [13 Server Actions](../02-rendering/13-server-actions.md)。

## 布局与导航

```tsx
// app/notes/layout.tsx
import Link from 'next/link'

export default function NotesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-8">
      <aside>
        <nav className="space-y-1 text-sm">
          <Link href="/notes" className="block rounded px-2 py-1 hover:bg-slate-100">
            全部笔记
          </Link>
          <Link
            href="/notes?archived=1"
            className="block rounded px-2 py-1 hover:bg-slate-100"
          >
            已归档
          </Link>
        </nav>
      </aside>
      <main>{children}</main>
    </div>
  )
}
```

**布局不重渲染**，这是它和 `template.tsx` 的分水岭：在 `/notes` 和 `/notes/abc` 之间导航时，`NotesLayout` 保持挂载，侧边栏的滚动位置、展开状态都保留。需要「每次导航都重置」时（比如进场动画、依赖路径的 `useEffect`）才用 `template.tsx`。详见 [06 布局与模板](../01-foundation/06-layouts-and-templates.md)。

**导航高亮不要用 `usePathname`**。那会把布局变成客户端组件。用一个小的客户端组件只包住链接本身，或者直接用服务端的 `params` 推导——布局拿不到当前路径，所以高亮逻辑放叶子组件里更合适。

## 常见坑

- **现象**：加了一个 `@modal` 槽之后构建失败，报 `You are attempting to export "metadata" from a component marked with "use client"` 或者直接提示 slot 缺少默认导出。
  **原因**：平行路由的每个槽位**必须显式提供 `default.tsx`**。这是 16 的硬性构建约束，旧版本可以省略。
  **解法**：给每个 slot 建 `default.tsx`，返回 `null` 或骨架。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 11 条。

- **现象**：模态框正常弹出，但用户刷新页面后模态消失了，只看到完整编辑页——或者反过来，模态里套着一个完整页面。
  **原因**：拦截路由**只在客户端导航时生效**。刷新是服务端请求，走的是 `app/notes/[id]/edit/page.tsx` 那条路径。
  **解法**：这是设计行为，不是 bug。确认两套文件都存在，且业务逻辑抽到了共享组件里。

- **现象**：关闭模态后页面空白，或者回到了一个奇怪的 URL。
  **原因**：用了 `router.push('/notes')` 而不是 `router.back()`；或者用户是直接访问模态 URL 进来的，历史里没有上一页。
  **解法**：优先 `router.back()`。需要兜底时判断历史长度，或用 `<Link href="/notes" scroll={false}>` 作为降级。

- **现象**：`params` 是 `undefined`，或者 TS 报 `Property 'id' does not exist on type 'Promise<...>'`。
  **原因**：16 里 `params` 和 `searchParams` **都是 Promise**，必须 `await`。
  **解法**：`const { id } = await params`，并用 `next typegen` 生成的 `PageProps<'/notes/[id]'>` 代替手写泛型。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条。

- **现象**：编辑页的 `generateMetadata` 报错说不能读 `cookies()`，或者构建超时。
  **原因**：`requireUserId()` 内部读 `cookies()`。如果这个页面（或它的某部分）被标了 `'use cache'`，就会撞上缓存边界限制。
  **解法**：不要缓存依赖会话的页面。缓存放在**纯数据函数**上，会话在缓存边界外读，把 `userId` 当参数传进去。

- **现象**：`<dialog>` 里的表单提交后模态不关闭。
  **原因**：`<dialog>` 默认用 `method="dialog"` 提交，表单提交会关闭对话框但不触发 action；反之用 Server Action 时不会自动关闭。
  **解法**：用 Server Action 时在 action 成功后手动 `router.back()`，或者把关闭逻辑放在 `useActionState` 的返回值里判断。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 读取路由参数 | `function Page({ params }: { params: { id: string } })` | `const { id } = await params`，或 `PageProps<'/notes/[id]'>` |
| 平行路由槽 | 可以省略 `default.js` | **必须有 `default.tsx`** |
| 页面级标题 | `export const metadata = { title }` | 同上；动态标题用 `generateMetadata` |
| 表单状态 | `useFormState`（react-dom） | **`useActionState`（react）** |
| 列表数据获取 | `useEffect` + `useState` 客户端拉取 | 服务端组件直接 `await` + `<Suspense>` |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7、11 条。

## API / 配置速查

| 约定 / API | 签名 | 说明 |
|---|---|---|
| `(.)segment` | 目录名 | 拦截同级路由 |
| `(..)segment` | 目录名 | 拦截上一级路由 |
| `(...)segment` | 目录名 | 从 app 根拦截 |
| `default.tsx` | `export default function` | 每个平行槽**必需**，无匹配时渲染 |
| `useSelectedLayoutSegment(slot)` | `(slot?: string) => string \| null` | 判断某个槽当前是否有匹配路由 |
| `notFound()` | `() => never` | 渲染最近的 `not-found.tsx` |
| `PageProps<'/path/[x]'>` | 全局类型 | `next typegen` 生成，替代手写泛型 |
| `router.back()` | `() => void` | 关闭拦截模态的首选方式 |
| `generateMetadata` | `async ({ params }) => Metadata` | 与页面共享 `React.cache` 的去重结果 |

## 延伸阅读

- [官方文档：Parallel Routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes)
- [官方文档：Intercepting Routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes)
- [官方文档：Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating)
- [官方文档：Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages)
- [官方文档：Dynamic Routes](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes)
- [官方文档：Streaming 与 Suspense](https://nextjs.org/docs/app/guides/streaming)
- [官方文档：Preserving UI state](https://nextjs.org/docs/app/guides/preserving-ui-state)
