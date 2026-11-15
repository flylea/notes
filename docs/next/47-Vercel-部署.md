# 第 47 章 Vercel 部署

这一章讲把同一个 teamstack 应用部署到 Vercel，作为自托管主站的对照环境。用途有三个：试用新功能、给外部演示、验证“换平台要改哪些代码”。

Vercel 的执行模型与 VPS 完全不同。请求进入的是函数实例，实例按需启动、空闲回收，文件系统只读，状态不跨请求保留。理解这三条，才能解释后面所有限制。

版本基线是 Next.js 16.4.6、Node.js 22、Vercel Hobby 计划、Supabase 免费项目。文中额度以 Vercel 官方文档为准，2026 年 11 月核对；超出后按官网当前数值调整。

## 47.1 执行模型：没有常驻进程

VPS 上跑的是一个 Node 进程，从启动到停机都在。Vercel 上跑的是函数实例，一个请求可能落到新实例，也可能复用刚启动的实例。没有请求时实例被挂起或销毁。

文中额度以 2026 年 11 月的官方文档为准。平台会调整数值，动手前再核一次定价页与限额页。

和 VPS 对照，最大的差别在“进程生命周期是谁管的”。VPS 上你决定什么时候重启；Vercel 上平台决定什么时候回收，代码只能假设自己随时会被换掉。

这带来三个直接后果。进程内存不保证保留，模块级变量会在实例回收时清空；文件系统只有 `/tmp` 可写，容量 500 MB；单次执行有时间上限，Hobby 是 300 秒，默认值也是最大值。

超时的报错长这样。日志里只有一行状态码，前面没有业务堆栈，因为进程被平台终止了。

```text
504 FUNCTION_INVOCATION_TIMEOUT
```

免费档还有几个额度容易忽略。函数调用次数按月计，静态页面不消耗；构建次数按天计，预览分支每次推送都会触发一次。把预览的自动部署关掉，只在需要时手动触发，能省不少。

冷启动是另一个变量。实例被回收后，下一次请求要重新加载代码、建连接、初始化 SDK，通常 300–800 毫秒。Hobby 没有预留实例，冷启动躲不掉；把初始化放在模块顶层，能让后续请求复用。

把导出、批量处理这类长任务放进函数，一定会撞上 300 秒。正确做法是拆成可恢复的小步骤，每步控制在 60 秒内，记录游标，下一次请求接着跑。

## 47.2 三道硬限制

函数最大执行时长 300 秒。请求体与响应体上限 4.5 MB，流式响应不受响应体限制，但请求体在进入函数前就检查。内存 2 GB、1 vCPU，超出后实例被杀。

代码包未压缩上限 250 MB。`node_modules` 里塞了原生二进制或大字体时容易超，构建日志会提示超出。

函数默认部署在 `iad1`，Hobby 不能选其他区域。用户在中国大陆时，一次请求的 RTT 在 200 毫秒以上，首屏比自托管慢。

`/tmp` 的 500 MB 是共享的，同一实例的多次调用都能看见。不要把它当缓存：实例回收后内容消失，两个请求落到不同实例时也看不到彼此的文件。

并发按请求数自动扩，Hobby 上限比 Pro 低。流量突增时，超出的请求会排队或被拒，表现是响应时间从几百毫秒涨到几秒，再出现 503。做活动页要提前估算峰值。

构建分钟数和带宽也计入免费额度。一次完整构建约 2–4 分钟，一天发十次就吃掉半小时；函数出网流量按 GB 计，图片没走 CDN 时会很快累积。

构建阶段同样有限制。依赖安装超过 45 分钟会失败，镜像体积超过 250 MB 会失败。把只在开发时用的依赖放进 `devDependencies`，能少几十 MB。

## 47.3 无状态改造

直传的流程分三步：服务端校验权限并生成签名，浏览器 PUT 文件，服务端写元数据。第二步不经过函数，网络中断后可以重试；第三步失败时留下孤儿对象，要用清理任务处理。

