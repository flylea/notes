# 13 · Server Actions

> **一句话结论**：Server Action 本质上是一个**可以被外部直接 POST 调用的入口**——它跟你的 UI 没有绑定关系。所以每个 action 内部都必须自己鉴权、自己校验输入、自己限定返回值。渐进增强是白送的：`<form action={serverAction}>` 在 JS 没加载时也能提交。

## 最小可运行示例

```ts
// app/lib/actions.ts
'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const post = await db.post.create({
    data: {
      title: String(formData.get('title')),
      authorId: session.user.id,
    },
  })

  updateTag('posts')
  redirect(`/posts/${post.id}`)
}
```

```tsx
// app/ui/form.tsx
import { createPost } from '@/app/lib/actions'

export function Form() {
  return (
    <form action={createPost}>
      <input type="text" name="title" />
      <button type="submit">Create</button>
    </form>
  )
}
```

`<form action={createPost}>` 直接接一个服务端函数，不需要 `onSubmit`、不需要 `fetch`、不需要手动 `preventDefault`。注意 `createPost` 内部第一件事就是 `await auth()`——原因见「安全」一节。

## `'use server'` 与渐进增强

指令有两种放法：放在**异步函数体顶部**标记这一个函数，或放在**文件顶部**标记该文件所有导出。也可以直接在服务端组件里内联定义。

```ts
// app/lib/actions.ts
import { auth } from '@/lib/auth'

export async function createPost(formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  // 变更数据、失效缓存
}
```

| 场景 | 行为 |
|---|---|
| 服务端组件里的表单 | **默认支持渐进增强**——JS 还没加载或完全禁用时，表单照样提交 |
| 客户端组件里的表单 | JS 未加载时提交会**排队**，并在 hydration 时被优先处理；hydration 之后浏览器不会在提交时刷新页面 |

`<form action={fn}>` 在 JS 挂载之前就能工作，因为浏览器原生表单提交会打到 action 的端点上。背后用的是 **POST** 方法，也只有 POST 能调用它们。

### 调用方式

| 方式 | 位置 | 说明 |
|---|---|---|
| `<form action={fn}>` | 服务端组件、客户端组件 | 自动收到 `FormData` |
| `<button formAction={fn}>` | 同上 | 一个表单里挂多个 action |
| `onClick` 等事件处理器 | 客户端组件 | 手动调用并处理返回值 |
| `useEffect` + `startTransition` | 客户端组件 | 挂载或依赖变化时触发 |

事件处理器里调用时，返回值可以直接消费：`onClick={async () => setLikes(await incrementLike())}`。

## 一次往返，同时带回数据和 UI

action 触发即时重新验证时，Next.js 在**同一个 HTTP 请求里**完成：先跑 action，再在服务端重新渲染当前路由。响应里同时包含 action 的返回值和当前路由新渲染出的 RSC Payload，客户端把它作为"种子导航"提交，所以应用代码不需要额外发请求就能看到更新后的 UI。以下任一情况会让响应里包含重新渲染：

| action 里做了什么 | 结果 |
|---|---|
| 调 `updateTag` 或 `revalidatePath` | 立刻失效缓存，附带重渲染 |
| 调 `refresh` | 重新取当前路由的 RSC Payload |
| 通过 `cookies()` 改 cookie | 自动重渲染当前页面，让 UI 反映新 cookie 值 |
| 调 `redirect` | 响应导航到目标并流式发送目标的 RSC Payload |

**例外**：`revalidateTag` 配 stale-while-revalidate profile 时只是把标签标成后台刷新，**不会**在 action 响应里带重渲染。还有顺序问题：`redirect` 抛的是控制流异常，它之后的代码不会执行，所以需要新数据的场景要**把重新验证调用放在 `redirect` 之前**。

### 串行派发

Next.js **每个客户端一次只派发一个 Server Action**。用户快速触发三个 action 时，第二个等第一个结束，第三个等第二个——这是为了让重新渲染的服务端树与产生它的 action 结果保持一致。**推论**：不要指望用 `Promise.all` 从客户端并行调用多个 Server Action，需要并行工作时把逻辑放进**单个** action 内部，或者在服务端组件里并行取数。这是**客户端 dispatcher** 的性质，不是 Server Function 本身的限制——服务端上每个 action 在自己的请求里运行。

