# 第 30 章 对外 API 与 Webhook

前面的页面和 Server Action 都服务于自家前端。对外 API 是另一回事：调用方是别人的服务器，认证方式、错误格式、限流、跨域都要自己定。

Webhook 是反方向。别人的服务发生事件，调用我们的地址；我们处理后回 200，或者触发重试。

本章讲四件事：用 Route Handler 写可被第三方调用的端点，用 API Key 认证并限流，用 HMAC 校验进出两个方向的签名，用 OpenAPI 描述接口。中间夹着几个容易踩的细节：`params` 是 Promise，请求体只能读一次，跨域预检不能带凭证。

这些规则有一条共同的来源：对外接口的调用方不受你控制。它可能重试、可能并发、可能发来格式不对的请求，可能根本不看你的文档。

## 30.1 Route Handler 的形状

Route Handler 是 `route.ts` 文件约定，导出的函数名就是 HTTP 方法：`GET`、`POST`、`PUT`、`PATCH`、`DELETE`、`HEAD`、`OPTIONS`。

一个目录里放 `route.ts` 就不该再放 `page.tsx`。两者都定义在同一个路径上，Next.js 会报冲突。

为什么不用直连数据库的方式暴露接口。Supabase 自带 REST 层，理论上第三方能直接查表。这条路的问题在权限模型：REST 层按行级安全过滤，第三方拿到的是数据库的视图，不能有业务规则、不能限流、不能改响应形状。业务规则一旦变化，客户端要跟着改。

Route Handler 是中间层。它做四件数据库做不了的事：认证（API Key）、限流、聚合多个来源、定义对外契约。代价是多一次函数调用，几十毫秒。

中间件不承担这个角色。`proxy.ts` 里能拦请求，但它的运行环境和可用的库有限，也不能做数据库查询。它适合做粗粒度的拦截：没带 Key 的直接 401，省得进函数。

函数签名固定两个参数：请求和上下文。

```ts
// src/app/api/v1/teams/[teamId]/members/route.ts
import type { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/v1/teams/[teamId]/members">,
) {
  const { teamId } = await context.params;  // 必须 await
  return Response.json({ teamId });
}
```

`context.params` 是 Promise，必须 `await`。这是 Next.js 15 起的变更，同步访问已经移除，写成 `context.params.teamId` 会得到 `undefined`，类型检查也可能不报错。

`RouteContext<"...">` 是全局类型，不需要 import，`next dev`、`next build`、`next typegen` 时自动生成。手写类型也可以，但要写成 `{ params: Promise<{ teamId: string }> }`。

几个默认行为要知道：

- 没定义的 HTTP 方法返回 405，响应头里带 `Allow`。
- 没定义 `OPTIONS` 时，Next.js 自动实现，并按已定义的方法生成 `Allow` 头。
- GET 默认是动态的，不缓存。要缓存得显式声明 `export const revalidate = 60`。
- 运行环境默认 Node.js。`crypto`、`fs` 这类模块可用，`runtime = "edge"` 下部分不可用。

对外接口不要写 `revalidate`。带认证的响应被 CDN 缓存是事故：A 的响应可能发给 B。

## 30.2 第一个端点

先给一个不需要认证的端点，验证部署链路。健康检查不查数据库，数据库挂了它也要返回 200，否则监控分不清是应用挂了还是库挂了。

```ts
// src/app/api/health/route.ts
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    version: process.env.APP_VERSION ?? "dev",
    timestamp: new Date().toISOString(),
  });
}
```

对外接口都放在 `/api/v1/` 下。路径带版本号，将来改结构时老调用方还能用。

路径版本化有一个隐含约定：`/v1` 里的字段只增不减。删字段、改字段类型、改错误码语义，都要开 `/v2`。调用方升级需要时间，通常是几个月。

每个请求带一个 `x-request-id`，原样返回。对方报障时提供这个 id，你能在日志里定位到那一次请求。生成方式用 `crypto.randomUUID()`，不要依赖上游传。

错误响应统一形状：

```ts
// src/lib/api/errors.ts
export type ApiErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "internal_error";

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  extra?: Record<string, unknown>,
) {
  return Response.json({ error: { code, message, ...extra } }, { status });
}
```

调用方按 `code` 判断怎么处理，按 `status` 判断要不要重试。两个字段都要稳定，加字段可以，改语义不行。