签名里可以限制大小和类型。Supabase 的 `createSignedUploadUrl` 只签名路径，大小限制要自己在校验时判断；上传完成后再查一次对象大小，能挡住伪造的 `Content-Length`。

文件上传要直传对象存储。浏览器先向服务端要一个签名 URL，再把文件直接 PUT 到 Supabase Storage，服务端只记录元数据。这样大文件不经过函数，绕开 4.5 MB 限制。

```ts
// src/app/(app)/teams/[teamId]/attachments/actions.ts
'use server'

import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { requireTeamMember } from '@/lib/teams'

const MAX_SIZE = 50 * 1024 * 1024 // Supabase 免费档单文件上限 50 MB

export async function createUploadTicket(input: {
  teamId: string
  filename: string
  size: number
  contentType: string
}) {
  await requireTeamMember(input.teamId)

  if (input.size > MAX_SIZE) {
    return { error: '文件超过 50 MB' }
  }

  const supabase = await createClient()
  // 路径带上 teamId，RLS 才能按团队隔离
  const path = `${input.teamId}/${randomUUID()}-${input.filename}`

  const { data, error } = await supabase.storage
    .from('attachments')
    .createSignedUploadUrl(path)

  if (error) return { error: error.message }
  // token 交给浏览器，它直接 PUT 到 Supabase，不经过 Vercel
  return { path, token: data.token, signedUrl: data.signedUrl }
}
```

长任务改成可恢复的分页处理。任务表里存游标，每次调用处理一批，处理完更新游标；下一次由 Cron 或前端轮询触发。

```ts
// src/lib/digest.ts
import { sql } from 'kysely'
import { db } from './db'
import { sendDigestEmail } from './email'

const BATCH_SIZE = 20

export async function runDigestBatch() {
  const state = await db
    .selectFrom('job_state')
    .selectAll()
    .where('name', '=', 'daily_digest')
    .executeTakeFirstOrThrow()

  let query = db
    .selectFrom('teams')
    .select(['id', 'name'])
    .orderBy('id')
    .limit(BATCH_SIZE)

  if (state.cursor_id) {
    // uuid 参数显式转型，否则报 uuid > text 的类型错误
    query = query.where(sql<boolean>`id > ${state.cursor_id}::uuid`)
  }

  const teams = await query.execute()

  let sent = 0
  for (const team of teams) {
    try {
      await sendDigestEmail(team.id)
      sent += 1
    } catch (error) {
      // 单个团队失败不阻塞整批，下一轮会重试
      console.error('[digest] team failed', team.id, error)
    }
  }

  const done = teams.length < BATCH_SIZE

  await db
    .updateTable('job_state')
    .set({
      cursor_id: done ? null : teams.at(-1)!.id,
      last_run_at: new Date(),
    })
    .where('name', '=', 'daily_digest')
    .execute()

  return { processed: teams.length, sent, done }
}
```

签名 URL 的有效期按秒计。上传大文件时给 300 秒，前端拿到 URL 后直接 PUT，失败重试要重新申请，旧 URL 过期后返回 403。

游标类型要和主键一致。主键是 `uuid` 时，游标存成 `text`，比较时显式转回 `uuid`；直接按字符串比较会得到错误的顺序。

实例回收前，未完成的 `after()` 和 `waitUntil()` 回调可能来不及执行。它们只适合放日志、统计这类可丢的工作，不能承担“必须执行一次”的业务。

## 47.4 连接池与 Fluid compute

算一笔账。免费档连接上限约 60，函数池大小设 5，最多 12 个实例；并发再高就要排队。把池设成 1，实例能到 60 个，但每个请求都要等空闲连接，延迟上升。折中方案是池 3–5，加连接池端口，让 Supabase 侧复用连接。

每个函数实例都建自己的数据库连接。并发上来时，实例数乘以池大小会超过数据库上限，报错是连接槽耗尽。

