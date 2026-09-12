# 45 · Notes App E：文件上传与搜索

> **一句话结论**：**文件不要经过 Server Action 上传**——用服务端签发的预签名 URL 让浏览器直传对象存储。理由是 Server Action 的请求体默认上限 1MB（`serverActions.bodySizeLimit`），改大它等于把「让应用服务器转发大文件」这件事变成常态。搜索同理：**能用数据库全文索引就不要自己 `LIKE`**。

## 最小可运行示例

```prisma
// prisma/schema.prisma（新增片段）
model Attachment {
  id       String @id @default(cuid())
  noteId   String
  note     Note   @relation(fields: [noteId], references: [id], onDelete: Cascade)

  // 对象存储里的 key。数据库只存引用，不存二进制
  key      String @unique
  filename String
  mimeType String
  size     Int

  ownerId  String
  owner    User   @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([noteId])
}
```

```ts
// lib/s3.ts
import 'server-only'

import { S3Client } from '@aws-sdk/client-s3'

export const S3_BUCKET = process.env.S3_BUCKET!

export const s3 = new S3Client({
  region: process.env.S3_REGION!,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})
```

```ts
// app/api/uploads/sign/route.ts
import { NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'node:crypto'
import { getSession } from '@/lib/auth-server'
import { S3_BUCKET, s3 } from '@/lib/s3'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])

export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { filename, contentType, size } = await request.json()

  // 服务端必须重新校验。客户端的 accept / maxSize 只是体验优化
  if (!ALLOWED.has(contentType)) {
    return NextResponse.json({ error: 'unsupported type' }, { status: 415 })
  }
  if (typeof size !== 'number' || size <= 0 || size > MAX_SIZE) {
    return NextResponse.json({ error: 'file too large' }, { status: 413 })
  }

  // key 由服务端生成，不采用客户端传来的文件名：
  // 1. 防止路径穿越（../../）
  // 2. 防止同名覆盖
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'bin'
  const key = `uploads/${session.user.id}/${randomUUID()}.${ext}`

  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
      // 把大小写进签名，超过这个长度的 PUT 会被对象存储拒绝
      ContentLength: size,
    }),
    { expiresIn: 600 }
  )

  return NextResponse.json({ url, key })
}
```

```tsx
// app/notes/[id]/attachment-uploader.tsx
'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { attachFile } from '@/app/actions/attachments'

type Phase = 'idle' | 'signing' | 'uploading' | 'registering' | 'error'

export function AttachmentUploader({ noteId }: { noteId: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setProgress(0)

    try {
      setPhase('signing')
      const res = await fetch('/api/uploads/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? '签名失败')
      }

      const { url, key } = await res.json()

      // 直传对象存储。注意这里用 XMLHttpRequest 而不是 fetch——
      // fetch 至今没有上传进度事件，只有下载进度
      setPhase('uploading')
      await uploadWithProgress(url, file, file.type, setProgress)

      // 上传成功后再登记到数据库。顺序不能反：先登记后上传，
      // 上传失败就会留下一条指向不存在文件的记录
      setPhase('registering')
      const registered = await attachFile(noteId, {
        key,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      })
      if (!registered.ok) throw new Error(registered.message)

      setPhase('idle')
      router.refresh()
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : '上传失败')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        onChange={handleChange}
        disabled={phase === 'signing' || phase === 'uploading' || phase === 'registering'}
      />

      {phase === 'uploading' && (
        <div className="mt-2">
          <progress value={progress} max={100} />
          <span className="ml-2 text-sm text-slate-500">{Math.round(progress)}%</span>
        </div>
      )}
      {phase === 'registering' && <p className="text-sm text-slate-500">登记中…</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}

function uploadWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100)
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`上传失败：${xhr.status}`))
    xhr.onerror = () => reject(new Error('网络错误'))
    xhr.onabort = () => reject(new Error('已取消'))

    xhr.send(file)
  })
}
```

## 为什么用预签名 URL 而不是 Server Action

### 三条路线的对比

| 方案 | 数据流向 | 请求体上限 | 进度条 | 适用 |
|---|---|---|---|---|
| **预签名 URL 直传** | 浏览器 → 对象存储 | 无（对象存储决定） | 有 | 大文件、多文件 |
| Server Action 收 `File` | 浏览器 → 应用服务器 → 对象存储 | **1MB 默认** | 无 | 小文件、需要立刻处理 |
| Route Handler 收 `File` | 同上 | 无默认限制 | 无 | 中等文件、需要自定义状态码 |