认证失败用 401，权限不足用 403。两者的处理方式不同：401 让调用方换 Key，403 告诉它这个 Key 没有这个团队的操作权。

资源不存在时，用 403 还是 404 有取舍。对外接口选 404，不泄漏资源是否存在。内部接口选 403，方便排查。这个选择要写进文档，别一处一个样。

响应字段加 `x-request-id` 之外，再加一个耗时字段只在调试环境返回。生产环境不回传堆栈，错误响应里只给人类可读的一句话。

## 30.3 API Key

外部调用方没有 cookie，用 Key 认证。Key 只在创建时显示一次，库里存哈希。

```sql
-- supabase/migrations/20261125090000_public_api.sql

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  key_prefix text not null unique,      -- 例如 tsk_live_9f3a1c2e，用于定位
  key_hash text not null,               -- sha256(完整 key)
  created_by uuid not null references public.profiles(id),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index api_keys_team_idx on public.api_keys (team_id) where revoked_at is null;

alter table public.api_keys enable row level security;

create policy "owners read team api keys"
  on public.api_keys for select
  to authenticated
  using (
    exists (
      select 1 from public.team_members m
      where m.team_id = api_keys.team_id
        and m.user_id = (select auth.uid())
        and m.role = 'owner'
    )
  );

-- 创建和吊销走服务端角色，普通用户不能直接写
revoke insert, update, delete on public.api_keys from authenticated, anon;

-- 连查询也不给看哈希：收回整表 select，只给列级权限
revoke select on public.api_keys from authenticated;
grant select (id, team_id, name, key_prefix, created_by, last_used_at, revoked_at, created_at)
  on public.api_keys to authenticated;
```

列级授权挡住 `key_hash`。收回整表 `select` 再按列 `grant`，是 Postgres 里唯一可靠的方式；只在 RLS 策略里判断列不够，因为策略管的是行。

生成与解析：

```ts
// src/lib/api/keys.ts
import { createHash, randomBytes } from "node:crypto";

export function generateApiKey() {
  const secret = randomBytes(24).toString("base64url");  // 32 字符
  const prefix = randomBytes(4).toString("hex");         // 8 字符
  const key = `tsk_live_${prefix}_${secret}`;
  return {
    key,                                   // 只返回一次，给用户复制
    keyPrefix: `tsk_live_${prefix}`,
    keyHash: hashToken(key),
  };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function parseApiKey(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) return null;
  const key = authorization.slice(7).trim();
  const match = /^(tsk_live_[0-9a-f]{8})_/.exec(key);
  if (!match) return null;
  return { key, prefix: match[1] };
}
```

前缀单独存一列，是为了让校验只查一行。`key_prefix` 有唯一索引，按它定位到记录，再比对哈希。不存前缀的话，只能把整表读出来逐行比对哈希，Key 一多就是全表扫描。

前缀里带 `live` 或 `test` 标记环境，测试 Key 打不到生产数据。这个标记在校验时读取，命中测试库的 Key 直接拒绝。

用 SHA-256，不用 bcrypt。Key 是随机生成的 32 字节串，没有可猜的规律，不需要慢哈希；而且每个请求都要校验一次，bcrypt 的百毫秒级开销受不了。

校验函数放在数据库里，一次查询完成定位、比对、记录使用时间：

```sql
-- 20261125090000_public_api.sql（继续）
create or replace function public.verify_api_key(p_prefix text, p_hash text)
returns table (key_id uuid, team_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_team uuid;
begin
  update public.api_keys
     set last_used_at = now()
   where key_prefix = p_prefix
     and key_hash = p_hash
     and revoked_at is null
  returning id, api_keys.team_id into v_id, v_team;

  if v_id is null then
    return;
  end if;

  return query select v_id, v_team;
end;
$$;

revoke all on function public.verify_api_key(text, text) from authenticated, anon;
grant execute on function public.verify_api_key(text, text) to service_role;
```

`update ... returning` 顺手把 `last_used_at` 写了，省一次往返。`return query select` 是 PL/pgSQL 里返回表结构的写法，不能写成 `return query update`。

服务端取 Key 并鉴权：

