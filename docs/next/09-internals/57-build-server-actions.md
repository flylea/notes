# 57 · 从零实现 Server Actions

> **一句话结论**：Server Action 是一个看起来像函数、实际是 HTTP 端点的实体。它的全部机制是——打包器给每个标了 `"use server"` 的函数生成一个稳定的 id，组件树渲染时这个 id 作为 props 传到客户端；客户端"调用"它其实是发一个带 form data 的 POST 到这个 id 对应的端点；服务端执行真正的函数、再返回新的 RSC payload。理解了 id 这一层，渐进增强、乐观更新、`useActionState` 全都顺理成章。

## 要解决的两个问题

传统 SPA 表单提交长这样：

```tsx
'use client'
function Form() {
  const [pending, setPending] = useState(false)
  return (
    <form onSubmit={async (e) => {
      e.preventDefault()
      setPending(true)
      const fd = new FormData(e.currentTarget)
      await fetch('/api/submit', { method: 'POST', body: fd })
      setPending(false)
    }}>
      <input name="q" />
      <button disabled={pending}>提交</button>
    </form>
  )
}
```

两个问题：

1. **没 JS 就废了**。`onSubmit` 是 JS 行为，禁用 JS 的浏览器（或爬虫、或慢加载）连提交都做不到。
2. **手写重复样板**：管理 pending、序列化、错误、重渲染，每个表单一遍。

Server Action 把这两个都解决了——它本身就是个端点，能被原生 HTML 表单直接调用（渐进增强），同时配 `useActionState` 自动管理状态。

## 最小可运行示例

```tsx
// app/actions.ts —— 服务端
'use server'

export async function createTodo(formData: FormData) {
  const title = formData.get('title') as string
  await db.todo.create({ data: { title } })
  revalidateTag('todos')   // 让相关缓存失效
}
```

```tsx
// app/todos/new/page.tsx —— 服务端组件
import { createTodo } from '@/app/actions'

export default function NewTodo() {
  return (
    <form action={createTodo}>
      <input name="title" required />
      <button type="submit">新建</button>
    </form>
  )
}
```

注意：`action` 接的是**函数本身**，不是 URL 字符串。打包器在编译时把 `createTodo` 换成一个内部端点 id，运行时表单的 `action` 属性指向那个端点。**JS 没加载时，浏览器按原生 form 行为提交到那个 URL**，依然能创建 todo——这就是渐进增强。

## action id 是怎么来的

打包器扫描 `"use server"` 模块，为每个导出的函数生成一个 id（通常基于模块路径 + 函数名的哈希）。这个 id 在构建时确定，运行时稳定。

渲染时，服务端组件把 `<form action={createTodo}>` 序列化成：

```html
<form action="/_next/server-action/abc123">
  <input name="title" />
  <button>新建</button>
</form>
```

`abc123` 就是 action id。客户端 hydrate 时，React 知道这个 form 是个 action form，就接管它的 `submit` 事件，**改成通过 `fetch` 发 POST**，并附上 RSC 相关头，让服务端返回**新的 RSC payload**而非 HTML——这样导航不刷新页面，状态保留。

**没 JS 时**：浏览器原生提交到 `/_next/server-action/abc123`，服务端执行函数后**返回新的 HTML**（导航刷新）。功能不丢，只是体验差一点。

## 手写：把机制拆开看

下面绕开打包器的魔法，把整个过程用原始 fetch 复现，看清 action id 这一层：

```tsx
// 客户端"模拟 Server Action"
async function callServer(fnId: string, formData: FormData) {
  const res = await fetch(`/_next/server-action/${fnId}`, {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'text/x-component',           // 要 RSC payload
      'Next-Action': fnId,                     // 告诉服务端调哪个 action
    },
  })
  return res.body  // 一段 Flight payload，hydrate 后是新的 UI
}
```

要点：

