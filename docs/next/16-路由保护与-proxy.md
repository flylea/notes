# 第 16 章 路由保护与 proxy

这一章讲请求进入页面之前的那一层：`proxy.ts`。它决定一个请求要不要继续往下走，能重定向、能改写、能直接返回响应。

需要它的原因是页面本身太晚。用户打开 `/dashboard`，服务端组件开始执行，读会话、查数据，这才发现没登录，于是跳转。中间这一段白做了，首屏还会闪一下。proxy 在更早的位置拦下来，省掉后面所有工作。

涉及三个概念。路由保护是“未登录不让进”，粒度可以是全局、路由组或单个资源。会话检查与授权检查是两件事，前者看有没有会话，后者看这个人能不能看这条数据。`matcher` 决定 proxy 对哪些路径生效，写错会让静态资源也被拦。

这一章先给最小可用的实现，再讲三种粒度、请求管道的顺序、不能查库的原因、跳转落点与开放重定向、CSRF 与 CORS 的区别，最后是 Server Action 的自保写法。

## 16.1 proxy 的职责边界

Next.js 16 把 `middleware.ts` 改名为 `proxy.ts`，导出函数从 `middleware` 改成 `proxy`。功能没有变化，改名的原因是这个名字更准确：它在反向代理层运行，做的是请求转发前的判断。

它能做四件事：重定向到登录页、改写 URL、设置响应头、直接返回一个响应（比如维护页）。这四件事都在请求到达路由之前完成。

它不能做三件事：查数据库、做复杂授权、当会话管理方案。原因在 16.5 节展开。

官方文档对它的定位写得很清楚：proxy 适合做乐观检查，真正的授权检查应该放在数据源附近。第 17 章的 RLS 是数据源那一层，这一章的 proxy 是门口那层。

## 16.2 一个能跑的最小实现

三件事：定义哪些路径受保护、在 proxy 里判断、配置 matcher。

路径清单单独放一个文件，方便复用和测试。

```ts
// src/lib/routes.ts
const PROTECTED_PREFIXES = ['/dashboard', '/t', '/settings'] as const
const AUTH_PAGES = ['/login', '/signup', '/forgot-password'] as const

export function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((p) => pathname === p)
}
```


会话刷新封装在另一个文件里，返回新的响应和用户。

```ts
// src/lib/supabase/proxy.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data } = await supabase.auth.getClaims()
  return { response, user: data?.claims ?? null }
}
```


proxy 本体只做一件事：没有用户且路径受保护，跳登录页。跳转时要把新会话 cookie 复制到重定向响应上，否则这一次刷新的 token 会丢。

```ts
// src/proxy.ts
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { isAuthPage, isProtected } from '@/lib/routes'

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname, search } = request.nextUrl

  if (!user && isProtected(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = `?next=${encodeURIComponent(pathname + search)}`

    const redirect = NextResponse.redirect(url)
    // 续期写下的新 cookie 必须落到跳转响应上
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  if (user && isAuthPage(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
```


`matcher` 不能省。不写 matcher 时，proxy 对每个请求执行，包括 `_next/static`、`_next/image`、`public` 下的文件。CSS 和 JS 请求被重定向到登录页，页面拿到的是 HTML，浏览器报 `Uncaught SyntaxError: Unexpected token '<'`。诊断方法：

```bash
curl -i -s http://localhost:3000/t/acme/billing | head -20
```


返回 307 说明 matcher 把静态资源也匹配进去了，正常情况应当是 200。

## 16.3 从 middleware.ts 迁移

五个步骤，顺序不能换。

第一，文件改名。项目根或 `src/` 下的 `middleware.ts` 改成 `proxy.ts`，全项目只能有一个。

第二，导出改名。`export function middleware()` 改成 `export function proxy()`，或者 `export default function proxy()`。两种都行，不要同时写。

第三，删除 runtime 配置。`export const config = { runtime: 'edge' }` 在 proxy 里会直接导致构建失败：