```ts
// src/lib/api/auth.ts
import "server-only";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, parseApiKey } from "@/lib/api/keys";

export type ApiCaller = { teamId: string; keyId: string };

export async function requireApiKey(request: NextRequest): Promise<ApiCaller | null> {
  const parsed = parseApiKey(request.headers.get("authorization"));
  if (!parsed) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verify_api_key", {
    p_prefix: parsed.prefix,
    p_hash: hashToken(parsed.key),
  });

  if (error || !data?.[0]) return null;
  return { teamId: data[0].team_id, keyId: data[0].key_id };
}
```

服务端角色绕过所有行级安全，泄漏一把钥匙等于打开整个库。这类客户端只在服务端文件里创建，文件加 `server-only`，构建时任何客户端引用都会失败。

用服务端角色，因为 `api_keys` 对普通用户收紧了权限。这个函数只在服务端调用，文件顶部的 `import "server-only"` 保证它不会被打进客户端包。

Key 要能细分权限。给同一个团队建多个 Key，一个只读、一个可写，泄漏时损失可控。表里加一列 `scopes text[]`，校验时按 `request.method` 判断。这一步先不做，但字段留出来，加的时候不用改表。

创建 Key 走脚本，不建页面。管理员在终端执行，输出的明文只显示一次：

```ts
// scripts/create-api-key.ts
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey } from "@/lib/api/keys";

const [teamId, name, createdBy] = process.argv.slice(2);
const { key, keyPrefix, keyHash } = generateApiKey();

const admin = createAdminClient();
const { error } = await admin.from("api_keys").insert({
  team_id: teamId,
  name,
  key_prefix: keyPrefix,
  key_hash: keyHash,
  created_by: createdBy,
});

if (error) throw error;
console.log(`创建成功，只显示这一次：\n${key}`);
```

Key 的轮换用双 Key：先建新的，调用方切过去，观察 `last_used_at` 确认旧的没流量，再吊销旧的。不要把“删除”做成物理删除，`revoked_at` 有值就够了，审计要用。

## 30.4 限流

对外接口必须有配额，否则一个写错的循环能把数据库打满。

配额按 Key 算，不按团队算。一个团队建了三个 Key，各拿各的配额，某个集成跑飞了不影响其他集成。按团队配额更适合计费场景，两者可以叠加：Key 层限速率，团队层限月度总量。

限流和重试要配套。调用方看到 429 会退避重试，如果你的限流窗口是一分钟固定窗口，它会在窗口边界连续撞墙。响应里给准确的 `X-RateLimit-Reset`，对方才能算准时间。

进程内计数不可用。它每个实例独立，函数冷启动清零，多实例部署时实际配额是“配置值 × 实例数”。限流状态要放共享存储。

```ts
// src/lib/api/rate-limit.ts
import "server-only";
import { redis } from "@/lib/redis";

const LIMITS = { free: 60, pro: 600, team: 3000 } as const;

export function limitForPlan(plan: keyof typeof LIMITS) {
  return LIMITS[plan] ?? LIMITS.free;
}

export async function checkRateLimit(keyId: string, limit: number) {
  const window = Math.floor(Date.now() / 60_000);   // 固定窗口：每分钟
  const bucket = `rl:${keyId}:${window}`;

  const count = await redis.incr(bucket);
  if (count === 1) await redis.expire(bucket, 60);

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    reset: (window + 1) * 60,
  };
}
```

固定窗口的边界问题：第 59 秒用满 60 次，第 61 秒又满 60 次，两秒内过了 120 次。对配额没有那么敏感的场景可以接受。要更平滑，用滑动窗口或令牌桶，代价是每次请求多几次 Redis 操作。

限额值按 Key 所属团队的计划取，免费 60、Pro 600、团队版 3000，单位是每分钟请求数。这个数字要写在定价页上，别让调用方猜。超过限额的请求不排队，直接拒绝。排队会让调用方超时，结果比 429 更差。

响应头把配额信息带给调用方：

```ts
// src/app/api/v1/activity/route.ts
import { NextRequest } from "next/server";
import { requireApiKey } from "@/lib/api/auth";
import { checkRateLimit, limitForPlan } from "@/lib/api/rate-limit";
import { apiError } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  const caller = await requireApiKey(request);
  if (!caller) return apiError(401, "unauthorized", "缺少或无效的 API Key");

  const limit = limitForPlan("free");
  const rl = await checkRateLimit(caller.keyId, limit);

  const headers = {
    "X-RateLimit-Limit": String(rl.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(rl.reset),
    "Cache-Control": "no-store",
  };

  if (!rl.allowed) {
    return Response.json(
      { error: { code: "rate_limited", message: "请求过于频繁" } },
      { status: 429, headers: { ...headers, "Retry-After": "60" } },
    );
  }

  // 后续查询...
  return Response.json({ items: [], has_more: false }, { headers });
}
```

