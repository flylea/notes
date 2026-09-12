# 52 · 工具箱

> **一句话结论**：四个工具的取舍都指向同一条原则——**能留在服务端的就留在服务端**。Zod 在服务端校验（不进 bundle 就不用管体积），React Hook Form 只在字段级交互真的需要时才上（上了就失去渐进增强），shadcn/ui 把源码给你（改样式不对抗库），tRPC 只在「客户端主动拉取」或「跨端共享类型」时才值得引入。

## 最小可运行示例

```bash
# 校验
pnpm add zod
# 表单（可选，只在需要字段级即时校验时加）
pnpm add react-hook-form @hookform/resolvers
# UI 组件
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button dialog input label form
# 端到端类型安全（可选）
pnpm add @trpc/server @trpc/client @trpc/react-query @tanstack/react-query
# 组件开发环境（可选）
pnpm dlx storybook@latest init
```

```ts
// lib/validations/note.ts —— Zod：一份 schema，两种用途
import { z } from 'zod'

export const noteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: '标题不能为空' })
    .max(200, { error: '标题不能超过 200 字' }),
  content: z.string().max(50_000).default(''),
})

// 服务端用这个（输出类型：default 已应用）
export type NoteData = z.output<typeof noteSchema>
// 客户端表单用这个（输入类型：default 字段可省略）
export type NoteInput = z.input<typeof noteSchema>
```

## Zod 与 Valibot：什么时候该换

两个库的能力几乎重叠，差异集中在**体积**和**API 风格**。

### API 风格

```ts
// lib/validations/user.ts —— Zod：链式方法
import { z } from 'zod'

export const userSchema = z.object({
  email: z.email({ error: '邮箱格式不对' }).trim(),
  age: z.number().int().min(0).max(150),
  role: z.enum(['admin', 'member']).default('member'),
})
```

```ts
// lib/validations/user.ts —— Valibot：函数组合
import * as v from 'valibot'

export const UserSchema = v.object({
  email: v.pipe(v.string(), v.email(), v.trim()),
  age: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(150)),
  role: v.optional(v.picklist(['admin', 'member']), 'member'),
})
```

Zod 把校验器做成对象，方法调用返回新对象。Valibot 把校验器做成**纯函数**，用 `pipe()` 串联。

这个差异直接决定了体积：Zod 的每个校验器是一个类实例，即使用不到也会被打包器保守处理；Valibot 的校验器是独立函数，未使用的可以被完整 tree-shake。

### 体积差多少

Valibot 的核心包在 tree-shake 后通常比 Zod 小**一个数量级**。但这个优势**只在你把校验器打进客户端 bundle 时才体现**。

```ts
// lib/validations/note.ts
import 'server-only'   // ← 加上这一行，体积差异归零
import { z } from 'zod'
```

服务端校验的代码不进客户端 bundle。所以对本章的项目（校验只发生在 Server Action 和 Route Handler 里），**体积差异是零**。

### 判断表

| 场景 | 选择 |
|---|---|
| 只做服务端校验（Server Actions / Route Handlers） | **Zod**（生态集成更广） |
| 客户端实时校验，且对首屏 JS 体积敏感 | **Valibot** |
| 边缘函数、Serverless 冷启动敏感 | **Valibot** |
| 需要 OpenAPI / JSON Schema 生成 | **Zod**（生成器生态更全） |
| 团队排斥 `pipe()` 风格 | **Zod** |

**生态集成度是 Zod 的真实护城河**：`@hookform/resolvers`、`zod-openapi`、Prisma 的 `zod-prisma-types`、各种 API 框架的输入校验中间件——这些几乎都优先支持 Zod。选 Valibot 意味着你要接受「某些集成需要自己写胶水层」。

### Zod 4 的写法变化

```ts
// 旧（Zod 3）
z.string({ required_error: '必填', invalid_type_error: '必须是字符串' })
z.string().email('邮箱格式不对')

// 新（Zod 4）
z.string({ error: '必填' })
z.email({ error: '邮箱格式不对' })
```

两个变化：错误配置统一成 `{ error }`；顶层格式校验器（`z.email()`、`z.uuid()`、`z.url()`）从字符串方法提升为独立函数。旧写法在 v4 里仍有兼容层，但新代码应该用新写法。