```text
FATAL: remaining connection slots are reserved for non-replication superuser connections
```

Supabase 免费项目直连上限约 60，连接池端口约 200。函数侧池大小设 1–5，配合连接池端口使用，能把并发摊平。

池要建在模块级，并在 Vercel 环境里挂上 `attachDatabasePool`。它用 `waitUntil` 在实例挂起前关闭空闲连接，减少连接泄漏。

```ts
// src/lib/db.ts
import { attachDatabasePool } from '@vercel/functions'
import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'
import type { Database } from './db-types'

// 模块顶层：同一实例内复用，实例销毁时随之销毁
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Vercel 上指向 6543 事务池
  max: 5, // 实例内最多 5 条，别设 1
  min: 1,
  idleTimeoutMillis: 5_000, // 空闲 5 秒就还回去，别让连接悬着
  connectionTimeoutMillis: 10_000,
})

// 只在 Vercel 环境注册；本地和 VPS 没有这个 API
if (process.env.VERCEL) {
  attachDatabasePool(pool)
}

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
})

// 健康检查用：真跑一条 SQL，确认数据库可达
export async function pingDatabase() {
  await sql`select 1`.execute(db)
}
```

Supabase 的连接池有两种模式。6543 端口是事务模式，语句执行完就归还连接，适合函数；5432 端口是会话模式，连接在会话期间独占，适合迁移和 `LISTEN`。两种模式混用时，事务模式里不能跑 `SET`、`LISTEN`、预处理语句。

空闲超时设短，5 秒左右。Fluid compute 下同一实例会处理多个请求，池大小保持 5、最小 1，不要设成 1：设成 1 并不能减少总连接，只会让并发请求排队。

健康检查接口要轻，只查一次数据库，设 10 秒超时。它同时被 Cron 和外部监控调用，写重了会自己把自己拖垮。

```ts
// src/app/api/health/route.ts
import { NextResponse } from 'next/server'
import { pingDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 10 // 健康检查不该超过 10 秒，超了就是真有问题

export async function GET() {
  try {
    await pingDatabase()
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[health] database ping failed', error)
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
```

## 47.5 部署配置

`vercel.json` 固定框架、构建命令、区域和 Cron。区域写 `iad1`，与 Hobby 的默认区域一致，写别的会在部署时报错。

```json
// vercel.json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm build",
  "regions": ["iad1"],
  "crons": [
    {
      "path": "/api/cron/daily-digest",
      "schedule": "0 1 * * *"
    }
  ]
}
```

`engines` 要和本地、CI 保持一致。Vercel 读 `package.json` 决定 Node 大版本，写 `>=20.9` 时可能选到 22；本地是 22、线上是 20 时，原生依赖的 ABI 对不上会运行时报错。

```json
// package.json 片段
{
  "packageManager": "pnpm@9.15.4",
  "engines": {
    "node": ">=20.9.0"
  }
}
```

预览部署默认在每次推送时触发。分支多、提交碎时，构建分钟消耗比想象中快；把不需要预览的分支关掉，或改成手动触发。

构建命令默认是 `next build`，安装命令默认按 lockfile 推断。项目用 pnpm 时必须让 `packageManager` 和 lockfile 同时存在，缺一个会退回 npm，依赖解析结果不同。

`ignoreCommand` 可以跳过无关构建。值写成一段 shell，返回 0 表示跳过；常见用法是比较变更目录，只改文档时不重建。

`packageManager` 字段决定 pnpm 版本。写了 `pnpm@10` 就用 10，没写则用平台默认值；两者不一致时 lockfile 解析结果可能不同，构建偶发失败。

## 47.6 环境变量：三套值

变量命名要和使用位置一致。`NEXT_PUBLIC_` 前缀的会进浏览器产物，构建时内联；改这类变量必须重新部署，只改环境变量不会生效。服务端变量在运行时读取，改完重启函数即可。

同一个项目有三套环境：Production、Preview、Development。变量按环境分开配，Production 指主域名，Preview 指分支域名，Development 指本地。