`Retry-After` 给秒数，调用方据此排重试。`Cache-Control: no-store` 必写，带认证的响应不能被缓存。

Redis 挂了怎么办？两种处理：放行，可用性优先；拒绝，安全优先。对外接口选放行，同时打日志，因为限流挡不住 DDoS，那是网关的事。

## 30.5 CORS 预检

浏览器里的第三方页面调你的接口，先发 OPTIONS 预检。预检不带 cookie，也不带 `Authorization`。

简单请求和预检请求的区别，决定了哪些操作能绕过预检。方法为 GET、HEAD、POST 之一，且 `Content-Type` 是 `text/plain`、`multipart/form-data`、`application/x-www-form-urlencoded` 三者之一时，浏览器直接发请求，不发 OPTIONS。

这就是为什么 30.6 节坚持只收 `application/json`。它把跨域的写操作强制推进预检流程，服务端才有机会拒绝来源。

这条限制决定了预检处理不能鉴权。它只能回答“这个来源允不允许调”，调用方的身份在正式请求里才出现。

```ts
// src/lib/api/cors.ts
const ALLOWED_ORIGINS = new Set([
  "https://app.teamstack.dev",
  "https://admin.teamstack.dev",
]);

export function isAllowedOrigin(origin: string | null) {
  return origin !== null && ALLOWED_ORIGINS.has(origin);
}

export function corsHeaders(origin: string | null) {
  const allowed = isAllowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin! : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}
```

四个细节。

白名单回显，不用 `*`。用 `*` 时浏览器不会带上 cookie，而你以后想支持凭证时会卡住。

`Vary: Origin` 必写。共享缓存按 Origin 分键，否则 A 站拿到的响应会被发给 B 站。

不加 `Access-Control-Allow-Credentials: true`。API Key 走 `Authorization` 头，不依赖 cookie。加了它反而要求 `Allow-Origin` 精确到单个来源。

预检结果会被浏览器缓存，时长由 `Access-Control-Max-Age` 控制。设成十分钟，用户在页面里连续操作时只预检一次。设太大，改了跨域策略后浏览器还在用旧结果。

`Allow-Headers` 要列出所有自定义头。漏了 `Idempotency-Key`，浏览器会在预检阶段直接拦掉请求，正式请求根本发不出去。

## 30.6 内容类型与体积

POST 只接受 JSON。

```ts
// src/lib/api/validate.ts
import "server-only";

const MAX_BODY_BYTES = 1024 * 1024;  // 1MB

export async function readJsonBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("application/json")) {
    return { ok: false as const, status: 415, message: "只接受 application/json" };
  }

  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) {
    return { ok: false as const, status: 413, message: "请求体超过 1MB" };
  }

  try {
    const body = await request.json();
    return { ok: true as const, body };
  } catch {
    return { ok: false as const, status: 400, message: "JSON 解析失败" };
  }
}
```

为什么卡内容类型：`text/plain` 属于简单请求，浏览器不发预检，直接 POST 就到服务端，跨域策略被绕过一部分。要求 JSON 之后，跨域的写请求必须先过预检。

`content-length` 不可信，调用方可以不发或者发假值。真正的上限在网关层，或者读流时计数。函数里这一层是第二道防线。

响应也要管体积。列表接口每页默认 20 条，上限 100 条，参数超过上限时截断，不报错。响应体超过 1MB 时考虑分页，别一次返回全部。

分页用游标不用页码。游标是上一页最后一条的 `created_at` 加 `id`，下一页从它之后取。页码在数据持续写入时会有重复和遗漏。

请求体只能读一次。`request.json()` 之后再 `request.text()` 会抛 `Body is unusable`。需要原始字节时先 `request.clone()`，克隆有内存代价，大请求体不要克隆。

## 30.7 代理后端

有一批报表在内部服务里，通过 Next.js 转发暴露给外部。这类代理最容易写出两个洞：开放代理和凭证透传。