```ts
// 构建直接失败
export const config = { runtime: 'edge' }
```


proxy 只能跑 Node.js runtime，没有 edge 选项。官方文档的原话是：`runtime` 段配置在 proxy 文件里不可用。

第四，检查 `config.matcher`。写法不变，但值必须是常量。用变量拼 matcher 会被构建期静态分析忽略，表现为“规则没生效，但没有任何报错”。

```ts
// 静默失效
const paths = ['/dashboard/:path*', '/t/:path*']
export const config = { matcher: paths }
```


第五，确认没有在 proxy 里用 `use cache`、`use server` 或 fetch 的缓存选项。proxy 里不应用这些指令的编译转换，写了等于没写。

旧名字 `middleware.ts` 仍然可用，只是废弃。只有在依赖 Edge runtime 的项目里才需要保留它。

```ts
// 旧写法，Next.js 16 里已废弃
export function middleware(request: NextRequest) { ... }
```


## 16.4 matcher 的写法

matcher 是一个路径数组，支持两种形式的元素：字符串和对象。

字符串形式支持两种语法：以 `/` 开头的绝对路径，和带参数的路径。`/dashboard/:path*` 匹配 `/dashboard` 及其所有子路径。`/((?!api|_next).*)` 这种正则形式用来做排除。

对象形式多三个字段：`source`、`has`、`missing`。`has` 用来匹配请求头或查询参数，`missing` 反过来。

排除静态资源的标准写法：

```ts
// src/proxy.ts
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

这条正则的意思是：不以 `_next/static`、`_next/image`、`favicon.ico` 开头，且不以常见图片后缀结尾的路径。

验证一条正则是否命中某条路径，用 Node 直接跑：

```bash
node -e "const re=/^\/((?!_next\/static|_next\/image|favicon\.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)$/; for (const p of ['/','/dashboard','/_next/static/chunks/main-app.js','/logo.png','/api/health']) console.log(re.test(p)?'match':'skip ', p)"
```


五个路径的输出应该是：`/dashboard true`、`/_next/static/chunk.js false`、`/logo.png false`、`/t/acme/billing true`、`/api/health true`。

最后一条要处理。API 路由通常不需要登录页重定向，用 `has` 或另写一条 matcher 排除。

排除预取请求也是一个技巧。带 `next-router-prefetch` 头的请求是预取，不需要跳转：

```ts
// src/proxy.ts，临时
console.log('[proxy]', new Date().toISOString(), request.nextUrl.pathname)
```


## 16.5 三种保护粒度

粒度决定代码放在哪，三种都常用。

全局保护：所有页面都要登录。matcher 匹配全部路径，受保护清单写 `["/"]`。适合纯后台应用，连落地页都在登录之后。

路由组保护：一部分页面要登录，另一部分公开。用 `(app)` 路由组把受保护的页面放一起，matcher 只匹配这些路径。路由组不出现在 URL 里，`app/(app)/dashboard/page.tsx` 对应 `/dashboard`。

资源级保护：进入页面后还要判断“这个人能不能看这个团队”。这一层不能放 proxy，因为它需要查成员表。放在页面或数据函数里，用 `requireMembership()`。

三种粒度的分工：全局粒度让未登录的人看不到任何后台页面，路由组粒度让公开页可以访问，资源级粒度让 A 团队的人看不到 B 团队的数据。

## 16.6 proxy 在请求管道里的位置

一次请求进入 Next.js 之后，依次经过八个阶段：

1. `headers` 配置（`next.config.ts`）
2. `redirects` 配置
3. proxy
4. `beforeFiles` rewrites
5. 文件系统路由
6. `afterFiles` rewrites
7. 动态路由
8. `fallback` rewrites

proxy 排第三。它之前只有配置文件里的静态规则，之后才是路由匹配。

这个顺序决定两件事。第一，`next.config.ts` 里的 redirects 比 proxy 先执行，纯静态的旧地址跳转放那里更合适。第二，proxy 里执行 `redirect()` 之后，后面的阶段都不再执行，所以别在 proxy 里做“先重定向再判断”的写法。

还有一条容易忽略：Server Action 没有独立路由，它是 POST 到使用它的那个页面路径。matcher 排除了某个路径，也同时跳过了那个页面上的 Server Action 保护。

结论是 Server Action 必须自己校验身份。proxy 覆盖不到每一个 action 调用点。

## 16.7 为什么不在 proxy 里查库

五个理由，每个都够单独构成一条限制。

第一，proxy 在每个请求上执行，包括预取。一个页面有十个链接，鼠标划过就产生十个预取请求，每个都查一次库。日志里能直接看到这种放大：

```bash
curl -s http://localhost:3000/t/acme/billing | grep -c 'invoice'
```


第二，proxy 执行在 TTFB 之前。这里多一次 50 毫秒的查询，所有页面的首字节都慢 50 毫秒。

第三，proxy 拿不到足够的上下文。判断“能不能看这个团队”需要团队 id、成员表、角色，proxy 只有路径。

第四，proxy 挡不住直接调用。Server Action 可以被 curl 直接 POST，Route Handler 可以被直接请求，这些都不经过页面导航。

第五，proxy 的失败会影响全站。一段查询超时，所有页面一起挂。页面层的失败只影响一个页面。

正确的分工是：proxy 只读 cookie 判断有没有会话，页面和数据函数查库判断权限。

```tsx
// src/app/(app)/t/[slug]/billing/page.tsx
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { requireMembership } from '@/lib/teams'