- **POST 体是 FormData**。这就是为什么 action 函数的参数是 `formData: FormData`——它就是表单原始数据。
- **`Next-Action` 头携带 id**。服务端按 id 路由到对应函数。
- **响应是 RSC payload**，不是 JSON。客户端 hydrate 后直接得到新 UI，不需要开发者手动 setState。

## `useActionState`：状态自动管理

Server Action 自己不管 pending / 结果 / 错误，这些由 `useActionState` 包：

```tsx
// app/todos/new/page.tsx —— 客户端组件（要用 hooks）
'use client'

import { useActionState } from 'react'
import { createTodo } from '@/app/actions'

export default function NewTodo() {
  const [state, formAction, pending] = useActionState(
    async (prev, formData) => {
      try {
        await createTodo(formData)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    },
    null,
  )

  return (
    <form action={formAction}>
      <input name="title" required />
      <button disabled={pending}>新建</button>
      {state?.ok === false && <p>失败：{state.error}</p>}
    </form>
  )
}
```

`useActionState` 做三件事：

1. 把 action 包装成能给 `<form action={...}>` 用的形式。
2. 自动管理 `pending`。
3. 把上一次的返回值（state）传给下一次调用，方便做"上次失败提示"。

注意 wrap 函数里调用的还是 `createTodo`——Server Action 的边界没有变，只是多了一层状态壳。

## 乐观更新：`useOptimistic`

提交后等服务器响应再刷新 UI，用户会觉得慢。乐观更新是"假设成功、立刻显示新状态，失败再回滚"：

```tsx
'use client'
import { useOptimistic, useActionState } from 'react'
import { createTodo } from '@/app/actions'

function TodoList({ todos }) {
  const [optimisticTodos, addOptimistic] = useOptimistic(
    todos,
    (state, newTitle: string) => [...state, { id: 'optimistic', title: newTitle }],
  )

  const [, formAction] = useActionState(async (_, fd) => {
    const title = fd.get('title') as string
    addOptimistic(title)              // 立刻显示
    await createTodo(fd)              // 真正提交
  }, null)

  return (
    <>
      <ul>
        {optimisticTodos.map((t) => (
          <li key={t.id} style={t.id === 'optimistic' ? { opacity: 0.5 } : {}}>
            {t.title}
          </li>
        ))}
      </ul>
      <form action={formAction}>
        <input name="title" />
        <button>添加</button>
      </form>
    </>
  )
}
```

`useOptimistic` 的更新在 `revalidateTag` 触发的重渲染到达时被丢弃——这是它和真实数据无缝衔接的关键。

## 安全：动作内必须自行鉴权

这是 Server Action 最大的安全坑。**客户端能拿到 action id，意味着任何人都能伪造一个 POST 直接调你的 action**。action 函数不能依赖"只有我的 UI 会调它"这个假设。

```tsx
// actions.ts —— 错误：假设只有登录用户能调到
'use server'
export async function deleteAccount(formData: FormData) {
  const id = formData.get('id') as string
  await db.user.delete({ where: { id } })  // 任何人都能删任何账号
}
```

正确做法：**每个 action 内部都独立鉴权**：

```tsx
'use server'
import { auth } from '@/lib/auth'
import { revalidateTag, updateTag } from 'next/cache'

export async function deleteAccount(formData: FormData) {
  const session = await auth()                     // 每次都验
  if (!session?.user) throw new Error('未登录')

  const id = formData.get('id') as string
  if (id !== session.user.id) throw new Error('无权操作') // 越权校验

  await db.user.delete({ where: { id } })
  updateTag('user:' + id)                          // 自己立刻看到
}
```

Proxy（[第 16 章](../03-routing-network/16-proxy.md)）可以提前做乐观重定向（把没登录的拒掉），但**不能**作为唯一的鉴权——因为 action 端点可以被直接 POST。两层校验：proxy 兜住大部分、action 兜住剩余。

## 闭包陷阱：`bind` 的正确用法

闭包变量会被打包器序列化进 action，**用户可以篡改**：