```ts
// src/app/api/proxy/reports/route.ts
import { NextRequest } from "next/server";
import { apiError } from "@/lib/api/errors";

const ENDPOINTS = new Map([
  ["/reports/monthly", "/v2/reports/monthly"],
  ["/reports/usage", "/v2/reports/usage"],
]);

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";
  const upstream = ENDPOINTS.get(path);   // 白名单，路径由服务端定
  if (!upstream) return apiError(400, "invalid_request", "未知的报表路径");

  try {
    const response = await fetch(new URL(upstream, process.env.REPORTS_ORIGIN!), {
      method: "POST",
      redirect: "error",                  // 上游跳转一律当失败，防被引导到别处
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.REPORTS_TOKEN}`,
      },
      body: await request.text(),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return apiError(502, "internal_error", "上游服务失败");

    return new Response(response.body, {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return apiError(502, "internal_error", "上游服务不可达");
  }
}
```

三个决定。

路径从 `Map` 里取，不从 URL 拼。直接拼路径等于开放代理，任何人都能拿你的服务当跳板访问任意地址，也能借你的 token 调上游的其他接口。这类漏洞叫 SSRF。

入站请求头只挑需要的往下传。`Cookie` 和 `Authorization` 一律不透传，那是我们自己的用户凭证，上游不认，传过去只是泄漏。

响应用手 `new Response(response.body)` 流式转发，不 `await response.json()`。整包读进内存后，大响应会撑爆函数内存；流式转发时内存占用与响应体大小无关。

超时必设。上游不返回时，函数会挂到平台强制超时，占着并发不放。

也可以用 rewrites 做代理。`next.config.ts` 里配置一条规则，把 `/api/proxy/:path*` 转发到上游，省一次函数执行。差别在于 rewrites 做不了路径白名单，也改不了请求头，默认会把入站的 `Authorization` 一起带过去。需要精细控制时用 Route Handler。

反代的部署形态要注意。`req.nextUrl` 拿到的 `origin` 可能是内部地址，生成回调地址、跳转链接时用环境变量里的公开域名，不要用 `nextUrl.origin`。

## 30.8 入站 Webhook：验签

第三方调我们的回调地址，必须验签。地址可能被扫到，签名是唯一能证明“这条请求来自对方”的东西。

签名算法约定：`HMAC-SHA256(secret, "${timestamp}.${rawBody}")`，放在 `X-Partner-Signature: t=<秒>,v1=<hex>` 头里。

```ts
// src/lib/webhooks/signature.ts
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_SKEW_SECONDS = 300;

export function signPayload(secret: string, timestamp: number, body: string) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

export function verifySignature(
  secret: string,
  header: string | null,
  body: string,
): boolean {
  if (!header) return false;

  const parts = Object.fromEntries(
    header.split(",").map((pair) => {
      const [k, v] = pair.split("=");
      return [k.trim(), v?.trim() ?? ""];
    }),
  );

  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > MAX_SKEW_SECONDS) return false;

  const expected = signPayload(secret, timestamp, body);
  const received = parts.v1 ?? "";
  if (expected.length !== received.length) return false;

  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
```

时间戳窗口是防重放的一半。攻击者截获一条合法请求，可以无限次重发，签名一直有效。五分钟窗口把重放限制在一个小时段内，另一半靠幂等表去重。

比较用 `timingSafeEqual`。普通字符串比较会在第一个不同的字符处返回，耗时差异可以被统计出来，逐步猜出正确签名。

原始字节必须用 `request.text()` 拿。先 `request.json()` 再用 `JSON.stringify` 重算，序列化后的空格、键顺序都可能不同，签名永远对不上。

```ts
// src/app/api/webhooks/partner/route.ts
import { NextRequest } from "next/server";
import { verifySignature } from "@/lib/webhooks/signature";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/api/errors";

export const maxDuration = 10;