export default async function BillingPage(props: PageProps<'/(app)/t/[slug]/billing'>) {
  const user = await requireUser()
  const { slug } = await props.params
  const { team, role } = await requireMembership(slug, user.id)

  if (role !== 'owner') notFound()

  const subscription = await getSubscription(team.id)
  return <BillingView subscription={subscription} />
}
```


权限不足时用 `notFound()` 而不是返回 403 页面，这是刻意的选择：不告诉对方这个资源存在但你看不到。如果确实要让对方知道是被拒绝而不是不存在，16.4 提供了实验性的 `forbidden()` 配合 `forbidden.tsx`，细节在第 6 章 6.1.1 节，开启配置位才可用。

## 16.8 跳转落点与 next 参数

未登录访问 `/t/acme/billing?tab=usage`，跳登录页时要记住原地址，登录后回去。

参数名用 `next`，值是完整的路径加查询串，需要 `encodeURIComponent`。

```ts
url.search = `?next=${encodeURIComponent(pathname + search)}`
```


登录页拿这个参数做两件事：显示提示、提交时带上。

```tsx
// src/app/(auth)/login/page.tsx
export default async function LoginPage(props: PageProps<'/(auth)/login'>) {
  const { next } = await props.searchParams
  const target = safeNext(typeof next === 'string' ? next : undefined)
  return <LoginForm next={target} />
}
```

```ts
// src/app/(auth)/login/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safe-redirect'

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  const next = safeNext(String(formData.get('next') ?? ''))

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: '邮箱或密码不对' }

  redirect(next)
}
```


`next` 是用户可控的，必须校验。只允许站内相对路径，且排除 `//evil.com` 和 `/\evil.com` 这两种以斜杠开头的写法。

```ts
// src/lib/safe-redirect.ts
const FALLBACK = '/dashboard'

export function safeNext(raw: string | undefined | null): string {
  if (!raw) return FALLBACK

  // 只接受站内绝对路径：必须单个 / 开头
  if (!raw.startsWith('/') || raw.startsWith('//')) return FALLBACK
  // 反斜杠有的浏览器当斜杠处理
  if (raw.includes('\\')) return FALLBACK

  let url: URL
  try {
    // 用固定基准解析，才能判断它有没有跑出站外
    url = new URL(raw, 'https://internal.invalid')
  } catch {
    return FALLBACK
  }

  if (url.origin !== 'https://internal.invalid') return FALLBACK
  return `${url.pathname}${url.search}${url.hash}`
}
```