### Server Action 的 1MB 限制是硬约束

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

export default nextConfig
```

这个限制的存在理由是**防资源耗尽**：解析一个 100MB 的 `multipart/form-data` 会在服务端占用等量内存和 CPU。放宽它等于把「应用服务器变成文件中转站」。

而且注意官方的一句提醒：**限制作用于原始 HTTP 请求体**，包含 `multipart/form-data` 的边界、分段头和字段元数据。典型的多段上传还有 10–20KB 的额外开销。所以「限制 10MB」实际能传的文件要小一点。

**预签名 URL 完全绕开这个限制**，因为文件根本不经过你的服务器：

```
签发：浏览器 → 你的 Route Handler（几 KB 的 JSON）
上传：浏览器 → 对象存储（文件本体，不经过你的服务器）
登记：浏览器 → 你的 Server Action（几 KB 的 JSON）
```

应用服务器只处理两次小请求。带宽成本和内存成本都转移到对象存储上了。

### 为什么进度条必须用 XHR

`fetch` 规范里有 `ReadableStream` 请求体，但**没有上传进度事件**。`XMLHttpRequest` 有 `xhr.upload.onprogress`。这是目前唯一在浏览器里能拿到上传进度的标准方式。

要注意三点：

- `xhr.upload`（不是 `xhr`）上的 `progress` 事件才是上传进度。`xhr.onprogress` 是下载进度。
- 判断 `e.lengthComputable` 再算百分比。分块传输时它可能是 `false`。
- `onprogress` 是**高频事件**。直接 `setProgress(e.loaded / e.total)` 会触发大量重渲染，生产环境建议做节流。

### 顺序：先上传，后登记

```
上传成功 → 登记数据库      ✅
登记数据库 → 上传          ❌ 上传失败会留下指向空文件的记录
```

反过来的失败模式叫「幽灵记录」：数据库里有一条附件记录，点开是 404。反过来（上传成功但登记失败）只会留下一个**孤儿对象**——它不占数据库、不影响用户，用生命周期规则定期清理即可。

**失败模式的不对称性决定了顺序：永远让「容易清理的那一侧」承担失败。**

## 服务端校验：四道

```ts
// app/actions/attachments.ts
'use server'

import { z } from 'zod'
import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { requireUserId } from '@/lib/auth-server'
import { updateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { S3_BUCKET, s3 } from '@/lib/s3'

const attachSchema = z.object({
  key: z.string().min(1).max(512),
  filename: z.string().min(1).max(255),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']),
  size: z.number().int().positive().max(10 * 1024 * 1024),
})

export async function attachFile(
  noteId: string,
  input: z.input<typeof attachSchema>
): Promise<{ ok: true } | { ok: false; message: string }> {
  const userId = await requireUserId()

  const parsed = attachSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: '附件信息不合法' }

  // 第二道：确认这条笔记确实是当前用户的
  const note = await prisma.note.findFirst({
    where: { id: noteId, authorId: userId },
    select: { id: true },
  })
  if (!note) return { ok: false, message: '笔记不存在或无权修改' }

  // 第三道：key 必须在当前用户的命名空间下。
  // 没有这一条，用户可以填任意 key，把别人上传的文件挂到自己的笔记上
  const expectedPrefix = `uploads/${userId}/`
  if (!parsed.data.key.startsWith(expectedPrefix)) {
    return { ok: false, message: '非法的文件路径' }
  }

  // 第四道（可选但推荐）：向对象存储确认对象真的存在、大小一致。
  // 客户端可以跳过上传直接调这个 action
  try {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: S3_BUCKET, Key: parsed.data.key })
    )
    if (head.ContentLength !== parsed.data.size) {
      return { ok: false, message: '文件大小不一致' }
    }
  } catch {
    return { ok: false, message: '文件不存在' }
  }

  await prisma.attachment.create({
    data: {
      noteId,
      ownerId: userId,
      key: parsed.data.key,
      filename: parsed.data.filename,
      mimeType: parsed.data.mimeType,
      size: parsed.data.size,
    },
  })

  updateTag(`note:${noteId}`)
  return { ok: true }
}
```

四道校验缺一不可，尤其是**第三道**（key 前缀）。它对应的是 44 章讲过的那类漏洞：主资源校验了归属，关联资源没校验。这里 `noteId` 校验了，`key` 没有——用户就能把 `uploads/别人ID/xxx.png` 挂到自己笔记上。

**关于 MIME 校验的诚实说明**：`contentType` 是客户端传的，不可信。真正的防线是**对象存储桶策略**（只允许特定 Content-Type）和**下载时的 `Content-Disposition: attachment`**（防止上传 HTML 被当作页面执行，即存储型 XSS）。如果要做内容级校验（比如确认 PNG 真的是 PNG），需要在服务端读文件头（magic bytes）——那要求文件经过你的服务器，和直传方案冲突。所以直传方案里，**桶策略是安全边界**。

## 全文搜索

### 为什么不用 `LIKE`

```ts
// 能用，但会随数据量线性退化
prisma.note.findMany({
  where: { authorId, title: { contains: query, mode: 'insensitive' } },
})
```

`contains` 生成的是 `LIKE '%query%'`。**前导通配符让索引完全失效**——数据库只能全表扫描。一万条笔记时还行，一百万条就是几秒。

### PostgreSQL 全文索引

```sql
-- prisma/migrations/<timestamp>_add_search/migration.sql
-- 1. 生成列：title 权重 A，content 权重 B
ALTER TABLE "Note" ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'B')
  ) STORED;