export async function POST(request: NextRequest) {
  const raw = await request.text();

  const ok = verifySignature(
    process.env.PARTNER_WEBHOOK_SECRET!,
    request.headers.get("x-partner-signature"),
    raw,
  );
  if (!ok) return apiError(401, "unauthorized", "签名校验失败");

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return apiError(400, "invalid_request", "请求体无法解析为 JSON");
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("enqueue_inbound_webhook", {
    p_payload: payload,
  });
  if (error) return apiError(500, "internal_error", "入队失败");

  return Response.json({ received: true }, { status: 200 });
}
```

验签放在解析之前，签名错就直接 401，不浪费解析开销。

入队之后返 200，不做业务处理。对方的超时通常是 5 秒，业务处理放后台，超时会被重试，重复处理要靠幂等。

```sql
-- 20261125090000_public_api.sql（继续）
create or replace function public.enqueue_inbound_webhook(p_payload jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.jobs (kind, payload)
  values ('webhook_in', p_payload)
  on conflict do nothing;
$$;

-- 同一个 event_id 只入队一次
create unique index if not exists jobs_inbound_event_uidx
  on public.jobs ((payload ->> 'event_id'))
  where kind = 'webhook_in';
```

表达式部分唯一索引加 `on conflict do nothing`，重复投递静默丢弃。`event_id` 由对方提供，缺这个字段时索引里是 `null`，唯一约束不生效，所以要在验签之后检查它存在。

验签失败时按顺序排查四件事：密钥的值有没有多余空格（环境变量里常有换行）；签名用的字符串是否按 `${timestamp}.${body}` 拼接，多一个空格就全错；`request.text()` 拿到的是否为原始字节；时间戳与本机时间相差是否超过五分钟。

线上排查时把期望签名和实际签名的前 8 个字符打出来，别打完整值。日志里出现完整签名等于泄漏。

密钥轮换要留过渡期。配置里多放一个 `PARTNER_WEBHOOK_SECRET_NEXT`，两个都试，旧的撤销时间由对方通告。

## 30.9 出站 Webhook：重试

我们也要通知别人。投递失败要重试，重试用指数退避，超过次数标记死信。

投递状态存在 `jobs` 表里。用表不用队列，理由很简单：这份数据要能查、能重放、能手工改状态，队列满足不了这些运维需求。

```ts
// src/lib/webhooks/deliver.ts
import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const BACKOFF_SECONDS = [10, 60, 300, 1800, 7200];  // 五次，共约 2.8 小时
const TIMEOUT_MS = 5000;

export async function deliverWebhook(job: {
  id: string;
  attempts: number;
  payload: { url: string; event: string; data: unknown; secret: string };
}) {
  const { url, event, data, secret } = job.payload;
  const body = JSON.stringify({ event, data, event_id: job.id });
  const timestamp = Math.floor(Date.now() / 1000);

  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  const admin = createAdminClient();

  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "X-Teamstack-Event": event,
        "X-Teamstack-Event-Id": job.id,
        "X-Teamstack-Signature": `t=${timestamp},v1=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.ok) {
      await admin.from("jobs").update({ status: "done" }).eq("id", job.id);
      return;
    }

    await scheduleRetry(admin, job.id, job.attempts + 1, `HTTP ${response.status}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    await scheduleRetry(admin, job.id, job.attempts + 1, message);
  }
}

async function scheduleRetry(
  admin: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  id: string,
  attempts: number,
  lastError: string,
) {
  const delay = BACKOFF_SECONDS[attempts - 1];
  const patch =
    delay === undefined
      ? { status: "dead" as const, attempts, last_error: lastError.slice(0, 500) }
      : {
          status: "queued" as const,
          attempts,
          last_error: lastError.slice(0, 500),
          run_at: new Date(Date.now() + delay * 1000).toISOString(),
        };

  await admin.from("jobs").update(patch).eq("id", id);
}
```

`last_error` 截断到 500 字符。对方返回的 HTML 错误页可能几十 KB，截断避免把表撑大。

投递顺序不做保证。并发投递加上重试，同一条事件可能在两天后到，而它后面的新事件早就到了。调用方要按 `X-Teamstack-Event-Id` 去重，按业务字段里的时间排序，不要依赖到达顺序。

这一点要写进对接文档。很多对接方默认事件按顺序到达，上线后才发现状态被旧事件覆盖。

重试队列的领取要防并发。两个 worker 同时拿到同一条任务，会重复投递：

```sql
-- 20261125090000_public_api.sql（继续）
create or replace function public.claim_jobs(p_limit int default 20)
returns setof public.jobs
language sql
security definer
set search_path = public
as $$
  update public.jobs j
     set status = 'running',
         run_at = now() + interval '10 minutes'  -- 可见性超时
   where j.id in (
     select id from public.jobs
      where status = 'queued'
        and run_at <= now()
      order by run_at
      limit least(greatest(p_limit, 1), 100)
      for update skip locked
   )
  returning j.*;