`//evil.com` 在浏览器里被解析成 protocol-relative URL，跳出去就是外站。`/\evil.com` 在部分浏览器里等价于 `//evil.com`。

`redirect()` 返回 307，语义是临时跳转。旧地址永久搬家、希望搜索引擎把权重迁过去时，用 `permanentRedirect()`，它返回 308。308 会被浏览器和爬虫长期记住，写错之后很难撤回，验证阶段先用 307。

## 16.9 开放重定向

开放重定向是指攻击者构造一个你的域名链接，跳转目标是外站。危害是钓鱼：`https://teamstack.app/login?next=https://evil.com` 看起来像你的站，用户登录后去了假站。

两种常见写法都有洞。

第一种：`new URL(next, request.url)`。`next` 是绝对地址时，`new URL` 返回外站地址。

第二种：`request.url + next`。`next` 写成 `@evil.com`，拼出来是 `https://teamstack.app@evil.com`，浏览器把 `@` 前面当用户名，实际目标是 `evil.com`。

正确写法是解析之后比较 origin：

```ts
// src/lib/safe-redirect.ts
const FALLBACK = '/dashboard'

export function safeNext(raw: string | undefined | null): string {
  if (!raw) return FALLBACK

  // 只接受站内绝对路径：必须单个 / 开头
  if (!raw.startsWith('/') || raw.startsWith('//')) return FALLBACK
  // 反斜杠有的浏览器当斜杠处理
  if (raw.includes('\\')) return FALLBACK

  let url: URL
  try {
    // 用固定基准解析，才能判断它有没有跑出站外
    url = new URL(raw, 'https://internal.invalid')
  } catch {
    return FALLBACK
  }

  if (url.origin !== 'https://internal.invalid') return FALLBACK
  return `${url.pathname}${url.search}${url.hash}`
}
```


判定逻辑只有一条：解析出来的 URL，origin 必须等于当前站点的 origin。相等才跳，否则回默认页。

## 16.10 受保护路径的判断细节

`isProtected` 写错会产生两类问题：漏保护（`/dashboardX` 被当成 `/dashboard` 的子路径），过度保护（`/dashboard` 的规则把 `/dashboard-public` 也拦了）。

正确的判断是“等于，或者以路径加斜杠开头”：

```ts
// src/lib/routes.ts（片段）
export function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}
```

`startsWith('/dashboard')` 会把 `/dashboard-public` 也匹配进去，这是误伤。`startsWith('/dashboard/')` 会漏掉 `/dashboard` 本身，这是漏保护。两种写法都出过事故。

## 16.11 重定向时带上新 cookie

proxy 里刷新会话之后，响应上有一组新 cookie。如果紧接着重定向，新 cookie 必须复制到重定向响应上。

```ts
const url = request.nextUrl.clone()
url.pathname = '/login'
url.search = `?next=${encodeURIComponent(pathname + search)}`
return NextResponse.redirect(url)
```


漏掉的后果是“登录成功的那次跳转把 token 丢了”，用户回到登录页，再点一次登录才进去。

这个问题在开发环境不容易复现，因为 token 往往还没到刷新阈值。生产环境里表现为“偶发登录失败”。

## 16.12 Server Action 自己保命

每一个 Server Action 都是一条公开的 HTTP 接口。它可以被 curl 直接调用，参数可以被任意构造。

所以每个 action 的固定结构是五步：取用户、校验入参、判断权限、执行、写审计。