## 安全：动作内必须自行鉴权

这是全章最重要的一节，也是最容易出漏洞的地方。

### 为什么不能依赖 proxy 或页面级检查

`'use server'` 指令在构建时告诉编译器：把客户端包里的函数实现替换成一个引用（action ID 加 dispatcher），它 POST 回服务器。实现留在服务端，**但那个路由对任何能发同样 POST 请求的人都是可达的**。官方原文的说法是：**把每一个 action 都当作不受信任的入口点。**

```tsx
// app/admin/page.tsx
export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.isAdmin) redirect('/login') // 只控制渲染哪个 UI

  return (
    <form
      action={async () => {
        'use server'
        const session = await auth()
        if (!session?.user?.isAdmin) throw new Error('Unauthorized')
        await db.record.deleteMany()
      }}
    >
      <button>Delete Records</button>
    </form>
  )
}
```

页面级的 `redirect` 只决定渲染哪个 UI。**action 是独立的入口**，必须自己验证调用者。Proxy 同理——它可以拦截明显的未登录请求，但请求可以绕过 UI 直接发出，Proxy 不是完整的会话管理或授权方案（见 [16 Proxy](../03-routing-network/16-proxy.md)）。

### 认证之外还要授权

认证回答"用户登录了吗"，授权回答"这个用户有权操作这个具体资源吗"。缺后者会导致越权访问（IDOR）——只检查 `session.user` 存在是不够的，还要检查这一行数据的归属：

```ts
// app/actions.ts
'use server'

export async function deletePost(postId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const post = await db.post.findUnique({ where: { id: postId } })
  if (post.authorId !== session.user.id) throw new Error('Forbidden')

  await db.post.delete({ where: { id: postId } })
}
```

### 不要接收整个对象

客户端**可以**告诉服务器"操作哪一条"（这是正常的），但**不该**提供这一行的内容或归属。

```ts
// app/items/actions.ts
'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

// 不安全：整个 item（含 id）都来自客户端，任何能 POST 到这里的人
// 都能把任意 item 标记为完成。
export async function completeItemUnsafe(item: Item) {
  await db.item.update({ where: { id: item.id }, data: { completed: true } })
}

// 安全：只接收"变更"，身份从会话派生，按归属查询。
export async function completeItem(itemId: string) {
  const session = await auth()
  if (!session?.user) return

  const item = await db.item.findFirst({
    where: { id: itemId, ownerId: session.user.id },
  })
  if (!item) return

  await db.item.update({ where: { id: item.id }, data: { completed: true } })
}
```

关键区分：**schema 校验只检查输入的"形状"**。一个格式完全正确的 `Item` 对象，仍然可能指向调用者并不拥有的一行数据——zod 或类似库解决不了归属问题，那必须从会话派生。

### 限定返回值

action 的返回值会被序列化并发给客户端。**只返回 UI 需要的东西，不要返回原始数据库记录**——记录里可能有客户端不该看到的内部字段。返回 `{ success: true }` 这样的最小结构，而不是整个 user 行。

### 框架自带的防护（不能替代应用层检查）