$$;
```

`for update skip locked` 让并发 worker 各拿各的，不会互相等。`running` 状态配合 `run_at` 当可见性超时：worker 崩溃后，任务在十分钟后重新可领。

回收逻辑写成一条独立的更新，定时任务里跑：

```sql
update public.jobs
   set status = 'queued'
 where status = 'running'
   and run_at < now();
```

触发投递的入口是定时接口：

```ts
// src/app/api/cron/jobs/route.ts
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverWebhook } from "@/lib/webhooks/deliver";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: jobs } = await admin.rpc("claim_jobs", { p_limit: 20 });

  for (const job of jobs ?? []) {
    if (job.kind === "webhook_out") await deliverWebhook(job);
  }

  return Response.json({ processed: jobs?.length ?? 0 });
}
```

`maxDuration = 60` 是平台上限内的声明。二十条任务、每条最多 5 秒超时，最坏情况 100 秒，超过函数上限。实际做法是把并发控制在 10 条以内，或者用 `Promise.allSettled` 并行，靠平台的长任务方案兜底。

退避间隔的选取有依据。第一次 10 秒，覆盖网络抖动；最后一档 2 小时，覆盖对方维护窗口。总时长控制在三小时内，超过这个时间的重试意义不大，对方大概率已经发现问题。

4xx 和 5xx 要区别对待。对方返回 400、401、404，说明请求本身有问题，重试没用，直接标死信。返回 429、500、502 才值得重试。上面代码统一重试是为了简短，生产实现里按状态码分流。

我们的接口对调用方也要明确这条规则。文档里写清哪些状态码可以重试，别让对方靠猜。

死信要有人看。`status = 'dead'` 的行每周导一次，人工判断重放还是通知对方。没有这一步，重试等于把错误藏起来。

## 30.10 幂等键

调用方超时后重试，同一笔操作可能到两次。幂等键让第二次返回第一次的结果。

```sql
-- 20261125090000_public_api.sql（继续）
create table if not exists public.api_idempotency (
  key text primary key,
  team_id uuid not null,
  method text not null,
  path text not null,
  state text not null check (state in ('claimed', 'done')),
  response_body jsonb,
  response_status int,
  created_at timestamptz not null default now()
);

create index api_idempotency_created_idx on public.api_idempotency (created_at);

