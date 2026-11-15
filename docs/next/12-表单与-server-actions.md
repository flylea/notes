# 第 12 章 表单与 Server Actions

第 11 章处理了数据怎么显示。这一章处理数据怎么被写进来：用户填表单、点提交、服务端校验、写库、界面更新。

Next.js 的做法是把写操作写成服务端函数，在表单里直接引用。这个机制叫 Server Function，用在 `action` 位置时叫 Server Action。它省掉了手写 API 路由与 `fetch`，代价是几条规则必须记牢：函数只跑在服务端，参数与返回值必须可序列化，错误要分几类分别处理，防重复提交要靠数据库而不是靠按钮禁用。

这一章解决四个具体问题。第一，一次提交在网络上发生了什么，为什么没有 JS 也能提交。第二，校验失败、业务失败、系统故障三类错误分别该显示在哪。第三，提交进行中、提交成功、并发冲突时界面怎么表现。第四，这套机制的信任边界在哪里，哪些安全属性由框架提供，哪些必须自己写。

涉及的概念有 `'use server'` 指令、`useActionState`、`useFormStatus`、`useOptimistic`、`startTransition`、渐进增强、CSRF 的 Origin 校验、action ID、`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`。基线是 Next.js 16.4.6 与 React 19.3，代码放在 teamstack 项目的成员管理页。

本机没有运行 Supabase，涉及数据库写入与多实例部署的检查点标「未验证」。浏览器行为部分可以在 `pnpm dev` 下直接观察。

---

## 12.1 服务端函数与一次提交

Server Function 是一个加了 `'use server'` 的异步函数。它只在服务端执行，客户端拿到的是一份引用，不是可读的函数体。

```ts
// src/app/(app)/teams/[slug]/members/actions.ts
'use server'

export async function removeMember(slug: string, userId: string) {
  // 这段代码只在服务端运行
}
```

指令有两种位置。放在文件第一行，整个文件的导出都成为 Server Function；放在函数体第一行，只有这个函数是。文件级写法更常见，因为一个动作文件里的函数通常都需要服务端执行。

调用方式有三种：表单的 `action` 属性、事件处理器里的直接调用、`useActionState` 包装后的 `formAction`。三者底层都发一个 POST 到当前路由，请求头带一个不透明的 action ID，响应同时包含返回值与重新渲染后的 RSC 数据。

一次成功提交的往返是这样的。浏览器 POST 到当前地址，请求体是表单字段编码后的内容，请求头 `Next-Action` 是构建时生成的 action ID。服务端按 ID 找到函数，鉴权、校验、写库，返回一段 Flight 数据。客户端用返回值更新组件状态，同时用响应里的 RSC 数据重渲染受影响的部分。

「一次请求同时完成写与读」由此而来。只有动作里调用了 `updateTag`、`revalidatePath`、`refresh`、修改 cookie 或 `redirect`，响应才带重渲染数据；纯写库不做这些，列表不会自己变。

没有 JS 时行为不同。表单退化成浏览器原生提交，请求体是 `application/x-www-form-urlencoded`，响应是一整页 HTML，页面整体刷新。功能仍然可用。

四条规则必须记住。

Server Function 只接受 POST。把 action 的地址贴进地址栏用 GET 访问，会得到 405 或 404。

参数与返回值必须能通过 Flight 序列化。普通对象、数组、字符串、数字、布尔、`Date`、`Map`、`Set`、`FormData`、`ReadableStream` 可以；类实例、函数、Symbol 不行。

函数体可以读闭包变量，闭包内容加密后随请求发送。加密只防篡改，既不防读取，也不构成权限检查。任何「只有所有者能调」的判断都要在函数体里重新做。

客户端对同一页面的 action 调用是串行派发的。第一个没返回，第二个排队。服务端不排队，两个标签页的请求可以同时到达。这决定了防重复提交得靠数据库约束。

### 为什么 action 不能缓存

action 走 POST，POST 在 HTTP 语义里既不安全也不幂等。浏览器与 CDN 默认不缓存 POST 响应，Next.js 也不会为 action 建立缓存条目。

这意味着两件事。每次提交都会真实到达服务端，不存在「点了没反应，因为命中缓存」的情况。反过来，失败重试也没有缓存层兜底，重复的副作用要自己处理。

幂等性因此要显式设计。同一个请求重复到达时，结果应该与到达一次相同：邀请用唯一约束挡住第二行，扣费用幂等键记住处理过的单号，改名用版本号拒绝旧版本覆盖。这些手段在第 10 章展开，本章只需要记住：action 不是幂等的，重复执行的风险由业务承担。

---

### 与手写 API 路由的差别

传统写法要建一个 `app/api/invite/route.ts`，客户端用 `fetch` 调它，自己处理 loading、错误分支、成功后的列表刷新。一个表单二十行，三个表单开始复制粘贴，五个表单开始不一致。

Server Action 把这条链路收进一个函数：鉴权、校验、写库、缓存失效都在同一个文件里，类型从服务端一路传到客户端，改函数签名时 TypeScript 会报错。少一层接口约定，就少一处「前端传的字段名和后端读的不一致」。

代价也要说清楚。action 不能给第三方系统调用，它依赖构建期生成的 action ID 与加密约定，外部客户端拼不出合法请求。action 不能自定义 HTTP 状态码与响应头，想返回 201 或者设置 `Cache-Control` 做不到。action 不能处理 GET，查询类接口仍然要写 Route Handler。调试时要看 Flight 格式的响应体，比 JSON 难读。