## React Hook Form 与 Server Actions

### 默认不要用 RHF

Server Actions 的表单模型已经覆盖了大多数场景：

```tsx
// app/notes/note-form.tsx
'use client'

import { useActionState } from 'react'
import { createNote } from '@/app/actions/notes'

export function NoteForm() {
  const [state, formAction, pending] = useActionState(createNote, {})

  return (
    <form action={formAction}>
      <input name="title" required />
      {state.errors?.title && <p aria-live="polite">{state.errors.title[0]}</p>}
      <button disabled={pending}>保存</button>
    </form>
  )
}
```

这段代码白送两个能力：**JS 未加载时表单仍能提交**（渐进增强），以及**校验逻辑只有一份**（服务端）。

### 什么时候需要 RHF

| 需求 | Server Actions | RHF |
|---|---|---|
| 字段级即时校验（输入时） | 需要往返服务端 | **本地，无延迟** |
| 动态字段数组（`useFieldArray`） | 手动管理 | **内置** |
| 跨字段依赖校验（结束日期 > 开始日期） | 服务端才报错 | **本地即时** |
| 渐进增强 | **白送** | **失去** |
| 校验逻辑份数 | 1 份 | 2 份（本地 + 服务端） |

**核心取舍：RHF 用渐进增强换字段级即时反馈。**

### 混合用法

```tsx
// app/notes/note-form-rhf.tsx
'use client'

import { startTransition, useActionState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createNote } from '@/app/actions/notes'
import { noteSchema, type NoteInput } from '@/lib/validations/note'

export function NoteFormRHF() {
  const [state, formAction, pending] = useActionState(createNote, {})

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NoteInput>({
    resolver: zodResolver(noteSchema),
    defaultValues: { title: '', content: '' },
    // 只在字段失焦时校验，输入时不校验。减少噪音
    mode: 'onBlur',
  })

  function onSubmit(values: NoteInput) {
    const formData = new FormData()
    formData.set('title', values.title)
    formData.set('content', values.content ?? '')

    startTransition(() => {
      formAction(formData)
    })
  }

  return (
    // 注意这里没有 action={formAction}：用了 RHF 就接管了提交，
    // 渐进增强也就失去了
    <form onSubmit={handleSubmit(onSubmit)}>
      <label htmlFor="title">标题</label>
      <input id="title" {...register('title')} />
      {errors.title && <p className="text-sm text-red-600">{errors.title.message}</p>}
      {/* 服务端返回的错误也要显示 —— 两套错误来源都要处理 */}
      {state.errors?.title && (
        <p className="text-sm text-red-600">{state.errors.title[0]}</p>
      )}

      <label htmlFor="content">内容</label>
      <textarea id="content" rows={8} {...register('content')} />

      <button type="submit" disabled={pending}>
        {pending ? '保存中…' : '保存'}
      </button>
    </form>
  )
}
```

三个必须注意的点：

**同一份 Zod schema 用两次，但通过不同的入口。** 客户端通过 `zodResolver` 用，服务端在 Server Action 里用。**服务端那次永远不能省**——客户端的校验是 UX，服务端的校验才是安全。客户端校验可以被绕过（改 JS、直接 POST），服务端不能。

**两套错误来源都要渲染。** `errors` 来自 RHF（本地校验），`state.errors` 来自 Server Action（服务端校验）。只渲染一套会漏掉另一套的错误。

**用了 RHF 就没有渐进增强了。** `<form onSubmit={...}>` 在 JS 未加载时什么都不做。如果这个表单对「JS 挂了也要能提交」有硬要求，就不要用 RHF。

### RHF 与 `<Activity>` 的冲突

Cache Components 下，Next.js 用 React 的 `<Activity>` 保留客户端导航时的组件状态（见 [11 缓存模型](../02-rendering/11-cache-components.md)）。**导航离开再回来时，表单的输入值和 RHF 的内部状态都还在**——因为组件没被卸载。

依赖「离开即清空」的写法会失效。需要重置时显式调用：