```ts
// src/app/(app)/t/[slug]/billing/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { requireMembership } from '@/lib/teams'
import { createClient } from '@/lib/supabase/server'
import { writeAudit } from '@/lib/audit'

const schema = z.object({ teamId: z.uuid() })

export async function cancelSubscription(formData: FormData) {
  const user = await requireUser() // 1. 谁在调
  const parsed = schema.safeParse({ teamId: formData.get('teamId') })
  if (!parsed.success) return { error: '参数不对' } // 2. 入参可不可信

  const { team, role } = await requireMembership(user.id, parsed.data.teamId) // 3. 角色校验
  if (role !== 'owner') return { error: '只有 owner 能取消订阅' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'canceled' })
    .eq('team_id', team.id)
  if (error) return { error: '取消失败，请稍后再试' }

  await writeAudit({ teamId: team.id, actorId: user.id, action: 'subscription.canceled' })
  revalidatePath(`/t/${parsed.data.teamId}/billing`)
  return { ok: '已取消，服务持续到当前周期结束' }
}
```


顺序不能换。先判断权限再校验入参，会让攻击者用非法参数探测权限边界。先执行再写审计，中间失败就没有记录。

zod 校验入参是第二步，必须做。`safeParse` 返回的错误要转换成用户能看懂的文案，不要直接抛。

## 16.13 CSRF 与 CORS 的区别

两个概念经常被混，它们防的东西不同。

CSRF 是“别的站让用户的浏览器带着 cookie 发请求”。防线是 `SameSite` cookie 和 CSRF token 校验。

CORS 是“别的站的脚本读取你的响应”。防线是响应头 `Access-Control-Allow-Origin`。

关键区别：CORS 限制的是“读”这一侧。一个跨站表单 POST 可以发出去，服务器也处理了，只是响应读不到。所以配 CORS 不能防 CSRF。

teamstack 的接口只在同源下使用，CORS 保持默认（不返回跨域头）。需要给第三方用的 API 单独开，并回填 Origin，同时加 `Vary: Origin`，否则 CDN 会缓存错。

## 16.14 proxy 适合做的五件事

除了登录重定向，它还有几个合适的用法。

维护模式：全局返回 503 加提示页。用 rewrite 加 status，状态码才正确。

```ts
// src/proxy.ts（维护模式片段）
const MAINTENANCE = process.env.MAINTENANCE === "true";
if (MAINTENANCE) {
  return NextResponse.rewrite(new URL("/maintenance", request.url), { status: 503 });
}
```

旧地址 301：历史链接迁移，让搜索引擎更新索引。

A/B 灰度：按 cookie 或随机数把用户分到两个版本，rewrite 到不同路径。

加安全响应头：CSP nonce、`X-Frame-Options` 这类每请求变化的值。

不合适的用法：按团队 slug 查库判断权限、做计费检查、做内容个性化。

## 16.15 反向代理之后 request.url 会变

自托管时应用在 Nginx 后面，`request.url` 的 host 是内网地址。用它拼重定向地址，用户会被跳到 `http://0.0.0.0:3000`。

解决办法是读 `x-forwarded-host` 和 `x-forwarded-proto`，或者统一用环境变量拼站点地址。后者更稳，因为代理配置可能变。

```ts
// 用固定站点地址拼重定向
const loginUrl = new URL("/login", process.env.NEXT_PUBLIC_SITE_URL);
```

还有一条：别信任客户端发来的 `x-forwarded-host`。它可能被伪造，用来构造钓鱼链接。只有在确定代理会覆盖这个头时才用它。

## 16.16 调试 proxy 的三个手段

第一，临时加响应头，确认 proxy 有没有执行。

```ts
// 临时加在 return response 之前
response.headers.set('x-proxy-hit', '1')
response.headers.set('x-proxy-user', user ? 'yes' : 'no')
```


第二，用 curl 看状态码和跳转地址。

```bash
curl -i -s http://localhost:3000/ | head -3           # 200
curl -i -s http://localhost:3000/dashboard | head -3  # 307
curl -i -s http://localhost:3000/_next/static/x.js | head -3  # 不能是 307
```


第三，二分法。先注释掉全部逻辑，确认 proxy 本身在执行；再逐条加回规则，看哪一条改变了行为。

别用 `console.log` 打 `/dashboard` 的每个请求，预取会让日志刷屏，真正的问题反而看不见。

## 16.17 用脚本固化断言