判断标准很简单：浏览器里的表单与按钮用 action，对外提供的接口用 Route Handler。付款回调、第三方 webhook、需要流式下载的导出接口，都属于后一类。

---

## 12.2 错误的三种形状

一次提交可能失败在很多地方，处理方式不能混为一谈。

| 类型 | 判定标准 | 处理方式 | 显示位置 |
| --- | --- | --- | --- |
| 字段错误 | 用户输入不合法 | 返回 state | 对应输入框下方 |
| 业务错误 | 输入合法但操作不允许 | 返回 state | 表单顶部或页面级提示 |
| 系统错误 | 代码或数据库故障 | 抛出异常 | `error.tsx` 整块接住 |

判断依据是「用户能否自己修正」。能修正的留在表单里，不能修正的升级成页面级提示，修不了的交给错误边界。

为什么不把所有错误都抛出去？三个原因。抛异常会让最近的 `error.tsx` 整块替换页面，用户填的内容全丢。生产环境的服务端错误消息会被替换成通用文案加一个 digest，用户看不到可读原因。异常路径无法携带结构化数据，字段级错误没法逐条返回。

为什么不把所有错误都返回成对象？系统故障返回 200 会让监控失效，日志里也看不出这次请求失败了。真正的故障应该让请求以 500 结束。

系统错误的落点由错误边界决定：

```tsx
// src/app/(app)/teams/[slug]/error.tsx
'use client'

import { useEffect } from 'react'

export default function TeamError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // digest 是服务端日志里的关联键
    console.error('[team-error]', error.digest)
  }, [error])

  return (
    <div role="alert">
      <h2>出错了</h2>
      <p>操作没有完成，请稍后重试。错误编号：{error.digest ?? '未知'}</p>
      <button type="button" onClick={() => reset()}>
        重试
      </button>
    </div>
  )
}
```

`error.tsx` 只接得住同级页面与下级 segment 抛出的错误，接不住同一层 `layout.tsx` 自己抛的错。根布局崩了要用 `global-error.tsx`，它自带 `html` 与 `body` 标签。

`reset()` 只重渲染这个错误边界覆盖的 segment，不改变 URL，也不主动重新拉取服务端数据。数据库恢复后点「重试」，渲染会重新跑；如果失败发生在缓存过的数据上，可能仍是旧结果，要配合 `router.refresh()` 才干净。

`redirect()` 与 `notFound()` 用抛异常实现，所以不要把它们包在 `try` 里。`catch` 会吞掉控制流异常，页面不跳转。确实需要在 `try` 里调用时，用 `unstable_rethrow` 重新抛出。

成功后要刷新数据，用 `updateTag` 或 `revalidateTag`。当前用户要立刻看到自己的修改，用 `updateTag`；两者分工在第 14 章展开。

---

## 12.3 校验函数与 action 实现

校验放在服务端函数里。客户端校验只负责即时反馈，服务端校验才是边界。

先写纯函数，让它不依赖请求，方便单测。

```ts
// src/lib/validation.ts
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase()
}

export function isValidEmail(input: string): boolean {
  const email = normalizeEmail(input)
  return email.length <= 254 && EMAIL_PATTERN.test(email)
}

export function parseRole(input: string): 'owner' | 'member' | null {
  return input === 'owner' || input === 'member' ? input : null
}

export function normalizeDisplayName(input: string): string {
  // 合并连续空白，去掉首尾空格
  return input.replace(/\s+/g, ' ').trim()
}

export function isValidDisplayName(input: string): boolean {
  const name = normalizeDisplayName(input)
  return name.length >= 1 && name.length <= 60
}
```

`isValidEmail` 的上限 254 来自 RFC 5321，更长的地址在任何真实邮件系统里都不可用。`normalizeEmail` 统一小写，因为同一邮箱的大小写不同形式在多数邮件服务里指向同一个人。

再写 action。