密钥类变量标记为 Sensitive。标记后控制台不能再读原值，只能覆盖；本地要用 `vercel env pull .env.local` 拉一份，拉下来的是解密后的值，别提交。

`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 在 Vercel 上由平台管理，不需要自己设。自己覆盖后，滚动发布期间新旧实例密钥不一致，表单提交会报解密失败。

```text
Error: Failed to decrypt action bound arguments
```

变量有作用域。团队级变量对全部项目生效，项目级变量只对本项目生效，环境级变量只对某个环境生效。同名时按环境、项目、团队的顺序覆盖，配错了会出现“本地对、线上错”。

三个环境共用同一个数据库时，Preview 的写操作会污染生产数据。做法有三种：Preview 用单独的免费 Supabase 项目；Preview 只读；付费开 branching。免费档推荐第一种，十分钟能配好。

## 47.7 Cron 与鉴权

Hobby 的 Cron 每天只能跑一次，表达式写成每小时会在部署时失败。日任务是这个计划的上限，分钟级任务必须放到 VPS。

Cron 触发的是普通 HTTP 请求，没有平台级鉴权。请求头里带 `Authorization: Bearer $CRON_SECRET`，路由里比对，不一致返回 401。

```ts
// src/app/api/cron/daily-digest/route.ts
import { NextResponse } from 'next/server'
import { runDigestBatch } from '@/lib/digest'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('unauthorized', { status: 401 })
  }

  const result = await runDigestBatch({ batchSize: 20 })
  return NextResponse.json(result)
}
```

Cron 失败不会自动重试。函数返回 5xx 时，这一次就丢了；要可靠就自己记录“今天是否执行”，下一次触发时补跑。

Cron 时区固定 UTC。写 `0 1 * * *` 对应北京时间 9 点；想让用户早上收到邮件，按 UTC 换算，别按本地时间写。

Cron 的执行有一小时窗口，不保证准点。日志里记录开始与结束时间，连续两天没跑要告警。

`maxDuration` 要在路由里显式写，Hobby 上限 300；写 600 会在部署时报错。日任务控制在 60 秒内，留出重试余量。

## 47.8 Preview 环境与跳转地址

邮件里的链接要按环境生成，短信、通知同样。凡是对外发的地址，都不能在代码里写死。

分支域名有规律：`<project>-git-<branch>-<team>.vercel.app`，分支名里的斜杠会被替换。写死某一个预览域名会在下次推送后失效；要稳定地址就绑自定义域名。

Preview 部署的域名每次不同，形如 `teamstack-git-branch-user.vercel.app`。邮件里的邀请链接、OAuth 回调地址如果写死生产域名，Preview 上点击会跳到生产。

做法是用一个函数解析当前环境的基地址：优先读显式配置，其次读 `VERCEL_URL`，最后回退到 localhost。

```ts
// src/lib/app-url.ts
export function getAppUrl(): string {
  // 生产显式配置，必须有
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  // Vercel 预览：用这次部署的唯一域名
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '')
  }
  // 本地
  return 'http://localhost:3000'
}
```

写死域名的代码要全部替换。搜一遍 `https://teamstack.example.com`，剩下的每一处都要走 `getAppUrl()`。