```tsx
'use client'
import { deletePost } from '@/app/actions'

export function PostRow({ postId }: { postId: string }) {
  return <button onClick={() => deletePost(postId)}>删除</button>
}
// ↑ 这里 deletePost 接的是客户端的 postId，用户可以传任意 id
```

更稳的做法是用 `bind` 把变量**在服务端**固定住，让客户端拿不到可篡改的参数：

```tsx
// app/posts/[id]/page.tsx —— 服务端组件
import { deletePost } from '@/app/actions'

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bound = deletePost.bind(null, id)   // 服务端绑定 id
  return <DeleteButton action={bound} />
}
```

```tsx
// app/posts/[id]/delete-button.tsx —— 客户端
'use client'
export function DeleteButton({ action }: { action: () => Promise<void> }) {
  return <button onClick={action}>删除</button>
}
```

`bind` 的参数在服务端打包时就被序列化为不可篡改的固定值，客户端只拿到一个"调这个 action"的引用。**任何用户能控制的关键参数都应该用 `bind` 在服务端固定，而不是从客户端传**。

## 与缓存的集成

action 改完数据后要让 UI 反映变化：

| 场景 | 用什么 |
|---|---|
| 当前用户立刻看到自己的更新 | `updateTag(tag)` |
| 所有人下次请求看到失效 | `revalidateTag(tag, 'max')` |
| 只重跑动态数据，不动缓存 | `refresh()` |

三者详细分工见 [第 12 章](../02-rendering/12-revalidating.md) 与 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 5、6 条。

## 常见坑

- **现象**：action 调了，但 UI 没更新。
  **原因**：忘了调用 revalidation API。
  **解法**：用 `updateTag`（自己立刻看到）或 `revalidateTag`（所有人下次看到）。

- **现象**：任何人都能调 action 改别人的数据。
  **原因**：action 内部没鉴权。
  **解法**：每个 action 内独立验 session + 越权校验，见上文。

- **现象**：构建时报"Server Actions must be async"。
  **原因**：`'use server'` 函数必须是 `async`。
  **解法**：加 `async`，即使只是包一层 `await`。

- **现象**：表单提交后页面刷新了，状态丢失。
  **原因**：客户端没 hydrate，浏览器走了原生 form 提交。
  **解法**：这是渐进增强的预期行为。要保留状态就用 `useActionState` + JS 已加载场景。

- **现象**：从客户端传的 id 被用户改了，删了别人的记录。
  **原因**：闭包变量可篡改。
  **解法**：用 `bind` 在服务端固定关键参数。

## 旧写法 vs 新写法

| 场景 | 旧（Pages Router / API Route） | 新（Server Actions） |
|---|---|---|
| 表单提交 | 写 API Route + 客户端 fetch + 手动管理状态 | `action={fn}` 一行 |
| 无 JS | 不可用 | 渐进增强可用 |
| 越权校验 | API Route 里写 | action 内部写 |
| 与缓存集成 | 手动 revalidate | `updateTag` / `revalidateTag` |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md)。

## API / 配置速查

| API | 作用 |
|---|---|
| `'use server'` | 标记模块为 Server Actions |
| `useActionState(reducer, init)` | 管理 action 状态与 pending |
| `useFormStatus()` | 在表单内部子组件里读 pending |
| `useOptimistic(state, updateFn)` | 乐观更新 |
| `fn.bind(null, ...args)` | 在服务端固定参数 |
| `updateTag(tag)` / `revalidateTag(tag, profile)` / `refresh()` | 失效缓存 |

## 延伸阅读

- [官方文档：Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data)
- [官方文档：Server Actions](https://nextjs.org/docs/app/guides/server-actions)
- [官方文档：Forms](https://nextjs.org/docs/app/guides/forms)
- [官方文档：Interactive apps](https://nextjs.org/docs/app/guides/interactive-apps)
- [B站《Next简明教程》服务器函数 - 2-1](https://www.bilibili.com/video/BV1LEJH6uEtt/)