create or replace function public.claim_idempotency(
  p_key text, p_team uuid, p_method text, p_path text
)
returns table (state text, response_body jsonb, response_status int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.api_idempotency%rowtype;
begin
  insert into public.api_idempotency (key, team_id, method, path, state)
  values (p_key, p_team, p_method, p_path, 'claimed')
  on conflict (key) do nothing;

  select * into v_row from public.api_idempotency where key = p_key;

  if v_row.state = 'claimed' and v_row.created_at = (
    select created_at from public.api_idempotency where key = p_key
  ) then
    return query select 'new'::text, null::jsonb, null::int;
  end if;

  return query select v_row.state, v_row.response_body, v_row.response_status;
end;
$$;
```

三种结果：新建成功、正在处理、已完成。第三种直接回放响应，状态码一起回放。第二种返回 409，让调用方稍后再试。

并发场景下，两个请求同时带同一个幂等键到达。`insert ... on conflict do nothing` 只有一条成功，另一条查到 `claimed` 状态，返回 409 让调用方重试。第一次处理完成后写入响应，后来的请求直接回放。

请求没带幂等键时，不做去重。要求所有调用方都带上不现实，非幂等操作在文档里标明“建议带”。
不同团队用同一个键值互不影响，共用主键会让一个团队的记录挡住另一个。

过期清理放定时任务，删除 24 小时前的记录。别用 `created_at` 做保留策略以外的判断。

## 30.11 OpenAPI 描述

接口文档写成 spec，别手写 Markdown。spec 能被工具读取、能生成客户端、能做契约测试。

```ts
// src/app/api/v1/openapi.json/route.ts
export const dynamic = "force-static";

export async function GET() {
  return Response.json(
    {
      openapi: "3.1.0",
      info: { title: "Teamstack API", version: "1.0.0" },
      servers: [{ url: "https://app.teamstack.dev" }],
      paths: {
        "/api/v1/activity": {
          get: {
            summary: "列出团队活动",
            security: [{ bearerAuth: [] }],
            parameters: [
              { name: "limit", in: "query", schema: { type: "integer", maximum: 100 } },
              { name: "since", in: "query", schema: { type: "string", format: "date-time" } },
            ],
            responses: {
              "200": { description: "成功" },
              "401": { description: "缺少或无效的 Key" },
              "429": { description: "超出配额" },
            },
          },
        },
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer" },
        },
      },
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
```

`force-static` 加 `public` 缓存可以，因为这份文档不含用户数据。公开接口的 spec 本身就是公开的，藏起来没有意义。

spec 里每个错误码都要给出示例。调用方多半只看 200 的响应示例，错误分支靠文档才写得清楚。示例写真实响应，别写占位符。

契约测试的做法：CI 里跑一组请求，断言状态码和响应字段与 spec 一致。改了实现没改 spec，测试就会红。

文档站托管在 `/api/v1/openapi.json`，Swagger UI 之类的前端可以直接读这个地址渲染。缓存五分钟，改了 spec 等一会儿生效。

## 30.12 检查点

1. `curl -i http://localhost:3000/api/health` 返回 200，`content-type` 是 `application/json`，`dynamic` 声明生效时响应头没有 `x-nextjs-cache: HIT`。
2. 不带 Key 调 `/api/v1/activity` 返回 401 和 `{"error":{"code":"unauthorized"}}`；带正确 Key 返回 200，响应头里有 `X-RateLimit-Limit`。
3. 一分钟内连发 61 次请求，第 61 次返回 429，带 `Retry-After`。
4. `curl -i -X OPTIONS` 调接口，返回 204，`access-control-allow-origin` 是白名单里的来源，`vary` 含 `Origin`。
5. 不签名调 `/api/webhooks/partner` 返回 401；用 `openssl` 算出正确签名后返回 200，同一 `event_id` 重发一次，`jobs` 表不新增行。
6. 把 `claim_jobs` 并发调用两次，两次返回的任务 id 不重叠。
7. 同一幂等键 POST 两次，第二次返回第一次的响应体与状态码。

## 30.13 常见错误

1. `TypeError: Cannot read properties of undefined (reading 'teamId')`

`context.params` 没 `await`。改成 `const { teamId } = await context.params;`，类型也写成 `Promise`。

2. `Body is unusable: Body has already been consumed`

同一个请求读了两次体。需要原始文本时先读 `request.text()`，再 `JSON.parse`，不要两个都读。真要读两次，先 `request.clone()`。

3. `TypeError: crypto.createHmac is not a function`

Route Handler 声明了 `runtime = "edge"`。Node 的 `crypto` 模块在 edge 运行时不可用，验签改回 Node 运行时。

4. 浏览器控制台 `blocked by CORS policy: Response to preflight request doesn't pass access control check`

预检的响应缺头，或者 `Allow-Origin` 没回显具体来源。检查 `OPTIONS` 是否返回 204、`Allow-Headers` 是否包含实际发送的自定义头。

5. `duplicate key value violates unique constraint "jobs_inbound_event_uidx"`

去重索引建了，但插入语句没写 `on conflict do nothing`。要么改插入，要么先捕获错误当成功处理。

6. `TimeoutError: The operation was aborted due to timeout`

上游或回调方在超时时间内没有响应。确认 `AbortSignal.timeout` 的值，并把这条失败写入 `last_error` 等待重试，不要让异常冒泡到 500。

## 30.14 这一章在做什么

这一章把应用的能力开放出去，同时守住三条线。

认证线：API Key 存哈希不存原文，校验走服务端角色，权限收在行级安全和列级授权两层。限流状态放 Redis，进程内计数在多实例部署下没有意义。

边界线：CORS 白名单回显并带 `Vary`，预检不鉴权；请求体先查类型和大小再解析；代理走白名单路径，不透传用户凭证。

正确性线：入站先验签再解析，时间戳窗口防重放，幂等索引防重复入队；出站用指数退避，领取任务用 `skip locked`，崩溃靠可见性超时回收。

下一章讲客户端取数。对外接口的调用方是外部系统，下一章的调用方是浏览器里的组件，两者对缓存和失败处理的要求完全不同。