```tsx
// 客户端表单组件内
const { reset } = useForm<NoteInput>({ resolver: zodResolver(noteSchema) })

// 提交成功后显式重置
async function onSubmit(values: NoteInput) {
  const result = await createNoteAction(values)
  if (result.ok) reset()
}
```

## shadcn/ui

### 它的本质

```bash
pnpm dlx shadcn@latest add button dialog input
```

跑完之后 `components/ui/button.tsx` 是**你项目里的一个普通文件**。这不是组件库，是「用 CLI 把组件源码复制进来」。

底层是 **Radix UI**（无障碍原语）+ **Tailwind**（样式）。所以焦点陷阱、键盘导航、ARIA 属性这些难做的部分已经解决了，剩下的是样式——而样式就在你的文件里。

### 为什么这样设计更好

| 方式 | 定制方式 | 什么时候会撞墙 |
|---|---|---|
| **shadcn/ui** | 直接改源码 | 上游修 bug 要手动同步 |
| MUI / Ant Design | 主题配置 + `sx` prop | 定制到一定程度必然和库的样式体系对抗 |
| Radix 裸用 | 自己写全部样式 | 工作量大 |
| 纯手写 | 无约束 | 无障碍要自己实现 |

**「改样式不打架」是它的核心价值。** 用 MUI 时，把一个按钮的圆角从 4px 改成 6px 可能要通过 `theme.shape.borderRadius`，改成 8px 又要处理 `sx` 的优先级——每改一次都在和库的设计决策谈判。

### 表单集成

shadcn/ui 的 `<Form>` 组件是对 RHF 的封装：

```tsx
// app/notes/note-form-shadcn.tsx
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { noteSchema, type NoteInput } from '@/lib/validations/note'

export function NoteFormShadcn({ onSubmit }: { onSubmit: (v: NoteInput) => void }) {
  const form = useForm<NoteInput>({
    resolver: zodResolver(noteSchema),
    defaultValues: { title: '', content: '' },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>标题</FormLabel>
              <FormControl>
                <Input placeholder="给这条笔记起个名字" {...field} />
              </FormControl>
              {/* FormMessage 会自动读取该字段的校验错误，不需要手写条件判断 */}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* content 字段结构完全相同，省略 */}

        <Button type="submit" disabled={form.formState.isSubmitting}>
          保存
        </Button>
      </form>
    </Form>
  )
}
```

`<FormMessage />` 会自动读取对应字段的校验错误并渲染——不需要手写 `errors.title?.message` 的条件判断。

**注意 `<Form>` 是 RHF 的包装，所以这里也是「用 RHF 就没有渐进增强」**。如果要用 Server Actions 的渐进增强，直接用原生 `<form action={formAction}>` 配 shadcn 的 `<Input>` / `<Button>`，不要用 `<Form>`。

### 什么时候不该用 shadcn/ui

- **需要几十个复杂组件**（数据网格、甘特图、富文本编辑器）。这类组件的维护成本远超「复制源码」模式能承受的范围，用成熟库更划算。
- **团队不用 Tailwind**。shadcn/ui 的样式全是 Tailwind class，换 CSS 方案等于重写。
- **需要长期跟上游升级**。源码进仓库意味着不会自动升级——上游修了焦点陷阱的 bug，你得自己看 diff。

## tRPC：类型安全的适用边界

### tRPC 解决什么问题

tRPC 让客户端调用服务端函数时**拥有端到端类型**，不需要代码生成。它的核心价值是「跨网络调用的类型推导」。

### Server Actions 已经覆盖了大部分

```ts
// app/actions/notes.ts
'use server'

export async function createNote(input: NoteInput): Promise<{ id: string }> {
  // ...
}
```

```tsx
// 客户端组件里
const { id } = await createNote({ title: 'x' })  // 返回值类型是 { id: string }
```

不需要 router、不需要 provider、不需要 query key。tRPC 多出来的那层「客户端缓存 + 失效管理」，在 RSC 架构里被**服务端渲染 + `updateTag`** 替代了。

### 该用 tRPC 的三个场景

**场景一：客户端主动、按需拉取。**

搜索框每次输入都发请求、轮询刷新的面板、无限滚动的列表——这类「不是由渲染触发的取数」用 Server Action 很别扭：