| 防护 | 说明 |
|---|---|
| **CSRF 检查** | 比较请求的 `Origin` 与 `Host`（或 `X-Forwarded-Host`），不匹配就拒绝。代理或 CDN 域名需要配 `serverActions.allowedOrigins` |
| **请求体大小限制** | 默认 1MB。需要更大载荷时配 `serverActions.bodySizeLimit` |
| **加密的 action ID** | action 引用在构建时加密；未使用的 Server Function 从客户端包剔除，不产生公开端点 |
| **闭包变量加密** | 内联 action 捕获的变量在发往客户端前加密。多实例和自托管部署需要设置 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` |

这几条是纵深防御，不是替代品。官方明确说明：**不应只依赖加密来防止敏感值暴露给客户端。**

## 闭包变量与 `bind` 的正确用法

### 闭包会被加密，但别只靠它

在组件里定义 Server Action 会形成闭包，action 能访问外层作用域的变量：

```tsx
// app/page.tsx
export default async function Page() {
  const publishVersion = await getLatestVersion()

  async function publish() {
    'use server'
    if (publishVersion !== (await getLatestVersion())) {
      throw new Error('The version has changed since pressing publish')
    }
    // ...
  }

  return (
    <form>
      <button formAction={publish}>Publish</button>
    </form>
  )
}
```

闭包在需要**快照**数据时很有用（这里要记住按下发布时的版本号）。代价是：**捕获的变量会被发到客户端，调用时再从客户端发回服务端**。为防止敏感数据暴露，Next.js 会自动加密这些闭包变量，每次构建为每个 action 生成新私钥。

两点要留意：官方不建议只依赖加密防止敏感值暴露——**闭包变量在物理上经过了客户端**，要按这个前提设计；**多实例自托管**时每个实例可能生成不同密钥导致不一致，用 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 固定密钥让所有实例共用。更稳妥的做法是**不要把敏感值放进闭包**，让 action 内部自己从会话或数据库重新读取。

### 用 `bind` 传额外参数

```tsx
// app/client-component.tsx
'use client'

import { updateUser } from './actions'

export function UserProfile({ userId }: { userId: string }) {
  // 注意第一个参数是 null（thisArg 占位），userId 才是真正的第一个参数
  const updateUserWithId = updateUser.bind(null, userId)

  return (
    <form action={updateUserWithId}>
      <input type="text" name="name" />
      <button type="submit">Update User Name</button>
    </form>
  )
}
```

```ts
// app/actions.ts
'use server'

export async function updateUser(userId: string, formData: FormData) {}
```

**这里有个高频错误**：`bind` 的第一个参数是 `thisArg`，不是业务参数。写成 `updateUser.bind(userId)` 会把 `userId` 绑成 `this`，函数实际收到的第一个参数就变成了 `FormData`——**必须写 `.bind(null, userId)`**。`bind` 在服务端组件和客户端组件里都能用，并且**支持渐进增强**。

另一种方式是用隐藏字段 `<input type="hidden" name="userId" value={userId} />`，但它的值会成为渲染出的 HTML 的一部分，且和表单字段一样是客户端可改的输入。`bind` 传的值同样经过客户端（见上文闭包加密部分），所以**两者都不能当作可信来源**——用哪个都要在 action 里重新校验归属。

## 三个 hook 的分工与配合

| Hook | 来源 | 职责 | 需要单独组件吗 |
|---|---|---|---|
| `useActionState` | `react` | 管理 action 的**返回值**与 `pending` 状态 | 否 |
| `useFormStatus` | `react-dom` | 读取**最近的父级 `<form>`** 的提交状态 | **是**，必须是被表单包住的子组件 |
| `useOptimistic` | `react` | 在服务端返回前**乐观更新 UI** | 否 |

### `useActionState`：状态与 pending

用 `useActionState` 时，**Server Function 的签名会变**——第一个参数变成 `prevState`：

```ts
// app/actions.ts
'use server'

import { z } from 'zod'

const schema = z.object({ title: z.string().min(1, 'Title is required') })

type FormState = { errors?: Record<string, string[]> }

export async function createPost(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validated = schema.safeParse({ title: formData.get('title') })
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  await db.post.create({ data: { title: validated.data.title } })
  return {}
}
```

```tsx
// app/ui/form.tsx
'use client'

import { useActionState } from 'react'
import { createPost } from '@/app/actions'

const initialState = { errors: {} }

export function Form() {
  const [state, formAction, pending] = useActionState(createPost, initialState)

  return (
    <form action={formAction}>
      <input type="text" name="title" required />
      {state.errors?.title && <p aria-live="polite">{state.errors.title[0]}</p>}
      <button disabled={pending}>Create Post</button>
    </form>
  )
}
```
### `useFormStatus`：从表单内部读状态

它必须放在**被 `<form>` 包住的子组件**里，所以需要一个单独的组件：

```tsx
// app/ui/submit-button.tsx
'use client'