检查点里的几条可以写成脚本，每次改动之后跑一次。

```bash
# scripts/check-guards.sh
# 未验证：需要本地 dev server 已启动
set -uo pipefail
BASE=${BASE:-http://localhost:3000}
fail=0

check() {
  local path="$1" want="$2"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")
  if [ "$code" != "$want" ]; then
    echo "FAIL  $path  期望 $want  实际 $code"
    fail=1
  else
    echo "ok    $path  $code"
  fi
}

check /                      200
check /login                 200
check /dashboard             307
check /t/acme/billing        307
check /t/acme/billing?tab=1  307
check /_next/static/chunks/main.js 200

exit $fail
```


脚本的退出码就是结论：0 表示全部通过，1 表示有失败。写进 CI 之后，proxy 改动就不容易回归。

## 16.18 多域名与子域名路由

一个应用服务多个域名时，proxy 是唯一能按 host 分流的地方。

常见形态是子域名对应团队：`acme.teamstack.app` 直通 `/t/acme`。实现是读 `request.headers.get("host")`，取出子域，rewrite 到对应路径。

```ts
// src/proxy.ts（子域名重写片段）
const host = request.headers.get("host") ?? "";
const sub = host.split(".")[0];
if (sub && sub !== "www" && sub !== "app") {
  const url = request.nextUrl.clone();
  url.pathname = `/t/${sub}${url.pathname}`;
  return NextResponse.rewrite(url);
}
```

三个边界。第一，本地开发没有子域名，这套逻辑要跳过。第二，预览部署的域名是随机的，别把预览域名当团队名。第三，子域名可能被占用，创建团队时要校验保留字。

主域与子域共享会话时，cookie 的 `Domain` 要设成 `.teamstack.app`，否则每个子域各有一套登录状态。

## 16.19 维护模式的实现

维护模式要满足三个条件：全站返回 503、带 `Retry-After`、静态资源仍然可访问。

第三个条件容易被忘。维护页本身需要 CSS 和 JS，如果 matcher 把这些也拦了，页面就是白底黑字。

实现方式是先判断维护开关，再判断路径。

```ts
// src/proxy.ts（维护模式）
if (process.env.MAINTENANCE === "true" && !request.nextUrl.pathname.startsWith("/_next")) {
  return NextResponse.rewrite(new URL("/maintenance", request.url), {
    status: 503,
    headers: { "Retry-After": "3600" },
  });
}
```

用 `rewrite` 加 `status`，不要用 `redirect`。`redirect` 会返回 307，搜索引擎会把维护页当成永久跳转。

`/maintenance` 本身要放行，否则会无限重写。判断路径时把这条加上白名单。

## 16.20 灰度发布与 A/B 测试

proxy 可以做最简单的灰度：按 cookie 分桶，把一部分用户 rewrite 到新版本。

```ts
// src/proxy.ts（灰度片段）
const bucket = request.cookies.get("ab_bucket")?.value;
if (!bucket) {
  const v = Math.random() < 0.1 ? "b" : "a";
  const url = request.nextUrl.clone();
  const res = NextResponse.rewrite(new URL(`/v2${url.pathname}`, request.url));
  res.cookies.set("ab_bucket", v, { maxAge: 60 * 60 * 24 * 30 });
  return res;
}
```

边界有三条。第一，`Math.random()` 会让同一个用户在刷新后换组，除非像上面这样把结果写进 cookie。第二，SEO 会看到两个版本，需要 canonical 或 `noindex`。第三，灰度期间两个版本共用数据库结构，改动必须向后兼容。

更严谨的分桶用用户 id 哈希，保证跨设备一致。`team_id` 是更好的分桶键，因为同团队的人看到的版本应该一样。

## 16.21 proxy 的性能预算

proxy 跑在每个请求上，它的耗时直接加在 TTFB 上。

预算参考：冷启动之后，一次简单的 proxy 执行在 1–5 毫秒。读 cookie、解析 URL、比较字符串，都是微秒级。超过 10 毫秒通常是做了额外的网络请求。