| | Server Action | tRPC |
|---|---|---|
| HTTP 方法 | 只有 POST | 查询用 GET，可被缓存 |
| 并发 | **客户端一次只派发一个** | 可以并发 |
| 客户端缓存 | 无 | TanStack Query 提供 |
| 轮询 / 窗口聚焦刷新 | 手动实现 | Query 内置 |

Server Action 的「串行派发」是硬约束（见 [13 Server Actions](../02-rendering/13-server-actions.md)）——Next.js 每个客户端一次只派发一个 action。搜索框连续输入时，请求会排队。这个场景必须用 Route Handler。

**场景二：多个客户端共享同一套 API。**

同一份后端要服务 Web、React Native、桌面端。Server Actions 只服务于自己的 Next.js 应用，tRPC 的 router 可以被所有客户端复用。

**场景三：横切逻辑统一挂载。**

日志、限流、鉴权、输入校验统一挂在 router 的 middleware 上，而不是在每个 action 里重复。

```ts
// server/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server'
import { getSession } from '@/lib/auth-server'

const t = initTRPC.context<{ tenantId: string }>().create()

const isAuthed = t.middleware(async ({ ctx, next }) => {
  const session = await getSession()
  if (!session?.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, userId: session.user.id } })
})

export const protectedProcedure = t.procedure.use(isAuthed)
```

```ts
// server/routers/search.ts
import { z } from 'zod'
import { protectedProcedure, router } from '../trpc'
import { searchNotes } from '@/lib/dal/search'

export const searchRouter = router({
  // 用 .query 而不是 .mutation —— 查询语义允许 GET、允许缓存、允许并发
  notes: protectedProcedure
    .input(z.object({ q: z.string().min(1), cursor: z.string().optional() }))
    .query(({ ctx, input }) => searchNotes(ctx.userId, input.q, { cursor: input.cursor })),
})
```

### 不该用 tRPC 的场景

| 场景 | 为什么不该用 |
|---|---|
| 调用方只有自己的 Next.js 页面 | Server Actions 已经覆盖，router 是纯开销 |
| 需要渐进增强的表单 | Server Action 的表单在 JS 未加载时能提交，tRPC 不能 |
| 需要对外暴露 API | tRPC 的协议不是标准 REST/GraphQL，第三方无法消费 |
| 团队规模小、迭代快 | router 定义 + client provider + query key 都是维护成本 |
| 需要 SEO 的服务端渲染 | RSC 直接 `await` DAL 更直接 |

### 判断流程

```
调用方只有自己的 Next.js 应用？
├─ 是 → 由渲染触发？
│        ├─ 是 → Server Action
│        └─ 否（搜索/轮询/无限滚动）→ Route Handler（或 tRPC）
└─ 否（其他端 / 第三方）→ tRPC（内部多端）或 REST/GraphQL（对外）
```

**最重要的一条：不要因为「tRPC 很流行」就在 RSC 项目里引入它。** 它的价值在「没有 RSC 的世界里提供端到端类型」。有了 RSC 和 Server Actions，这个价值被大幅稀释了。

## Storybook

### 在 RSC 项目里 Storybook 能做什么

Storybook 渲染的是**客户端组件**。Server Component 是 async 函数，依赖服务端运行时，Storybook 的浏览器环境跑不了。

| 组件类型 | Storybook 支持 |
|---|---|
| 纯展示组件（无状态、无 hooks） | **完全支持** |
| 客户端组件（`'use client'`） | **完全支持** |
| 异步 Server Component | 不支持，需要拆出可测的部分 |
| 依赖 `cookies()` / `headers()` 的组件 | 不支持，需要把数据作为 props 传入 |

**这个限制其实是个设计指引**：能被 Storybook 渲染的组件，就是「数据通过 props 传入」的组件。把组件写成这个形状，可测性和可复用性都会变好。

### 配置

```bash
pnpm dlx storybook@latest init
```

```ts
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/nextjs'

const config: StorybookConfig = {
  stories: ['../components/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
}

export default config
```

`@storybook/addon-a11y` 值得加上——它会在每个 story 上跑无障碍检查，把「忘了 `aria-label`」「对比度不足」这类问题在开发阶段暴露出来。