```ts
// src/app/(app)/teams/[slug]/members/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { revalidateTag, updateTag } from 'next/cache'
import { query } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { getActiveTeam, requireMembership } from '@/lib/teams'
import { isValidEmail, normalizeEmail, parseRole } from '@/lib/validation'

const SEAT_LIMITS = { free: 3, pro: 10, team: 50 } as const

export type InviteState =
  | { status: 'idle' }
  | {
      status: 'error'
      formKey: number
      formError?: string
      fieldErrors?: { email?: string; role?: string }
      values?: { email: string; role: string }
    }
  | { status: 'success'; formKey: number; message: string }

export async function inviteMember(
  prevState: InviteState,
  formData: FormData,
): Promise<InviteState> {
  // formKey 每次提交自增，成功后用它让表单重新挂载
  const formKey = prevState.status === 'idle' ? 1 : prevState.formKey + 1

  const user = await requireUser()
  const team = await getActiveTeam()

  const rawEmail = String(formData.get('email') ?? '')
  const rawRole = String(formData.get('role') ?? 'member')

  // 一次性收集字段错误，不要遇到第一个就返回
  const fieldErrors: { email?: string; role?: string } = {}
  if (!isValidEmail(rawEmail)) fieldErrors.email = '请输入有效的邮箱地址'
  const role = parseRole(rawRole)
  if (!role) fieldErrors.role = '请选择成员角色'

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: 'error',
      formKey,
      fieldErrors,
      values: { email: normalizeEmail(rawEmail), role: rawRole },
    }
  }

  // 权限判断必须在这里做，页面不渲染按钮不构成控制
  const membership = await requireMembership(team.id, user.id)
  if (membership.role !== 'owner') {
    return { status: 'error', formKey, formError: '只有团队所有者可以邀请成员' }
  }

  const seats = SEAT_LIMITS[team.plan as keyof typeof SEAT_LIMITS] ?? SEAT_LIMITS.free
  const occupied = await query<{ members: number; pending: number }>(
    `select
       (select count(*)::int from public.team_members where team_id = $1) as members,
       (select count(*)::int from public.invitations
         where team_id = $1 and status = 'pending') as pending`,
    [team.id],
  )
  const used = occupied.rows[0].members + occupied.rows[0].pending
  if (used >= seats) {
    return {
      status: 'error',
      formKey,
      formError: `席位已满（${used}/${seats}），请撤销待处理邀请或升级套餐`,
    }
  }

  const email = normalizeEmail(rawEmail)
  try {
    const inserted = await query<{ id: string }>(
      `insert into public.invitations
         (team_id, email, role, token, status, expires_at, invited_by)
       values ($1, $2, $3, $4, 'pending', now() + interval '7 days', $5)
       on conflict (team_id, lower(email)) where status = 'pending' do nothing
       returning id`,
      [team.id, email, role, crypto.randomUUID(), user.id],
    )
    if (inserted.rowCount === 0) {
      return { status: 'error', formKey, formError: '这个邮箱已经有一封待处理的邀请' }
    }
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      return { status: 'error', formKey, formError: '这个邮箱已经有一封待处理的邀请' }
    }
    throw error
  }

  updateTag(`team:${team.id}:invitations`)
  return { status: 'success', formKey, message: `邀请已发给 ${email}` }
}
```

顺序是先校验、再鉴权、最后写库。校验便宜且不需要请求上下文，放最前；鉴权在写库之前，避免越权数据先落库；日志与缓存失效属于副作用，放在写库之后，失败不影响主流程。

`requireUser()` 必须在动作里重新调用，不通过闭包传 `userId`。闭包里的身份是页面渲染那一刻的会话，请求到达时用户可能已经登出，或者已经被移出团队。

校验有三条边界容易被越过。长度上限只写前端，客户端改一下 DOM 就绕过去了，服务端必须再判一次。枚举值用字符串比较，`role` 只接受 `owner` 与 `member`，其他值直接拒绝，不要靠数据库的类型系统兜底。邮箱这类字段先归一化（去空格、转小写）再判断，否则 `Alice@Example.com ` 与 `alice@example.com` 会被当成两个地址，唯一约束也挡不住。

`formKey` 是让表单在成功后重新挂载的钥匙。React 的 `key` 变化会卸载再挂载子树，输入框随之清空。这比手动 `form.reset()` 可靠，后者在受控组件上的行为不一致。

撤销邀请与移除成员用另一种写法。它们由 Server Component 直接渲染成表单，不需要 `useActionState`。

```ts
// src/app/(app)/teams/[slug]/members/actions.ts（续）
export async function revokeInvitation(formData: FormData) {
  const user = await requireUser()
  const team = await getActiveTeam()
  await requireMembership(team.id, user.id)

  const invitationId = String(formData.get('invitationId') ?? '')
  await query(
    `update public.invitations set status = 'revoked'
      where id = $1 and team_id = $2 and status = 'pending'`,
    [invitationId, team.id],
  )

  updateTag(`team:${team.id}:invitations`)
  // redirect 用异常实现，不要包 try
  redirect(`/teams/${team.slug}/members`)
}

export type RemoveResult = { ok: true } | { ok: false; reason: 'not_found' | 'last_owner' }

export async function removeMember(
  slug: string,
  memberUserId: string,
): Promise<RemoveResult> {
  const user = await requireUser()
  const team = await getActiveTeam()
  const membership = await requireMembership(team.id, user.id)
  if (membership.role !== 'owner' && user.id !== memberUserId) {
    return { ok: false, reason: 'not_found' }
  }

  const owners = await query<{ n: number }>(
    `select count(*)::int as n from public.team_members
      where team_id = $1 and role = 'owner'`,
    [team.id],
  )
  if (owners.rows[0].n <= 1) {
    const target = await query<{ role: string }>(
      `select role from public.team_members where team_id = $1 and user_id = $2`,
      [team.id, memberUserId],
    )
    if (target.rowCount > 0 && target.rows[0].role === 'owner') {
      return { ok: false, reason: 'last_owner' }
    }
  }

  const removed = await query(
    `delete from public.team_members where team_id = $1 and user_id = $2`,
    [team.id, memberUserId],
  )
  if (removed.rowCount === 0) return { ok: false, reason: 'not_found' }

  updateTag(`team:${team.id}:members`)
  revalidateTag(`team:${team.id}`, 'max')
  return { ok: true }
}
```

`removeMember` 返回联合类型而不抛异常，因为「只剩最后一个所有者」是用户能理解的业务限制，应该显示成提示。它由客户端组件调用，返回值直接决定界面反馈。

### 审计日志与限流

团队管理类动作都要留痕。谁在什么时候邀请了谁、撤销了哪条邀请，事后要查得到。日志写在同一个 action 里，与业务写入保持顺序关系。