-- 2. GIN 索引
CREATE INDEX note_search_idx ON "Note" USING GIN (search_vector);
```

```ts
// lib/dal/search.ts
import 'server-only'

import { prisma } from '@/lib/db'

export type SearchHit = {
  id: string
  title: string
  updatedAt: string
  rank: number
}

export async function searchNotes(
  authorId: string,
  query: string,
  options: { cursor?: string; take?: number } = {}
): Promise<{ hits: SearchHit[]; nextCursor: string | null }> {
  const take = options.take ?? 20

  // $queryRaw 的参数化写法（模板字符串）会生成真正的绑定参数，
  // 不是字符串拼接——这里不存在 SQL 注入
  const rows = await prisma.$queryRaw<
    Array<{ id: string; title: string; updatedAt: Date; rank: number }>
  >`
    SELECT id,
           title,
           "updatedAt",
           ts_rank(search_vector, q) AS rank
    FROM "Note", websearch_to_tsquery('simple', ${query}) q
    WHERE "authorId" = ${authorId}
      AND archived = false
      AND search_vector @@ q
      AND (${options.cursor ?? null}::text IS NULL OR id < ${options.cursor ?? null})
    ORDER BY rank DESC, "updatedAt" DESC
    LIMIT ${take + 1}
  `

  const hasMore = rows.length > take
  const page = hasMore ? rows.slice(0, take) : rows

  return {
    hits: page.map((r) => ({
      id: r.id,
      title: r.title,
      updatedAt: r.updatedAt.toISOString(),
      rank: r.rank,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  }
}
```

三个技术选择值得解释：

**`websearch_to_tsquery` 而不是 `to_tsquery`。** 前者接受类似搜索引擎的语法（`"精确短语"`、`OR`、`-排除`），并且**不会因为语法错误而抛异常**。后者遇到 `foo &&` 这种输入直接报错，用户输入一个 `&` 就 500。

**`simple` 配置而不是 `english`。** `english` 配置会做词干还原（`running` → `run`）并过滤停用词——对英文很好，对中文完全无效，因为 Postgres 默认的分词器按空格切词。`simple` 只做小写化，行为更可预测。

**`ts_rank` 排序而不是按时间。** 全文搜索的价值在于相关性。标题命中（权重 A）应该排在正文命中（权重 B）前面——`setweight` 就是在做这件事。

### 中文搜索的现实

**PostgreSQL 默认配置不能正确切分中文。** 一整句中文会被当成一个 token。可行的方案：

| 方案 | 代价 |
|---|---|
| `pg_trgm` + `GIN` 三元组索引 | 对中文短文本效果尚可，索引体积大 |
| `zhparser` / `pg_jieba` 扩展 | 需要自托管数据库，托管服务通常装不了 |
| Meilisearch / Typesense | 多一个服务，但中文开箱可用 |
| 应用层分词后写入 `search_vector` | 要自己维护词典和更新逻辑 |

**本项目的取舍**：先用 `simple` 配置把管线搭起来（英文/代码片段可用），中文搜索留到数据量真的需要时再引入外部引擎。不要一开始就上 Meilisearch——多一个服务的运维成本是实打实的。

## 分页：游标而不是 offset

搜索和列表都用游标分页，理由在 41 章讲过——offset 分页在数据插入时会**重复或跳过**，搜索场景下更明显：翻到第二页时刚好有新笔记写入，`OFFSET 20` 会漏掉一条。唯一代价是不能跳页，对笔记和搜索来说不是问题。

```tsx
// app/notes/search/page.tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { searchNotes } from '@/lib/dal/search'
import { requireUserId } from '@/lib/auth-server'

export default async function SearchPage({
  searchParams,
}: PageProps<'/notes/search'>) {
  // searchParams 的值类型是 string | string[] | undefined —— 同一个 key
  // 出现多次时是数组。逐个归一化，不要直接断言成 string
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q : ''
  const cursor = typeof sp.cursor === 'string' ? sp.cursor : undefined

  return (
    <section>
      <form className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="搜索笔记…"
          className="flex-1 rounded border px-3 py-2"
        />
        <button className="rounded bg-slate-900 px-4 py-2 text-white">搜索</button>
      </form>

      <Suspense key={`${q}:${cursor ?? ''}`} fallback={<p>搜索中…</p>}>
        <Results q={q} cursor={cursor} />
      </Suspense>
    </section>
  )
}

async function Results({ q, cursor }: { q: string; cursor?: string }) {
  if (!q.trim()) return <p className="text-slate-500">输入关键词开始搜索</p>

  const userId = await requireUserId()
  const { hits, nextCursor } = await searchNotes(userId, q, { cursor })

  if (hits.length === 0) return <p className="text-slate-500">没有匹配的笔记</p>

  return (
    <>
      <ul className="divide-y divide-slate-200">
        {hits.map((hit) => (
          <li key={hit.id} className="py-3">
            <Link href={`/notes/${hit.id}`} className="hover:underline">
              {hit.title}
            </Link>
          </li>
        ))}
      </ul>
      {nextCursor && (
        <Link
          href={`/notes/search?q=${encodeURIComponent(q)}&cursor=${nextCursor}`}
          className="mt-4 inline-block text-sm hover:underline"
        >
          下一页 →
        </Link>
      )}
    </>
  )
}
```

`<Suspense key={...}>` 上的 `key` 是关键：`q` 变化时强制重建边界，否则 React 会复用上一个边界，用户看不到 loading 状态。

## 常见坑

- **现象**：上传 2MB 的图片报错 `Body exceeded 1 MB limit`。
  **原因**：Server Action 的请求体默认上限是 1MB。
  **解法**：首选改成预签名 URL 直传（文件不经服务器）。确实要用 Server Action 收文件时，配 `experimental.serverActions.bodySizeLimit: '2mb'`，并给 multipart 的额外开销留 10–20KB 余量。

- **现象**：进度条一直是 0 或者不显示。
  **原因**：用了 `fetch` 的 `onUploadProgress`——**这个 API 不存在**。`fetch` 没有上传进度事件。
  **解法**：改用 `XMLHttpRequest` 并监听 `xhr.upload.onprogress`（注意是 `xhr.upload`，不是 `xhr`）。先判断 `e.lengthComputable`。

- **现象**：数据库里有附件记录，点开却 404。
  **原因**：先登记数据库、后上传文件。上传失败就留下了「幽灵记录」。
  **解法**：顺序改成「先上传成功，再登记」。孤儿对象比幽灵记录容易清理得多，用桶的生命周期规则定期删即可。

- **现象**：用户能把别人上传的文件挂到自己的笔记上。
  **原因**：`noteId` 校验了归属，`key` 没有。客户端可以填任意 key。
  **解法**：校验 key 的**前缀**必须是 `uploads/${userId}/`。更进一步，把前缀写进签名时的 bucket policy，让对象存储层面也拒绝越界写入。

- **现象**：搜索接口在用户输入 `&` 或 `(` 时直接 500。
  **原因**：用了 `to_tsquery`，它要求输入是合法的 tsquery 语法，非法输入抛异常。
  **解法**：改用 `websearch_to_tsquery`，它接受自然语言输入且不会因语法错误报错。

- **现象**：搜索中文完全没有结果。
  **原因**：PostgreSQL 默认分词器按空格切词，整句中文是一个 token；`english` 配置还会做英文词干还原，对中文无效。
  **解法**：短期用 `pg_trgm` + 三元组索引做模糊匹配；需要真正的分词时引入 Meilisearch / Typesense，或自托管并安装 `zhparser`。托管数据库通常装不了扩展，这是选型时要先确认的。

- **现象**：`$queryRaw` 里用字符串拼接参数，被安全审计标为 SQL 注入。
  **原因**：只有**模板字符串形式**的 `$queryRaw` 会生成绑定参数。`$queryRawUnsafe(sqlString)` 不会。
  **解法**：一律用 `` prisma.$queryRaw`...${value}...` `` 的标签模板写法。需要动态表名/列名时（绑定参数做不到），用白名单枚举，不要拼字符串。

- **现象**：上传大文件时用户刷新页面，对象存储里留下了半个文件。
  **原因**：`PUT` 被中断，对象存储可能留下不完整对象。
  **解法**：大文件用**分片上传**（multipart upload），未完成的分片用生命周期规则自动清理。10MB 以内的单次 `PUT` 足够。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 读取查询参数 | `function Page({ searchParams }: { searchParams: { q?: string } })` | `const { q } = await searchParams` |
| 上传大文件 | 全部经 `pages/api` 转发 | **预签名 URL 直传对象存储** |
| 上传进度 | 无标准做法 | `XMLHttpRequest` 的 `xhr.upload.onprogress` |
| 分页 | `OFFSET` / `LIMIT` | **游标分页**（`cursor` + `skip: 1`） |
| 模糊搜索 | `LIKE '%q%'` | **`tsvector` + GIN 索引 + `websearch_to_tsquery`** |
| 图片域名白名单 | `images.domains` | **`images.remotePatterns`**（若用 `next/image` 渲染附件） |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7、9 条。

## API / 配置速查

| API / 配置 | 签名 | 说明 |
|---|---|---|
| `serverActions.bodySizeLimit` | `string \| number`，默认 `'1mb'` | Server Action 请求体上限，含 multipart 开销 |
| `getSignedUrl(client, command, opts)` | `Promise<string>` | `opts.expiresIn` 单位秒，默认 900 |
| `PutObjectCommand` | `{ Bucket, Key, ContentType, ContentLength }` | `ContentLength` 写进签名可限制实际大小 |
| `HeadObjectCommand` | `{ Bucket, Key }` | 确认对象存在并读取 `ContentLength` |
| `xhr.upload.onprogress` | `(e: ProgressEvent) => void` | **唯一**能拿到上传进度的标准方式 |
| `websearch_to_tsquery(config, text)` | `tsquery` | 自然语言输入，语法错误不抛异常 |
| `ts_rank(vector, query)` | `float4` | 相关性打分，配合 `setweight` 使用 |
| `setweight(vector, 'A'\|'B'\|'C'\|'D')` | `tsvector` | 字段权重，`A` 最高 |
| `GENERATED ALWAYS AS (...) STORED` | 列定义 | 生成列，写入时自动计算，可建索引 |

| 上传路线 | 请求体上限 | 进度 | 推荐场景 |
|---|---|---|---|
| 预签名 URL 直传 | 对象存储决定 | 有 | **默认选它** |
| Server Action | 1MB（可配） | 无 | 小文件、需要立刻处理 |
| Route Handler | 无默认上限 | 无 | 需要自定义状态码 |

## 延伸阅读

- [官方文档：Data Security](https://nextjs.org/docs/app/guides/data-security)
- [官方文档：`serverActions` 配置](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)
- [官方文档：Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [PostgreSQL 文档：全文搜索](https://www.postgresql.org/docs/current/textsearch-controls.html)
- [PostgreSQL 文档：`websearch_to_tsquery`](https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-PARSING-QUERIES)
- [Prisma 文档：Raw queries](https://www.prisma.io/docs/orm/prisma-client/queries/raw-database-access/raw-queries)
- [AWS SDK for JavaScript v3：预签名 URL](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
- [MDN：`XMLHttpRequest.upload`](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload)