### 一个 story

```tsx
// components/note-card.stories.tsx
import type { Meta, StoryObj } from '@storybook/nextjs'
import { NoteCard } from './note-card'

const meta = {
  title: 'Notes/NoteCard',
  component: NoteCard,
  tags: ['autodocs'],
  args: {
    href: '/notes/abc',
    title: '周一站会记录',
    updatedAt: '2026-03-14T09:00:00.000Z',
    tags: [{ id: 't1', name: '工作', color: '#3b82f6' }],
  },
} satisfies Meta<typeof NoteCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LongTitle: Story = {
  args: {
    title: '这是一个非常长的标题，用来验证布局在极端内容下不会崩坏',
  },
}

export const NoTags: Story = {
  args: { tags: [] },
}
```

**`LongTitle` 这类「边界 story」比正常状态的 story 有价值得多。** 正常状态你在开发时天天看到；溢出、换行、空状态只在特定数据下出现，而那时往往已经上线了。

### 什么时候值得上 Storybook

- **有共享组件库**。多个页面/多个 zone 复用的组件，需要一个独立的开发和评审环境。
- **有设计师参与**。设计评审时能直接打开组件看各种状态，不用跑整个应用。
- **需要视觉回归测试**。Storybook 的 story 可以作为截图测试的输入。

**不值得的情况**：项目只有几个页面、组件都只在一处用。这时 Storybook 的配置和维护成本大于收益——直接在应用里看就够了。

## 常见坑

- **现象**：为了减小包体积把 Zod 换成 Valibot，但体积没变。
  **原因**：校验代码本来就在服务端（`import 'server-only'`），根本不进客户端 bundle。
  **解法**：先确认校验代码在哪运行。只在客户端 bundle 里有校验器时，体积差异才存在。

- **现象**：Zod 的错误信息不生效，显示的是默认英文。
  **原因**：用了 Zod 3 的写法 `{ message: '...' }` 或 `{ required_error: '...' }`，而 Zod 4 统一成了 `{ error: '...' }`。
  **解法**：改用 `{ error: '...' }`。

- **现象**：用了 React Hook Form 之后，JS 加载失败时表单提交没反应。
  **原因**：`<form onSubmit={handleSubmit(...)}>` 依赖 JS。RHF 接管了提交，渐进增强就失去了。
  **解法**：这是 RHF 的固有代价。如果这个表单必须支持无 JS 提交，用原生 `<form action={serverAction}>`，把字段级校验降级为 `required` / `type` 这类 HTML 原生属性。

- **现象**：RHF 的表单错误显示了，但 Server Action 返回的错误没显示。
  **原因**：只渲染了 RHF 的 `formState.errors`，忘了渲染 `useActionState` 返回的 `state.errors`。
  **解法**：两套错误来源都要渲染。本地校验和服务端校验的失败原因不同，用户需要看到两者。

- **现象**：导航离开表单再回来，输入的内容还在。
  **原因**：Cache Components 下 `<Activity>` 保留了路由状态，组件没有卸载。
  **解法**：在提交处理器里显式调用 RHF 的 `reset()`，或者把状态从 URL 派生。见 [11 缓存模型](../02-rendering/11-cache-components.md)。

- **现象**：改了 shadcn/ui 组件的样式，重新 `add` 之后改动被覆盖。
  **原因**：`shadcn add` 会重新写入组件文件。
  **解法**：这是「源码进仓库」模式的固有特性。要保留改动，把定制逻辑包一层自己的组件（`components/note-button.tsx` 包 `components/ui/button.tsx`），而不是改源码。

- **现象**：搜索框连续输入时，请求排队，界面卡顿。
  **原因**：用了 Server Action。Next.js **每个客户端一次只派发一个 Server Action**，请求会串行执行。
  **解法**：这类「客户端主动、高频触发」的取数用 Route Handler（或 tRPC）。Server Action 适合表单提交这类「用户明确触发的单次变更」。