```ts
// src/app/(app)/teams/[slug]/members/actions.ts（片段）
const inserted = await query<{ id: string }>(
  `insert into public.invitations
     (team_id, email, role, token, status, expires_at, invited_by)
   values ($1, $2, $3, $4, 'pending', now() + interval '7 days', $5)
   returning id`,
  [team.id, email, role, crypto.randomUUID(), user.id],
)

await query(
  `insert into public.activity_logs
     (team_id, actor_id, action, target_type, target_id, metadata)
   values ($1, $2, 'invitation.created', 'invitation', $3, $4)`,
  [team.id, user.id, inserted.rows[0].id, { email, role }],
)
```

日志写入失败不该让整个操作失败。管理动作的核心结果是「邀请是否创建成功」，日志是旁路记录。想严格保证，就把两条语句放进一个事务；想宽松处理，就 `catch` 掉日志错误并打日志到服务端。

限流是另一层。邀请接口被脚本刷会迅速消耗邮件额度。

```ts
// src/app/(app)/teams/[slug]/members/actions.ts（片段）
import { rateLimit } from '@/lib/redis'

const allowed = await rateLimit(`invite:${team.id}`, 10, 60)
if (!allowed) {
  return { status: 'error', formKey, formError: '操作太频繁，请一分钟后再试' }
}
```

`rateLimit(key, limit, windowSeconds)` 是项目里已有的封装，底层用 Redis 的计数与过期。放 Redis 而不是进程内存，原因是多实例部署时每个实例各记一份，等于没有限流。

限流放在校验之后、写库之前。放最前面会让非法输入也消耗额度，放进写库后面又拦不住请求。

校验与数据库约束是两道独立防线。校验保证正常路径下不会发出非法数据，约束保证并发与绕过路径下也写不进去。只做校验，两个请求同时通过校验仍可能插两行；只做约束，用户看到的是数据库错误而不是可读提示。两边都要有，错误消息各写各的。

约束报错要用 `code` 判断，不要匹配错误文案。`23505` 是唯一冲突，`23503` 是外键冲突，`23514` 是检查约束失败。文案会随 Postgres 版本与语言设置变化，错误码不会。

---

## 12.4 表单组件：状态、字段错误、pending

```tsx
// src/app/(app)/teams/[slug]/members/invite-form.tsx
'use client'

import { useActionState, useEffect, useRef } from 'react'
import { inviteMember, type InviteState } from './actions'

const initialState: InviteState = { status: 'idle' }

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteMember, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  // 出错后把焦点送回第一个有问题的字段
  useEffect(() => {
    if (state.status !== 'error') return
    const firstField = state.fieldErrors && Object.keys(state.fieldErrors)[0]
    if (firstField) {
      formRef.current
        ?.querySelector<HTMLInputElement>(`[name="${firstField}"]`)
        ?.focus()
    }
  }, [state])

  const error = state.status === 'error' ? state : null

  return (
    <div>
      {error?.formError ? (
        <p role="alert" className="text-red-600">
          {error.formError}
        </p>
      ) : null}
      {state.status === 'success' ? (
        <p role="status" className="text-green-700">
          {state.message}
        </p>
      ) : null}

      {/* key 变化让表单重新挂载，成功后输入框自然清空 */}
      <div key={state.status === 'idle' ? 0 : state.formKey}>
        <form ref={formRef} action={formAction} noValidate>
          <label htmlFor="invite-email">邮箱</label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            defaultValue={error?.values?.email ?? ''}
            aria-invalid={error?.fieldErrors?.email ? true : undefined}
            aria-describedby={
              error?.fieldErrors?.email ? 'invite-email-error' : undefined
            }
          />
          {error?.fieldErrors?.email ? (
            <p id="invite-email-error" className="text-sm text-red-600">
              {error.fieldErrors.email}
            </p>
          ) : null}

          <label htmlFor="invite-role">角色</label>
          <select
            id="invite-role"
            name="role"
            defaultValue={error?.values?.role ?? 'member'}
            aria-invalid={error?.fieldErrors?.role ? true : undefined}
          >
            <option value="member">成员</option>
            <option value="owner">所有者</option>
          </select>
          {error?.fieldErrors?.role ? (
            <p className="text-sm text-red-600">{error.fieldErrors.role}</p>
          ) : null}

          <button type="submit" disabled={pending}>
            {pending ? '发送中…' : '发送邀请'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

几个细节决定了它是否可用。

`useActionState` 的 action 签名必须是 `(prevState, formData)`。把普通 action 直接传进去而不改签名，`prevState.formKey` 是 `undefined`，运行时抛 `Cannot read properties of undefined`。

`noValidate` 关掉浏览器原生校验气泡。不关的话，未通过原生校验的表单不会提交，服务端也就拿不到字段错误，用户会同时看到两套提示。`required` 与 `type="email"` 保留，它们仍提供语义与移动端键盘优化。

输入框用非受控加 `defaultValue`。受控需要在客户端维护每个字段的状态，服务端返回的 `values` 还要额外同步一次；非受控由 React 自己保留节点状态，重挂载时才清空。`defaultValue` 只在节点挂载时读取一次。没有 `key` 时，服务端返回新的 `values` 也不会更新已挂载的输入框，表现为「错误提示出现了，输入框还是空的」。

`disabled={pending}` 只改善观感，不防重复。用户可以在请求发出前连点两次，两次都会发出。真正的防重靠 12.7 讲的数据库约束。

`aria-invalid` 与 `aria-describedby` 把字段错误挂到输入框上，读屏软件能听到「邮箱，输入无效，请输入有效的邮箱地址」。

成功提示用 `role="status"` 直接渲染，不用 toast。toast 需要额外状态、组件与清理，而这里一条常驻文本已经够用；`role="status"` 还会让读屏软件主动播报。

焦点管理容易被忽略。提交失败后输入框在页面中部，用户不知道该改哪一项。把焦点送回第一个出错字段，键盘用户能立刻继续。

### 提交中的编辑与重复提交

提交进行中，用户仍然可以改输入框。这些修改不会进入已经在途的请求，服务端校验的是提交那一刻的值。用户看到「发送中…」又改了邮箱，返回的成功提示指向旧值，容易误以为改后的地址被邀请了。

处理方式有两种。简单做法是提交期间把整个表单设为不可编辑，用 `fieldset disabled={pending}` 包住输入区。更细的做法是记录提交时的值，成功后比较当前值是否变化，变化时提示「已按提交时的地址发送」。

重复提交有两条防线，缺一不可。界面层用 `pending` 禁用按钮，挡住误触。数据层用唯一约束挡住真正并发的写入，因为禁用状态在第一个请求发出前有两三百毫秒的空窗，快速双击能穿过去。

`useFormStatus` 与 `useActionState` 返回的 `pending` 有区别。前者读的是最近的 `form` 的提交状态，只能用在表单子组件里；后者跟着这次 action 的状态走，可以在表单外层使用。同一个页面里嵌套多个表单时，用 `useFormStatus` 才不会串。

---

## 12.5 乐观更新

列表里的删除、移除这类操作，等待往返再更新界面会有明显延迟。`useOptimistic` 提供一个临时本地状态，请求返回后自动回退到服务端数据。

```tsx
// src/app/(app)/teams/[slug]/members/member-list.tsx
'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { removeMember } from './actions'