```ts
// 改前
const link = `https://teamstack.example.com/invite/${token}`
```

Supabase 的 Redirect URLs 要把 Preview 域名加进去，否则 OAuth 登录回跳被拒。

```text
https://teamstack.example.com/**
https://teamstack-*.vercel.app/**
http://localhost:3000/**
```

OAuth 回调地址也要按环境生成。Supabase 的 Redirect URLs 支持通配，但通配只允许在域名前缀上，路径要精确；把 `/**` 写成 `*` 会导致部分回调被拒。

Preview 的登录态不能带回主站。两边的 cookie 域不同，主站是自建域名，Preview 是 `*.vercel.app`；跨域写 cookie 会被浏览器拒绝，这是预期行为，不要试图绕过。

## 47.9 必须留在 VPS 的任务

有些任务在 Vercel 上做不了，列清楚比事后发现好。

长驻 worker 的替代方案是外部服务。把消费逻辑放到一台小 VPS 或 Cloudflare Worker，用同一套数据库；Vercel 只负责 HTTP 请求，任务由外部进程消费。这个拆分比把 worker 硬塞进函数可靠。

长驻 worker：需要常驻进程消费队列、维持 WebSocket 连接、跑定时轮询。Vercel 的函数模型不支持。

数据库备份：没有 `pg_dump` 二进制，`/tmp` 只有 500 MB，执行上限 300 秒。备份继续放 VPS。

大文件处理：视频转码、超大 CSV 解析。4.5 MB 请求体限制和 300 秒执行时间都不够。

定时清理：删除过期会话、清孤儿对象、归档旧日志。这类任务单次执行短，但要按分钟调度，Cron 的每天一次不够。

队列消费：需要重试、延迟、并发控制的后台任务。Vercel 的 Cron 只有每日一次，函数退出后没有消费者。

真实 IP 与限流：函数拿到的 IP 经过平台代理，按 IP 限流的精度下降。需要严格限流的接口放自托管。

## 47.10 DNS 与 Cookie 的分工

主域名解析到 VPS，Vercel 域名只用于对照和演示。两条 A 记录不要指向同一主机名，否则 cookie 会在两个环境之间混。

```text
teamstack.example.com          A      203.0.113.10        （VPS，灰云或橙云都行）
www.teamstack.example.com      CNAME  teamstack.example.com
preview.teamstack.example.com  CNAME  cname.vercel-dns.com  （可选，给固定预览入口）
```

用 `curl` 看响应头能区分是谁在服务。`server: Vercel` 说明请求到了平台，`x-vercel-id` 是区域标识。

```bash
curl -sSI https://preview.teamstack.example.com/ | grep -iE '^(HTTP|location|server)'
```

切换主域名时先改 TTL。把 TTL 降到 300 秒，等旧记录过期，再改指向；改完观察一天，确认没有流量打到旧地址，最后把 TTL 调回。跳过降 TTL 的步骤，改错时要等一天才能修。

两条记录可以共存。主域名走 VPS，`preview` 子域走 Vercel，互不影响；把预览放到自有子域上，cookie 的作用域更清楚。

Cookie 的 `Domain` 属性只写当前域名，不写父域。写 `.example.com` 会让预览和生产的会话互相覆盖。

## 47.11 部署、回滚与日志

命令行部署适合本地验证。`vercel` 首次运行会关联项目，之后 `vercel --prod` 发布到生产。

```bash
# 关联本地目录到 Vercel 项目（生成 .vercel/project.json）
pnpm dlx vercel@latest link

# 部署一个预览版本，输出访问地址
pnpm dlx vercel@latest

# 直接上生产（不建议在团队里用，绕过 PR 评审）
pnpm dlx vercel@latest --prod

# 看最近几次部署及状态
pnpm dlx vercel@latest ls

# 看某次部署的构建日志 / 运行时日志
pnpm dlx vercel@latest inspect https://teamstack-abc123.vercel.app
pnpm dlx vercel@latest logs https://teamstack-abc123.vercel.app --since 1h
```

回滚后要确认三件事：域名指向的部署 ID 变了、环境变量没有回退、数据库结构仍兼容。`vercel inspect` 能看到部署 ID，数据库兼容性靠迁移策略保证。

回滚用 `vercel rollback`，选一个历史部署。回滚只换流量指向，环境变量和数据库不跟着回退；迁移已经跑过时，旧代码要能兼容新结构。

部署失败时先看构建日志的最后 50 行。依赖安装失败、类型错误、内存溢出都会在这里暴露；函数运行时的问题不在这份日志里，要去函数日志找。

`vercel inspect` 看构建产物和函数配置，比翻控制台快。`vercel ls` 列最近部署，找到目标后 `vercel inspect <url>` 能看到区域、内存、时长。

日志按函数实例分组，Hobby 保留时间短。排查线上问题时先看构建日志，再看函数日志，最后看平台状态页。

## 47.12 上线前把限制变成命令

五项检查按顺序跑：搜索违规写法、造超限请求、验证图片域名、检查 `output` 配置、确认 Cron 表达式。每项都有明确的通过与失败信号，任何一项失败都不要发。

限制写在文档里容易忘，做成命令每次跑一遍。

先搜代码里不该出现的东西：同步写文件、常驻定时器、进程内缓存、硬编码域名。

```bash
# 本地文件写入：Vercel 上会 EROFS 或不持久
rg -n "writeFile|createWriteStream|mkdirSync|appendFile" src/

# 定时器：函数里不保证执行
rg -n "setInterval" src/

# 进程内缓存：多实例不共享
rg -n "new Map\(|new Set\(" src/

# 硬编码域名：预览环境会跳到生产
rg -n "https://teamstack\.example\.com" src/
```

再造一个超限请求，确认返回 413 而非超时。4.5 MB 是请求体上限，构造 5 MB 的请求最直接。

```bash
# 造一个 5 MB 的请求体
head -c 5000000 /dev/urandom > /tmp/big.bin

# 打你的上传接口，期望 413
curl -sS -o /dev/null -w '%{http_code}\n' \
  -X POST --data-binary @/tmp/big.bin \
  -H 'content-type: application/octet-stream' \
  https://teamstack-abc123.vercel.app/api/upload
```

还需要检查 `next.config.ts` 里的 `output`。写成 `standalone` 时 Vercel 会警告并忽略；平台用自己的产物格式，这项配置只对自托管有意义。

图片域名要提前配。`next/image` 只允许 `remotePatterns` 里的域名，Supabase Storage 的域名要加进去，否则线上图片 400。

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '<project-ref>.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
```

## 47.13 验收

部署完成后按四条命令验收。判据写在命令后面，任何一条不符合就回到对应小节。

```bash
# 1. 首页返回 200，且是 Vercel 在服务
curl -sSI https://teamstack-<hash>-<team>.vercel.app/ | head -n 5

# 2. 健康检查能连上数据库（必须 200 且 ok:true）
curl -sS https://teamstack-<hash>-<team>.vercel.app/api/health

# 3. Cron 没带密钥必须 401，带了才 200
curl -sS -o /dev/null -w '%{http_code}\n' \
  https://teamstack-<hash>-<team>.vercel.app/api/cron/daily-digest
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://teamstack-<hash>-<team>.vercel.app/api/cron/daily-digest

# 4. 主域名没被搬走：仍然解析到 VPS 的 IP
dig +short teamstack.example.com
```

验收通过后不要立刻撤掉 VPS 上的部署。两边并行跑一周，对比错误率与延迟，再决定哪边承接真实流量。

四条命令覆盖四件事：平台是否在服务、主域名是否还在 VPS、预览是否自洽、健康检查是否查库。

验收要留下记录。把四条命令的输出贴进发布单，附上时间；一周后回看，能分清是平台波动还是自己的改动。

判据：Vercel 域名返回 200，且登录流程能走通；主域名解析仍指向 VPS 的 IP；Preview 域名登录后跳转目标仍是 Preview 自身；`/api/health` 返回 `{"ok":true}`。

验收不通过时按顺序排查：先看平台状态页，再看构建日志，最后看函数日志。状态页正常、构建成功、日志有 500，问题在代码或数据库；三者之一异常，问题在平台或配置。

## 47.14 边界与失败模式

下面几种情况在本地测不出来，只在平台上出现。

1. 并发升高后连接被拒。函数实例按请求扩容，每个实例各建一个池，数据库连接数随实例数线性上涨。改法是把池移到实例之外，用平台提供的连接池或 PgBouncer，实例内只留很小的池。
2. 超时被切成两段。函数在 300 秒被终止，客户端重试，写操作执行两次。给写接口加幂等键，键由客户端生成，服务端去重。
3. Preview 与生产共用一套 OAuth 回调。用户在预览地址登录，回调落到生产域名，会话写进了另一个域。两套回调地址要分别登记。
4. 定时任务重叠执行。上一次没跑完，下一次已触发，两条任务处理同一批数据。用数据库行锁或状态字段互斥。
5. 日志过期后无法回溯。Hobby 只保留很短的运行日志，出问题要当天看；需要长期留存的日志要写到自己的库。
6. 请求体超过 4.5 MB 被网关拒绝，应用日志里没有任何记录。这类失败发生在代码之前，只能从响应头与状态码判断。

## 47.15 检查点

1. `curl -sSI https://teamstack.vercel.app` 返回 200，响应头含 `x-vercel-id`。判据：能看到区域标识。
2. 在 Vercel 域名登录一次，再访问主域名，两个会话相互独立。判据：退出其中一个不影响另一个。
3. `dig +short teamstack.example.com` 返回 VPS 的 IP，`dig +short teamstack.vercel.app` 返回平台地址。判据：两个结果不同。
4. 上传一个 6 MB 文件，请求返回 413 或走直传成功，日志里没有 504。判据：不出现函数超时。
5. `vercel logs <deployment> --since 1h` 能看到函数调用记录。判据：有请求进出日志。
6. 触发一次 Cron，路由返回 200 且日志里有 `CRON_SECRET` 校验通过记录。判据：无 401。

## 47.16 常见错误

**1. 导出接口报 `504 FUNCTION_INVOCATION_TIMEOUT`**

现象是请求转圈五分钟，日志只有一行 504。原因是函数执行超过 300 秒被平台终止。改法是把任务拆成分页处理，每页更新游标，或用 Cron 分次跑。

**2. 上传大文件返回 413**

现象是请求还没进业务代码就被拒绝。原因是请求体超过 4.5 MB。改法是改成签名直传：服务端只发签名，浏览器直接 PUT 到 Storage。

**3. `FATAL: remaining connection slots are reserved`**

现象是高峰期数据库连接报满。原因是每个函数实例都建了池，实例数乘以池大小超过上限。改法是把池设在模块级、大小 5、空闲 5 秒，并接连接池端口。

**4. `Failed to decrypt action bound arguments`**

现象是表单提交偶发 500。原因是 Server Action 的加密密钥在实例之间不一致。改法是不要自己覆盖 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`，交给平台管理。

**5. 部署报 Cron 表达式无效**

现象是构建成功、部署失败，提示 schedule 过长。原因是 Hobby 的 Cron 只支持每天一次。改法是改成 `0 1 * * *`，分钟级任务移到 VPS。

**6. Preview 登录后跳回生产域名**

现象是在预览环境点邀请链接，落到主站。原因是链接用写死的域名拼接。改法是统一走 `getAppUrl()`，并把 Preview 域名加进 Supabase 的 Redirect URLs。

## 47.17 这一章在做什么

这一章把 teamstack 放上 Vercel，重点在“哪些能力会失效、怎么改”。函数实例无状态，所以文件要直传、长任务要分页、连接要收敛；平台有三道硬限制，所以导出、备份、转码这些任务留在 VPS。

它建立三条判断。第一，Vercel 适合短请求、静态页面和预览环境，长任务与常驻进程不适合。第二，无状态改造的收益是通用的：直传对象存储和分页任务在自托管上同样更好。第三，平台限制要写成命令和检查，放在发布前跑。

这一章不覆盖 Enterprise 的并发、Log Drain、多区域。Hobby 与 Pro 的差别集中在执行时长、并发和日志保留，升级前按官方定价页核算。

下一章讲 CI/CD。把构建、检查、迁移、发布串成一条流水线，让部署不再依赖某个人记得跑哪几条命令。