- **现象**：tRPC 的 `useQuery` 在 Server Component 里报错。
  **原因**：TanStack Query 的 hooks 只能在客户端组件里用。
  **解法**：Server Component 里直接 `await` DAL 函数，不要绕 tRPC。tRPC 的价值在客户端侧的按需拉取。

- **现象**：Storybook 里渲染一个 Server Component 报错。
  **原因**：Storybook 运行在浏览器环境，无法执行 async Server Component。
  **解法**：把纯展示部分拆成同步组件（接收数据作为 props），在 Storybook 里测它。数据获取部分单独测 DAL 函数。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 表单状态 | `useFormState`（react-dom） | **`useActionState`（react）** |
| Zod 错误配置 | `{ message: '...' }` / `{ required_error: '...' }` | **`{ error: '...' }`** |
| Zod 格式校验 | `z.string().email()` | **`z.email()`**（顶层函数） |
| 校验位置 | 客户端为主 | **服务端权威校验 + 客户端可选即时校验** |
| 变更后刷新 | `router.refresh()` | `updateTag()` / `refresh()` |
| 客户端导航状态 | 组件卸载即清空 | **`<Activity>` 保留状态**，需显式 `reset()` |
| lint | `next lint` | **ESLint / Biome CLI** |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 5、13 条。

## API / 配置速查

| 工具 | 关键 API | 说明 |
|---|---|---|
| Zod | `z.output<T>` | 校验**后**类型（`default` 已应用） |
| Zod | `z.input<T>` | 校验**前**输入类型（`default` 字段可选） |
| Zod | `.safeParse(v)` | 返回 `{ success, data \| error }`，不抛异常 |
| Zod | `error.flatten().fieldErrors` | 字段级错误，配合 `useActionState` 返回 |
| Valibot | `v.pipe(a, b, c)` | 组合校验器 |
| Valibot | `v.InferOutput<T>` / `v.InferInput<T>` | 对应 Zod 的 output / input |
| RHF | `useForm({ resolver, defaultValues, mode })` | `mode` 控制校验时机：`onBlur` / `onChange` / `onSubmit` |
| RHF | `handleSubmit(fn)` | 校验通过后调用 `fn(values)` |
| RHF | `reset()` | 显式重置，`<Activity>` 下必需 |
| RHF | `formState.errors` | 本地校验错误 |
| shadcn | `FormField` + `render` | 把 RHF 的 field 绑到 UI 上 |
| shadcn | `FormMessage` | 自动渲染对应字段的错误 |
| tRPC | `t.procedure.use(middleware)` | 横切逻辑挂载点 |
| tRPC | `.query()` / `.mutation()` | `query` 语义可 GET、可缓存、可并发 |
| Storybook | `satisfies Meta<typeof C>` | 类型安全的 story 元数据 |

| 决策 | 选它 | 换它的条件 |
|---|---|---|
| 校验库 | Zod | 校验器要进客户端 bundle 且体积敏感 → Valibot |
| 表单 | Server Actions | 需要字段级即时校验 / 动态字段数组 → RHF |
| UI | shadcn/ui | 需要几十个复杂组件 → 成熟组件库 |
| API 层 | Server Actions | 客户端按需拉取 / 跨端共享 → Route Handler 或 tRPC |
| 组件开发 | 直接用应用 | 有共享组件库 / 设计评审流程 → Storybook |

## 延伸阅读

- [Zod 官方文档](https://zod.dev/)
- [Valibot 官方文档](https://valibot.dev/)
- [React Hook Form 官方文档](https://react-hook-form.com/)
- [`@hookform/resolvers`](https://github.com/react-hook-form/resolvers)
- [shadcn/ui 官方文档](https://ui.shadcn.com/docs)
- [Radix UI 官方文档](https://www.radix-ui.com/primitives)
- [tRPC 官方文档](https://trpc.io/docs/)
- [TanStack Query 官方文档](https://tanstack.com/query/latest)
- [Storybook 官方文档](https://storybook.js.org/docs)
- [Storybook Next.js 框架](https://storybook.js.org/docs/get-started/frameworks/nextjs)
- [官方文档：How to create forms with Server Actions](https://nextjs.org/docs/app/guides/forms)
- [官方文档：Preserving UI state](https://nextjs.org/docs/app/guides/preserving-ui-state)