type Member = {
  userId: string
  name: string
  email: string
  role: 'owner' | 'member'
}

export function MemberList({ members }: { members: Member[] }) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  const [optimisticMembers, removeOptimistic] = useOptimistic(
    members,
    (current: Member[], removedId: string) =>
      current.filter((member) => member.userId !== removedId),
  )

  function onRemove(member: Member) {
    startTransition(async () => {
      removeOptimistic(member.userId)
      const result = await removeMember('current', member.userId)
      if (!result.ok) {
        setFeedback(
          result.reason === 'last_owner'
            ? '团队至少需要保留一个所有者'
            : '这个成员已经不在团队里了',
        )
      }
    })
  }

  return (
    <section aria-busy={isPending}>
      {feedback ? (
        <p role="alert" className="text-red-600">
          {feedback}
        </p>
      ) : null}
      <ul>
        {optimisticMembers.map((member) => (
          <li key={member.userId}>
            <span>{member.name}</span>
            <span>{member.email}</span>
            <span>{member.role === 'owner' ? '所有者' : '成员'}</span>
            <button
              type="button"
              onClick={() => onRemove(member)}
              disabled={isPending}
            >
              移除
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

`useOptimistic` 的第一个参数是服务端传来的真实数据，第二个是 reducer。reducer 只在过渡期间生效；过渡结束、组件拿到新的 props 之后，乐观层消失。

失败时不需要手动回滚。失败路径不调用 `updateTag`，props 保持不变，乐观层结束后那一行自然回到列表里。

`key` 用 `member.userId`，不用数组下标。用下标时删除中间一行会让后面所有行的 key 变化，React 重建节点，输入状态与动画都乱。

`aria-busy` 标注整个列表的忙碌状态，读屏软件会延后播报，避免听到「列表从 5 项变成 4 项」这种无意义更新。

一个容易写错的点：`await` 之后的状态更新不属于这次 transition。关闭对话框、显示成功提示这类操作要包在 `startTransition` 里，否则 React 会在过渡之外调度状态更新，界面可能出现一次多余的闪烁。

表单重置用 `key` 重挂载，不要手动 `reset()`。toast 与埋点这类不影响渲染的副作用放在 `await` 之后直接执行即可。

乐观更新与 `updateTag` 同时发生时，以服务端 props 为准。不要把乐观结果存进 `useState`，那会把两份数据源搞混，出现「明明删了又回来了」。

### 什么时候不该乐观更新

乐观更新适合「结果可预测、失败可撤回」的操作：删除一行、切换开关、修改显示名。这些操作界面上该显示什么，客户端已经知道。

不适合的场景有四类。需要服务端生成数据的操作，比如创建后要拿到数据库分配的编号与创建时间，乐观对象只能先填假值，成功后再换，用户会看到编号跳变。涉及金额与配额的操作，比如付款、扣减席位，乐观显示的「已支付」如果被打回，用户的心理落差比等待更大。依赖服务端排他判断的操作，比如抢座位、抢唯一用户名，结果不由客户端决定。失败代价高的操作，比如删除整个团队，宁可让用户多等一秒，也不要先消失再回来。

判断标准是「失败回滚时，用户会不会以为自己已经做成了」。会，就别乐观。

---

## 12.6 无 JS 与渐进增强

Server Component 里渲染的表单天然可用。它不需要 `useActionState`，也不需要客户端组件；提交时浏览器原生 POST，服务端返回整页 HTML。

```tsx
// src/app/(app)/teams/[slug]/members/invitation-row.tsx
import { revokeInvitation } from './actions'

export function InvitationRow({
  id,
  email,
  expiresAt,
}: {
  id: string
  email: string
  expiresAt: string
}) {
  return (
    <li>
      <span>{email}</span>
      <span>到期 {expiresAt}</span>
      <form action={revokeInvitation}>
        <input type="hidden" name="invitationId" value={id} />
        <SubmitButton label="撤销邀请" pendingLabel="撤销中…" />
      </form>
    </li>
  )
}
```

```tsx
// src/app/(app)/teams/[slug]/members/submit-button.tsx
'use client'

import { useFormStatus } from 'react-dom'

export function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string
  pendingLabel: string
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  )
}
```

`useFormStatus` 必须在 `form` 的子组件里调用。放在渲染 `form` 的同一个组件里，它拿到的永远是 `pending: false`，因为那个组件不是表单的后代。

没有 JS 时，撤销邀请是一次原生 POST，整页刷新后回到列表。有 JS 时，React 拦截提交走 Flight 请求，页面不整页刷新。两种行为的业务结果一致。

原生 POST 之后，服务端通常返回 303 跳转，浏览器按 `Location` 再发一个 GET。这个模式叫 Post/Redirect/Get，目的是让用户刷新页面时不会重复提交。用 action 时框架替你做了这一步，触发点是 `redirect`。

没有调用 `redirect` 时，响应直接就是新页面的 HTML，用户按 F5 会看到浏览器的「重新提交表单」确认框。管理类操作都应该以跳转收尾，避免这个提示。

中间还有一个状态：JS 文件下载中、还没完成 hydration。此时用户点提交，React 19 会把提交排队，等 hydration 完成后重放，不会丢。这个行为只在表单用了 Server Action 时成立。

### 两种组件的差别

Server Component 里渲染的表单不需要客户端 JavaScript 就能工作。它的 `action` 指向服务端函数，浏览器原生提交，服务端返回整页 HTML。代价是整页刷新，滚动位置丢失，表单之外的状态全部重置。

Client Component 里的表单依赖 JS。禁用 JS 时它仍然会提交，但走原生路径；hydration 之前点击，提交被排队。优势是能拿到 `pending`、能做局部更新、能保留滚动位置。

选择标准是交互复杂度。只有提交与错误提示的表单，用 Server Component 加一个 `SubmitButton` 就够。需要实时字段联动、字符计数、富文本编辑的，才引入客户端组件。每多一个客户端组件，首屏 JS 体积就多一块。

三个坑要避开。

`Object.fromEntries(formData)` 会把 React 注入的 `$ACTION_ID_...` 字段一起放进去。需要普通对象时先删掉这些键，或者逐字段 `formData.get()`。

`bind(null, teamId)` 可以预绑定参数，服务端与客户端都能用，也支持渐进增强。预绑定不构成权限检查，函数体里仍然要重新鉴权。

反向代理或 WAF 只放行 GET 时，表现为「有 JS 时正常，关掉 JS 就 403」。因为禁用 JS 后是原生 POST，会被规则拦掉。

客户端组件要调用服务端函数，函数必须来自标了 `'use server'` 的模块。在客户端文件里写 `'use server'` 也合法，但那个模块的导出只能被当作 action 引用，不能再被普通导入调用，混用会在运行时报「只能作为 action 使用」。

---

## 12.7 安全边界

框架提供了一部分防护，剩下的必须自己写。

CSRF 校验：每个 action 请求都会比对 `Origin` 与 `Host`（或 `X-Forwarded-Host`），不一致就拒绝。这是默认行为，不需要配置。反向代理没有透传 host 时会误判，需要显式声明来源。

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 只在反向代理、CDN 改写了 Host 头时才需要
      allowedOrigins: ['app.example.com', 'www.example.com'],
    },
  },
}

export default nextConfig
```

不要无脑加。大多数部署（Vercel、Cloudflare 默认转发）不需要这一项，加了反而放宽校验范围。判断方法是看 `headers().get('host')` 与用户实际访问的域名是否一致，不一致才需要配置。

Nginx 反代可以把头补上，比放宽 `allowedOrigins` 更窄：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
```

请求体上限：action 的请求体默认 1MB，超过时返回纯文本 `Body exceeded 1 MB limit`，函数体不执行。放宽上限改配置：

```ts
// next.config.ts
const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
}
```

更好的做法是换通道。批量导入、文件上传这类需求不该通过 action 传大请求体，应该用直传对象存储或后台任务。把上限调到 20MB 只是把问题推给内存。

### 1MB 实际能装多少文本

表单请求体是 URL 编码的，非 ASCII 字符会膨胀。一个汉字在 UTF-8 里占 3 字节，编码成 `%E4%B8%AD` 之后变成 9 个字符。1MB 的上限按请求体字节算，扣掉字段名与分隔符，纯中文大概只能放三万多个字。

想准一点，在浏览器里手算：打开 Network 面板看 `Content-Length`，或者用 `curl` 发同样的内容看服务端日志。超过上限的表现很干脆：返回纯文本 `Body exceeded 1 MB limit`，函数一行没跑，数据库没有变化。

这条上限也解释了为什么不能把文件塞进 `FormData` 传给 action。一张 2MB 的图片编码后接近 6MB，改上限也过不去，正确做法是客户端直传存储，拿到路径后把路径提交给 action。

action ID 与死代码消除：构建时为每个 Server Function 生成加密的 action ID，没有任何客户端代码引用的函数会从客户端 bundle 里剔除。ID 不可伪造，因为它由构建私钥签名。

闭包变量加密：客户端引用的 action 如果用了闭包变量，这些值加密后随请求发送。加密防篡改，不防读取，也不替代鉴权。

多实例部署必须设置固定的加密密钥：

```bash
openssl rand -base64 32
```

```bash
# .env.production
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=生成的 base64 字符串
```

密钥必须 base64 编码，解码后长度为 16、24 或 32 字节。它在构建时嵌入产物，所有实例必须一致；否则 A 实例生成的 action 在 B 实例上解不开，表现为随机失败。轮换密钥会让所有旧 action 失效，等于要求所有用户刷新页面。

部署后 action ID 会变。Next.js 在每次部署时为 action 生成新 ID，源码没改也可能轮换，最长 14 天一次。旧页面里的 ID 在新部署上找不到：

```
Failed to find Server Action "00a1b2c3...". This request might be from an older or newer version of the app.
```

处理方式是滚动发布加界面兜底：检测到这类错误时提示「页面已更新，请刷新」，不要无限重试。`deploymentId` 配置可以让客户端在版本不一致时触发整页刷新：

```ts
// next.config.ts
const nextConfig: NextConfig = {
  deploymentId: process.env.DEPLOYMENT_ID,
}
```

滚动发布能进一步缩短窗口。做法是先把新版本部署到一小部分实例，再逐步替换，旧实例继续接受旧 ID 的请求。代价是同一个窗口内两套代码同时在跑，缓存与数据库迁移必须双向兼容。对大多数项目，界面提示刷新已经够用，滚动发布属于加分项。

认证与授权仍然自己做。页面不渲染按钮不构成权限控制，函数体里必须重新 `requireUser()` 与 `requireMembership()`。危险操作在写库前再查一次权限，不要只在入口查一次。

返回值只给界面需要的东西。`removeMember` 返回 `{ ok, reason }`，不返回整行数据，避免把不该暴露的字段带到客户端。

---

## 12.8 边界与失败模式

请求体超限时，框架在解析前就拒绝，函数体未执行。日志里能看到请求大小，看不到业务 SQL，说明请求没进到函数。

不匹配的 Origin 会得到 `Invalid Server Actions request` 或 403。排查顺序：先看请求头里的 `Origin` 与 `Host` 是否一致，再看反代是否改写，最后才考虑配 `allowedOrigins`。

多实例密钥不一致表现为随机失败。同一个用户的两次提交，一次成功一次报 `Failed to find Server Action`，因为负载均衡把请求分到了不同实例。看到这种偶发问题，优先查环境变量。

action ID 轮换导致的失败集中在部署窗口。用户开着旧页面，部署完成后点提交就会遇到。滚动发布能缩短窗口，不能消除；界面必须有刷新提示。

客户端串行派发意味着长 action 会阻塞同一页面的后续 action。一个跑十秒的导入任务会让「返回列表」按钮没反应。长任务应该转成后台 job，action 只负责建任务并返回。

`redirect()` 被 `try` 包住会失效。`catch` 吞掉控制流异常，页面不跳转，表现为「提交成功但没反应」。确认 `redirect` 不在任何 `try` 块内。

`useActionState` 的初始 state 与 action 返回的 state 必须同形状。返回 `undefined` 会让组件在下一次渲染时读到 `state.status` 为 `undefined`，界面直接崩。

表单字段漏写 `name` 时值不会出现在 `FormData` 里，服务端读到空字符串，校验层报「请输入邮箱」。这类问题在 `select` 上最常见，因为它平时不参与提交。

`crypto.randomUUID()` 在非安全上下文（`http://` 且非 localhost）里不可用。本地开发用 localhost 不受影响，局域网 IP 访问时会抛 `crypto.randomUUID is not a function`，改用 `crypto.getRandomValues` 自己拼。

函数超时是另一类故障。action 跑得比平台允许的时间长，请求被中断，客户端可能收到一个没有响应体的失败，重试又超时。判断线索在服务端日志：函数开始执行了，没有结束记录。处理办法是把耗时工作拆出去，action 只写一条 `jobs` 记录就返回，后台任务接着跑。平台的具体超时数字随套餐与部署方式变化，本书不写死，标「未验证」。

在 action 里写 cookie 会触发整页重渲染，包括布局。这既是特性也是坑：只是想记住一个偏好，结果整个页面重新渲染一次，滚动位置可能被重置。只需要记录偏好时，把 cookie 写入放到路由处理器或者客户端 `document.cookie`，别让一次表单提交带上整页刷新。

`redirect()` 之后没有代码会执行。有人习惯在 `redirect` 后面再写一句 `updateTag`，那句永远不会跑，用户跳到列表页看到的还是旧数据。顺序永远是先失效缓存，再 `redirect`。

---

## 12.9 检查点

**1. 关掉 JS 也能提交**

浏览器设置里禁用 JavaScript，或者用 `curl` 直接发原生表单：

```bash
curl -i -X POST http://localhost:3000/teams/acme/members \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'invitationId=cccccccc-cccc-4ccc-8ccc-cccccccccccc'
```

预期得到 303 或 200 加一页 HTML，数据库里对应邀请变成 `revoked`。这一步验证的是原生 POST 路径，与 action 本身无关。若返回 403，检查反向代理是否只放行 GET。`curl` 不带 cookie 时可能被中间件重定向到登录页，先确认会话存在；也可以绕过界面直接用 psql 验证数据库里的状态。

2. 空值与脏值被拒，数据库没有新行

在成员页提交空邮箱、`not-an-email`、`19,99` 这类值。预期表单显示字段级红字，输入内容保留，`invitations` 表行数不变。

```sql
select count(*) from public.invitations
where team_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
```

提交前后数字应相同。

**3. 连点只写一行**

邀请一个全新邮箱，在按钮上快速点五次。预期只插入一行 `pending` 邀请，其余请求返回「已经有一封待处理的邀请」。

```sql
select count(*) from public.invitations
where team_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and status = 'pending';
```

这条依赖数据库的部分唯一索引。把索引删掉再试，会看到五行「邀请已发送」，说明前端防重不可靠。

**4. 三类错误的落点不同**

字段错误（空邮箱）留在表单里，页面不动。业务错误（非所有者提交、席位已满）显示在表单顶部，页面不跳。系统错误（临时把数据库停掉再提交）由 `error.tsx` 接住，页面显示错误编号，恢复后点「重试」回到正常。

5. 多实例密钥一致性与部署后 action ID 变化

本机只有一个实例，需要两个容器或两台机器才能验证，标「未验证」。推演过程：不设 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 时每次构建生成新密钥，多个实例之间不共享；设置固定值后所有实例一致。部署新版本后，旧页面提交应出现 `Failed to find Server Action`，界面提示刷新。

6. 审计日志与限流都在生效

邀请一次成功后查审计表：

```sql
select action, target_type, metadata
from public.activity_logs
where team_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
order by created_at desc
limit 3;
```

预期最后一条的 `action` 是 `invitation.created`，`metadata` 里有邮箱与角色。再连续提交十一次，第十一次应返回「操作太频繁」，数据库没有新增邀请。这两条都要 Redis 在跑，未起 Redis 时标「未验证」。

---

## 12.10 常见错误

`Body exceeded 1 MB limit`

请求体超过 1MB。action 没有执行，数据库没有变化。先用浏览器 Network 面板确认请求大小，再决定压缩字段、改走直传，还是调整 `serverActions.bodySizeLimit`。不要为了让大表单通过而把上限调到几十 MB。

`Invalid Server Actions request`

Origin 与 Host 不匹配。检查反向代理是否改写了 `Host` 头，必要时补 `proxy_set_header`，或者在 `serverActions.allowedOrigins` 里声明实际域名。本地开发时确认访问的是 `localhost`，不要在 `localhost` 与 `127.0.0.1` 之间混用。

`Failed to find Server Action "..."`

构建后的 action 在当前部署里不存在。原因有两个：部署了新版本而旧页面还在用旧 ID；或者多实例密钥不一致，请求落到了另一个实例。前者提示用户刷新，后者检查 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 是否所有实例一致。

`Cannot read properties of undefined (reading 'formKey')`

`useActionState` 的 action 签名没改成 `(prevState, formData)`，或者初始 state 传了 `undefined`。前者的表现是首次提交就崩，后者是提交完成后崩。

`Uncaught Error: NEXT_REDIRECT`

`redirect()` 被 `try` 包住。控制流异常被 `catch` 拦截，页面不跳转，控制台打出这个错误。把 `redirect` 移出 `try`，或者在 `catch` 里用 `unstable_rethrow` 重新抛出。

`A form field element should have an id or name attribute`

表单里有输入框既没有 `id` 也没有 `name`。没有 `name` 的字段不会进入 `FormData`，服务端读到空值。给每个需要提交的字段补上 `name`，`label` 的 `htmlFor` 指向 `id`。

---

## 12.11 这一章在做什么

这一章把「写」拆成三段：传输、校验、反馈。

传输靠 Server Function。表单直接引用服务端函数，有 JS 时走 Flight 请求，没有 JS 时退化成原生 POST。校验放在服务端函数里，客户端校验只做即时反馈。反馈分成三种形状：字段错误留在表单，业务错误升到表单顶部，系统错误交给错误边界。

三条规则值得记住。函数体里必须重新鉴权，闭包里的身份是渲染那一刻的快照。防重复提交靠数据库约束，按钮禁用只改善观感。错误按「用户能否自己修正」分类，不要把全部失败都抛异常，也不要把全部失败都返回 200。

状态码不是装饰。字段错误与业务错误返回 200，因为请求本身被正确处理了，只是结果不符合预期。系统错误返回 500，因为请求没被正确处理，监控与告警应该看到它。把系统错误也返回 200，出事时日志里一片正常。

安全边界上，框架给了 Origin 校验、请求体上限、action ID 签名与闭包加密。需要自己负责的是权限检查、输入校验、返回值最小化，以及多实例部署时固定 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`。

这一章没有展开的两件事。一是缓存失效的完整模型，`updateTag`、`revalidateTag`、`revalidatePath` 各自的代价与边界在第 14 章。二是并发冲突的诊断，错误码 `23505`、`40001`、`40P01` 分别对应什么场景，在第 10 章。本章出现的这些调用先用直觉理解：改完自己要看，用 `updateTag`；别人晚点看到没关系，用 `revalidateTag`。

下一章处理列表与批量操作：翻页怎么在持续写入的表上不重不漏，批量删除怎么把「哪几条失败、为什么」讲清楚。