三条限制。不要在 proxy 里 `fetch` 外部服务，一次 100 毫秒的调用会让所有页面的首字节都慢 100 毫秒。不要在 proxy 里做正则回溯，复杂正则在大路径上会退化成线性。不要在 proxy 里读大文件。

需要缓存的数据提前放进环境变量或内存，Node runtime 下模块级变量在实例存活期间有效。

## 16.22 本地怎么测 proxy

三种方式，覆盖不同层次。

第一，curl 打真实路径，看状态码和 `Location`。

```bash
curl -i -s http://localhost:3000/t/acme/billing | head -5
```

第二，把路径判断抽成纯函数，用 Node 直接跑。`isProtected` 和 `safeNext` 都不依赖请求上下文，可以单测。

```bash
node -e "const {isProtected}=require('./dist/routes.js'); console.log(isProtected('/dashboard'))"
```

第三，用 `next start` 起生产构建再测。`next dev` 下 proxy 的行为与生产一致，但静态资源路径不同，容易漏掉 matcher 的问题。

## 16.23 proxy 抛异常之后

proxy 里抛出的异常会变成 500，整个站点不可用。

所以 proxy 的主体要包一层 `try/catch`。捕获之后有两个选择：放行，或者跳错误页。

放行的风险是保护失效，跳错误页的风险是全站不可用。多数产品选择放行，同时打日志和告警，因为保护还有页面层和 RLS 兜底。

```ts
// src/proxy.ts（兜底）
try {
  return await updateSession(request);
} catch (error) {
  console.error("proxy failed", error);
  return NextResponse.next();
}
```

审计日志里要记录这种放行。它是“保护降级”的信号，出现频率高了说明有 bug。

## 16.24 路径规范化与绕过

用路径前缀做保护，要先想清楚路径会不会变形成你不认识的样子。

三种变形要注意。第一，`..` 穿越：`/dashboard/../public` 在规范化之后落在 `/public`。第二，编码：`%2e%2e` 等价于 `..`。第三，大小写与尾斜杠：`/Dashboard` 和 `/dashboard/` 是否同一个路径，取决于路由匹配规则。

Node 的 `request.nextUrl.pathname` 已经做过一次规范化，多数穿越会被处理掉。但 matcher 用的是原始 URL，两者可能不一致。

稳妥的做法是保护逻辑用 `nextUrl.pathname`，不要用 `request.url` 自己解析。

尾斜杠要统一。`trailingSlash: true` 时 `/dashboard` 和 `/dashboard/` 是两条路径，保护清单要同时覆盖。

## 16.25 静态导出下没有 proxy

`output: "export"` 生成纯静态文件，没有 Node.js 服务端。proxy 在这个模式下不生效。

需要登录保护的产品不能用静态导出，因为它没有运行时代码。唯一的例外是把保护放在 CDN 层，用边缘函数实现，那是另一套东西。

自托管用 `output: "standalone"`，proxy 正常工作。Vercel 上也正常工作。判断方式：`next build` 的输出里如果有 `ƒ` 路由，说明有服务端。

## 16.26 重定向能不能缓存

浏览器会缓存 301 和 308，不会缓存 307 和 302。

登录跳转必须用 307 或 302。用 301 的话，浏览器会记住“这个地址永久跳到登录页”，用户登录之后仍然被跳走。

`NextResponse.redirect` 默认 307。要改状态码显式传第二个参数：

```ts
// 307：临时跳转，不缓存
return NextResponse.redirect(url, 307);
```

CDN 层的缓存另说。Vercel 不会缓存带 `Set-Cookie` 的响应，这类跳转响应通常都带 cookie，所以不会被缓存。

## 16.27 请求头在组件里怎么读

proxy 可以改请求头，改过的头在服务端组件里用 `await headers()` 读到。

```ts
// src/proxy.ts（写入请求头）
const requestHeaders = new Headers(request.headers);
requestHeaders.set("x-team-slug", slug);
return NextResponse.next({ request: { headers: requestHeaders } });
```