import { useFormStatus } from 'react-dom'

export function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button disabled={pending} type="submit">
      Sign Up
    </button>
  )
}
```

用法是把它塞进表单：`<form action={createUser}><SubmitButton /></form>`。

选择建议：需要拿到 action 返回值，用 `useActionState`；只需要"按钮转圈/禁用"，且提交按钮在很深的子树里，用 `useFormStatus` 更省事——不用把 `pending` 一路传下去。React 19 里它还多返回 `data`、`method`、`action` 几个键。

### `useOptimistic`：先更新再确认

```tsx
// app/page.tsx
'use client'

import { useOptimistic } from 'react'
import { send } from './actions'

type Message = { message: string }

export function Thread({ messages }: { messages: Message[] }) {
  const [optimisticMessages, addOptimisticMessage] = useOptimistic<
    Message[],
    string
  >(messages, (state, newMessage) => [...state, { message: newMessage }])

  const formAction = async (formData: FormData) => {
    const message = String(formData.get('message'))
    addOptimisticMessage(message)
    await send(message)
  }

  return (
    <div>
      {optimisticMessages.map((m, i) => (
        <div key={i}>{m.message}</div>
      ))}
      <form action={formAction}>
        <input type="text" name="message" />
        <button type="submit">Send</button>
      </form>
    </div>
  )
}
```

三者可以叠加：`useActionState` 管状态和 pending，`useOptimistic` 管即时反馈，`useFormStatus` 让深处的按钮知道该不该禁用。

## 与缓存集成

action 里改完数据后，缓存更新有四个选择（详见 [12 重新验证](./12-revalidating.md)）：

| API | 何时用 |
|---|---|
| `updateTag(tag)` | 用户提交后要**立刻**看到自己的变更（read-your-writes）。仅 Server Actions |
| `revalidateTag(tag, 'max')` | 标记失效，其他人下次请求时后台刷新。Server Actions 和 Route Handlers 都可用 |
| `revalidatePath(path)` | 只影响一条路由，打标签属于杀鸡用牛刀 |
| `refresh()` | 视图依赖了缓存之外、action 刚改变的状态 |

`updateTag`、`revalidatePath`、`refresh` 会在服务端重渲染当前路由并把新 RSC Payload 放进 action 响应，所以页面在同一次往返里就更新了。`revalidateTag` 配 SWR profile 有意跳过这次立即重渲染。

## 与 Route Handlers 的选型

| | Server Actions | Route Handlers |
|---|---|---|
| 调用方 | 你自己的 UI（表单、事件处理器） | 任何 HTTP 客户端（第三方、webhook、移动端） |
| 方法 | 只有 POST | GET / POST / PUT / DELETE 等 |
| 返回值 | 序列化后给客户端组件消费 | 完整的 HTTP 响应（状态码、响应头、任意 body） |
| 渐进增强 | 表单原生支持 | 不适用 |
| 缓存集成 | 直接调 `updateTag` / `revalidateTag` / `refresh` | `updateTag` / `refresh` 不可用，只能用 `revalidateTag` |
| 适合 | 应用内的数据变更 | 对外 API、webhook、需要自定义状态码的场景 |

判断标准很简单：**只有你自己的前端在调，就用 Server Action；需要对外暴露 HTTP 接口，就用 Route Handler。** 详见 [15 Route Handlers](../03-routing-network/15-route-handlers.md)。

## 常见坑

- **现象**：页面渲染时检查了登录状态才显示表单，结果没登录的人还是能通过直接 POST 删除数据。
  **原因**：页面级检查只控制渲染哪个 UI，不是安全边界。Server Action 是独立入口，可以被直接 POST 调用，请求完全不经过你的 UI。
  **解法**：**在每一个 action 内部**重新 `await auth()` 并检查权限。把鉴权逻辑收进 Data Access Layer（`import 'server-only'` 的模块），让 `'use server'` 的 action 保持很薄、只做转发。

- **现象**：action 接收一个完整的 `Item` 对象然后直接 `update({ where: { id: item.id } })`，schema 校验也过了，但还是能被越权改别人的数据。
  **原因**：schema 校验只检查输入的**形状**。一个格式完全正确的对象，仍然可以指向调用者不拥有的行。整个对象来自客户端，id 也是客户端给的。
  **解法**：只接收一个**引用**（通常是 ID）加上用户的变更，其余从可信来源按会话重新读取。查询时带上归属条件：`where: { id: itemId, ownerId: session.user.id }`。

- **现象**：用 `updateUser.bind(userId)` 传参数，action 收到的 `userId` 不对。
  **原因**：`bind` 的第一个参数是 `thisArg` 占位，不是业务参数。写成 `bind(userId)` 会把 `userId` 绑成 `this`，函数实际收到的第一个参数变成了 `FormData`。
  **解法**：必须写 `.bind(null, userId)`。

- **现象**：action 里 `redirect()` 后面的重新验证没执行；或者用户提交后看到旧数据，刷新一下才对。
  **原因**：两种。① `redirect` 抛的是控制流异常，它之后的代码不会运行。② 用了 `revalidateTag(tag, 'max')`——它是 stale-while-revalidate 语义，会先给陈旧内容，而且**有意不在 action 响应里带重渲染**。
  **解法**：把 `updateTag` / `revalidatePath` 放在 `redirect` **之前**。需要"提交完立刻看到自己写的"就用 `updateTag(tag)`，要给所有人后台刷新才用 `revalidateTag(tag, 'max')`。

- **现象**：`useFormStatus` 一直返回 `pending: false`。
  **原因**：这个 hook 读的是**最近的父级 `<form>`** 的状态。放在表单外面的组件里读不到任何东西。
  **解法**：把它放在一个被 `<form>` 包住的子组件里。或者改用 `useActionState` 返回的 `pending`——它不要求组件位置。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 变更后失效缓存 | `revalidateTag('posts')` | `updateTag('posts')`（read-your-writes）或 `revalidateTag('posts', 'max')` |
| 提交后刷新当前页 | 手动 `router.refresh()` | `refresh()`（Server Action 内），或直接用 `updateTag` |
| 表单状态 | `useFormState`（react-dom） | **`useActionState`（react）** |
| 表单错误处理 | `try/catch` + throw | 预期错误**用返回值表达** |
| 鉴权 | 只在页面级检查 | **每个 action 内部重新检查** |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 5、6 条。

## API / 配置速查

| API | 签名 | 说明 |
|---|---|---|
| `'use server'` | 指令 | 函数体顶部或文件顶部；函数必须是 `async` |
| `<form action={fn}>` | — | 自动传 `FormData`，支持渐进增强 |
| `fn.bind(null, arg)` | — | 传额外参数；**第一个参数必须是 `null`** |
| `useActionState(fn, initial)` | `[state, formAction, pending]` | 管理返回值与 pending；action 首参变为 `prevState` |
| `useFormStatus()` | `{ pending, data, method, action }` | 读最近父级 `<form>` 状态；必须放在表单内 |
| `useOptimistic(state, updateFn)` | `[optimistic, addOptimistic]` | 服务端返回前先更新 UI |

| 配置项 | 默认 | 说明 |
|---|---|---|
| `serverActions.bodySizeLimit` | `1MB` | action 请求体大小上限 |
| `serverActions.allowedOrigins` | — | 代理或 CDN 域名，用于 CSRF 的 Origin 校验 |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | 每次构建生成 | 多实例自托管必须固定，保证闭包可解密 |

## 延伸阅读

- [官方文档：Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data)
- [官方文档：Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions)
- [官方文档：How to create forms with Server Actions](https://nextjs.org/docs/app/guides/forms)
- [官方文档：Data Security](https://nextjs.org/docs/app/guides/data-security)
- [官方文档：`use server`](https://nextjs.org/docs/app/api-reference/directives/use-server)
- [官方文档：`serverActions` 配置](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)
- [React 文档：`useActionState`](https://react.dev/reference/react/useActionState)
- [React 文档：`useFormStatus`](https://react.dev/reference/react-dom/hooks/useFormStatus)
- [React 文档：`useOptimistic`](https://react.dev/reference/react/useOptimistic)