```tsx
// src/app/(app)/t/[slug]/layout.tsx
import { headers } from "next/headers";
const slug = (await headers()).get("x-team-slug");
```

注意两点。写响应头用 `response.headers.set`，写请求头用上面这种构造新请求的方式，两者不能混。读的时候必须 `await`，16.x 起 `headers()` 是异步的。

客户端组件读不到这些头，它们只存在于请求链路里。要给浏览器用，得写成响应头，或者在服务端读出后作为 props 传下去。

## 16.28 proxy 里能观测什么

值得记的两个指标：执行次数、执行耗时。

执行次数用来发现 matcher 写宽了。一个页面导航正常产生 1 次 proxy 执行，如果日志里是 10 次，多半是预取被算进去了。

执行耗时用来发现慢请求。直方图比平均值有用，因为平均值会被少数慢请求拖偏。

最简单的做法是在响应头里加一个耗时，用 curl 或浏览器 Network 面板看：

```ts
// src/proxy.ts（计时）
const start = performance.now();
const res = await updateSession(request);
res.headers.set("x-proxy-ms", String(Math.round(performance.now() - start)));
return res;
```

线上环境里这个头不要暴露给公网，或者只暴露一个分档值（`fast`、`slow`）。两个指标都不需要引第三方库，一段 `console.log` 或者一次 `fetch` 就够，日志平台负责聚合。

## 16.29 检查点

1. 退出登录，访问 `/t/acme/billing`，返回 307，`Location` 指向 `/login?next=%2Ft%2Facme%2Fbilling`。
2. 用 `curl -i` 请求 `/_next/static/chunks/main.js`，状态码是 200。
3. 在 `src/proxy.ts` 里 `grep -n "from("` 和 `grep -n "select("`，没有命中。
4. 访问 `/login?next=https://example.com`，登录后落在 `/dashboard`，没有跳到外站。
5. `MATCHER` 变量写在 `config.matcher` 里时，规则不生效；改成字面量后生效。这个行为可以复现一次，记住它。
6. 在 `src/proxy.ts` 里写 `export const config = { runtime: "edge" }`，`pnpm build` 失败。

## 16.30 常见错误

1. 不写 matcher，静态资源被重定向

现象：页面白屏，控制台 `Uncaught SyntaxError: Unexpected token '<'`。原因：CSS 和 JS 请求被 307 到登录页，返回的是 HTML。改法：加 matcher，排除 `_next/static`、`_next/image` 和图片后缀。

2. 在 proxy 里配 runtime

现象：构建失败，报 `"runtime" is not supported in Proxy files`。原因：proxy 只能跑 Node.js runtime。改法：删掉 `config.runtime`。

3. matcher 用变量

现象：规则没生效，没有报错。原因：matcher 在构建期静态分析，变量被忽略。改法：写字面量数组。

4. 重定向没带新 cookie

现象：登录后偶发回到登录页。原因：刷新出的新 token 写在原响应上，重定向响应没有带上。改法：`response.cookies.getAll().forEach((c) => redirect.cookies.set(c))`。

5. 用 `request.url` 拼跳转地址

现象：部署后重定向到内网地址。原因：反向代理改了 host。改法：用 `NEXT_PUBLIC_SITE_URL` 拼。

6. 在 proxy 里 `new URL(next, request.url)` 直接跳

现象：被安全扫描器报开放重定向。原因：`next` 是绝对地址时直接跳到外站。改法：解析后比较 origin，不等就回默认页。

## 16.31 这一章在做什么

这一章把请求入口这一层讲完：proxy 能做什么、不能做什么、matcher 怎么写、跳转怎么不跳错地方。

第 17 章往下走一层，讲数据库怎么自己守住边界，那一层不依赖任何应用层代码。proxy 挡的是陌生人，页面挡的是不该看这个团队的人，RLS 挡的是绕过前两层直接访问数据库的请求。
