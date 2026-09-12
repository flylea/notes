# 28 · 环境变量 / 别名 / 段配置

> **一句话结论**：环境变量默认只在服务端可见，只有 `NEXT_PUBLIC_` 前缀的会被**在构建时字面量替换**进浏览器 bundle——这意味着它的值在 `next build` 那一刻就冻住了，同一个镜像换环境也不会变。`serverRuntimeConfig` / `publicRuntimeConfig` 已移除（**v15 起就移除了，不是 16 引入的**）。路由段配置里的 `dynamic` / `revalidate` / `fetchCache` 在启用 `cacheComponents` 后被移除。

## 最小可运行示例

```bash
# .env —— 会被提交，放非敏感的默认值
DB_HOST=localhost
DB_USER=myuser
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

```bash
# .env.local —— 不提交（已在 .gitignore），放本机密钥
DB_PASS=dev-only-password
```

```ts
// app/api/users/route.ts
export async function GET() {
  // 服务端可直接读，不经过任何前缀规则
  const db = await connect({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
  })
  return Response.json(await db.query('select 1'))
}
```

```tsx
// app/site-footer.tsx
'use client'

export function SiteFooter() {
  // NEXT_PUBLIC_ 前缀的变量在客户端可用
  return <a href={process.env.NEXT_PUBLIC_SITE_URL}>回首页</a>
}
```

`NEXT_PUBLIC_` 之外的所有变量在客户端**根本不存在**——不是值为 `undefined`，是打包后那段代码里压根没有这个引用。

## 加载顺序

变量按下面顺序查找，**找到即停**：

| 顺序 | 文件 | 说明 |
|---|---|---|
| 1 | `process.env` | 真实的进程环境变量，优先级最高 |
| 2 | `.env.$(NODE_ENV).local` | 如 `.env.development.local` |
| 3 | `.env.local` | **`NODE_ENV=test` 时不加载** |
| 4 | `.env.$(NODE_ENV)` | 如 `.env.production` |
| 5 | `.env` | 兜底默认值 |

`NODE_ENV` 只有三个合法值：`production`、`development`、`test`。不手动指定时，`next dev` 自动设成 `development`，其余命令设成 `production`。

`.env.local` 在测试环境被跳过，理由很直接：测试要对所有人产出同样结果，而 `.env.local` 是个人的本地覆盖，加载它会让「我这儿能过」变成常态。对应地，`.env.test` 应该提交进仓库，`.env.test.local` 不该。

`.env*` 文件里的 `$` 会被展开成变量引用：

```bash
# .env
TWITTER_USER=nextjs
TWITTER_URL=https://x.com/$TWITTER_USER
# process.env.TWITTER_URL === 'https://x.com/nextjs'
```

真的想用字面量 `$` 就转义成 `\$`。

在 Next.js 运行时之外（ORM 配置、测试 runner）读环境变量，用 `@next/env`：

```ts
// envConfig.ts
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())
```

```ts
// orm.config.ts
import './envConfig'

export default defineConfig({
  dbCredentials: { connectionString: process.env.DATABASE_URL! },
})
```

## `NEXT_PUBLIC_` 的边界

`NEXT_PUBLIC_` 做的事是**文本替换**，不是运行时注入：

```tsx
// app/analytics.tsx
'use client'

import { setup } from '@/lib/analytics'

// 打包后这行变成 setup('abcdefghijk')
setup(process.env.NEXT_PUBLIC_ANALYTICS_ID)
```

替换只对**字面量成员访问**生效。下面两种写法不会被替换：

```tsx
// app/analytics.tsx
'use client'

// 用变量做键 —— 不会内联，客户端拿到 undefined
const varName = 'NEXT_PUBLIC_ANALYTICS_ID'
setup(process.env[varName])

// 先把整个 process.env 取出来 —— 也不会内联
const env = process.env
setup(env.NEXT_PUBLIC_ANALYTICS_ID)
```

打包器做的是静态分析：它只认识 `process.env.NEXT_PUBLIC_XXX` 这个精确的语法形状。一旦键名是运行时才确定的值，替换就没法做。

**这条规则推出来的最重要后果**：`NEXT_PUBLIC_` 的值在构建时被写死。构建一个 Docker 镜像部署到 staging 和 production，两边的 `NEXT_PUBLIC_*` 是同一个值。要按环境变，只能在构建时传参，或者干脆不走 `NEXT_PUBLIC_`。

## 运行时环境变量

需要「一个镜像跑多环境」时，用动态渲染在请求时读：

```ts
// app/config/page.ts
import { connection } from 'next/server'

export default async function Page() {
  // 显式等待请求到来，把路由标记为动态
  await connection()
  const value = process.env.MY_VALUE
  return <p>{value}</p>
}
```

`connection()` 的作用是声明「这里依赖请求时上下文」。没有它，Next.js 会在构建时就把 `process.env.MY_VALUE` 求值并写进静态 HTML——那你就又回到了构建时冻结。

同样的效果也可以由 `cookies()`、`headers()` 触发，它们都是请求时 API。

> 注意区分：`NEXT_PUBLIC_` 变量即使写在动态渲染的组件里也**不会**变成运行时读取。内联发生在打包阶段，早于渲染。

## `serverRuntimeConfig` / `publicRuntimeConfig` 已移除

```js
// next.config.js —— 已移除，不要这么写
module.exports = {
  serverRuntimeConfig: { dbPassword: process.env.DB_PASS },
  publicRuntimeConfig: { siteUrl: process.env.SITE_URL },
}
```

这两个配置项的设计意图是「把配置从构建时挪到运行时」，让同一个构建产物能适配不同环境。移除的原因是它们和 App Router 的渲染模型冲突：App Router 大量使用构建时预渲染，预渲染出来的 HTML 里已经嵌了值，运行时配置无从生效。用环境变量替代，行为反而更可预测。

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 10 条。

> **版本溯源**：这两项**不是 16 才移除的**，从 **v15** 起就已经移除。写笔记或做迁移方案时别把它算进 16 的破坏性变更清单，否则会误导升级排期。

| 旧写法 | 新写法 |
|---|---|
| `serverRuntimeConfig.dbPassword` | `process.env.DB_PASS`（服务端读） |
| `publicRuntimeConfig.siteUrl` | `process.env.NEXT_PUBLIC_SITE_URL`（客户端读） |

## 路径别名

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"]
    }
  }
}
```

```ts
// src/app/page.tsx
// Before: import { Button } from '../../../components/button'
import { Button } from '@/components/button'
```

`paths` 里的路径都相对于 `baseUrl`。改了别名配置后**要重启 dev server**——`tsconfig.json` 的路径映射在启动时读一次。

`create-next-app` 默认生成 `@/*`。别名同时作用于 TypeScript 类型解析和打包器解析，两边都读同一份 `tsconfig.json`，所以不需要额外配打包器。

## `src/` 目录

```
my-app/
├─ src/
│  ├─ app/            # 路由（从根目录移进来）
│  ├─ components/
│  └─ proxy.ts        # Proxy 也要放进 src
├─ public/            # 留在根目录
├─ .env.local         # 留在根目录
├─ next.config.ts     # 留在根目录
└─ tsconfig.json      # 留在根目录
```

规则很简单：**`app/` 及其同级应用代码进 `src/`，配置和静态资源留在根目录。**

几个容易忘的点：

- 用 `src/` 后，`@/*` 别名要指向 `./src/*`，否则所有导入都断。
- 用 Tailwind 时，`content` 配置要加 `/src` 前缀。
- `src/app` 和根目录 `app` 同时存在时，**`src/app` 被忽略**——这是个静默行为，容易出现「改了没生效」的困惑。
- `.env.*` 文件**只从根目录读**，放 `src/` 里读不到。

## 路由段配置

路由段配置是在 `page.tsx` / `layout.tsx` / `route.ts` 里直接 `export` 的常量：

```ts
// app/dashboard/page.tsx
export const dynamic = 'force-dynamic'
export const revalidate = 60

export default function Page() {
  return <h1>Dashboard</h1>
}
```

| 选项 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `dynamicParams` | boolean | `true` | 未由 `generateStaticParams` 生成的动态段是否按需渲染 |
| `runtime` | `'nodejs' \| 'edge'` | `'nodejs'` | **`'edge'` 已弃用** |
| `preferredRegion` | string \| string[] | `'auto'` | **已弃用** |
| `maxDuration` | number | 由部署平台决定 | 函数最长执行时间 |

以下是**旧缓存模型**的配置项，启用 `cacheComponents` 后被移除：

| 选项 | 取值 | 说明 |
|---|---|---|
| `dynamic` | `'auto'` \| `'force-dynamic'` \| `'error'` \| `'force-static'` | 强制路由动态/静态 |
| `revalidate` | `false` \| `0` \| number | 路由默认重验证秒数 |
| `fetchCache` | `'auto'` 等 7 个值 | 控制段内所有 `fetch` 的缓存策略 |

`revalidate` 的值必须**可静态分析**：`export const revalidate = 600` 合法，`export const revalidate = 60 * 10` 会被拒绝——框架需要在编译期读出这个数字。

### `cacheComponents` 之后的变化

```ts
// app/products/page.tsx
// 启用 cacheComponents 后，这些导出会被移除
export const dynamic = 'force-dynamic'
export const revalidate = 60
export const fetchCache = 'force-no-store'
```

16.0.0 的版本记录写得很明确：`dynamic`、`dynamicParams`、`revalidate`、`fetchCache` 在启用 Cache Components 时被移除。取代它们的是**显式的缓存指令**：

```tsx
// app/products/page.tsx
import { Suspense } from 'react'
import { getProducts } from '@/lib/data'

export default function Page() {
  return (
    // 动态内容放进 Suspense 边界，其余部分进静态外壳
    <Suspense fallback={<p>加载中…</p>}>
      <Products />
    </Suspense>
  )
}

async function Products() {
  const products = await getProducts()
  return <ul>{products.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
}
```

```ts
// lib/data.ts
import { cacheLife, cacheTag } from 'next/cache'

export async function getProducts() {
  'use cache'
  cacheLife('hours')
  cacheTag('products')
  return db.products.findMany()
}
```

设计动机是**去掉隐式**。旧模型里「这个页面到底是静态还是动态」要靠一套复杂规则推断（`fetch` 的 `cache` 选项、是否用到请求时 API、段配置的继承与合并……），规则本身就成了 bug 来源。新模型里，不写缓存就是动态，写了 `"use cache"` 才是缓存——判断依据从「推断」变成「阅读」。

`runtime = 'edge'` 在 `cacheComponents` 下同样弃用：Cache Components 需要 Node.js runtime。

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 3 条。

## 常见坑

- **现象**：`NEXT_PUBLIC_API_URL` 在客户端打印出来是 `undefined`。
  **原因**：可能是用变量做键（`process.env[key]`）导致没被内联；也可能这个变量只在 `.env.local` 里定义，而构建环境没读到它。
  **解法**：改成字面量 `process.env.NEXT_PUBLIC_API_URL`；确认变量在构建时可读——`NEXT_PUBLIC_` 的值是在 `next build` 时确定的，运行时再设已经晚了。

- **现象**：同一个 Docker 镜像在 staging 和 production 里 `NEXT_PUBLIC_*` 值一样，改不掉。
  **原因**：`NEXT_PUBLIC_` 在构建时被字面量替换，值被冻进 bundle。
  **解法**：改成运行时读取——用 `connection()` 把路由标记为动态，然后在服务端读普通环境变量，通过 props 传给客户端。

- **现象**：`process.env.DB_PASS` 在客户端组件里是 `undefined`，明明 `.env.local` 里有。
  **原因**：没有 `NEXT_PUBLIC_` 前缀的变量只存在于 Node 环境。
  **解法**：不要把它暴露给客户端。如果确实需要，走一个 Route Handler 或 Server Action 转发，别把密钥内联进 bundle。

- **现象**：`.env.test` 里定义的变量在跑测试时没生效，反而读到了 `.env.local` 的值。
  **原因**：`NODE_ENV=test` 时 `.env.local` **不加载**，但 `.env` 和 `.env.test` 会加载。顺序反了会读错值。
  **解法**：确认测试 runner 设了 `NODE_ENV=test`，并把测试专用值放 `.env.test`（提交进仓库）。

- **现象**：启用 `cacheComponents` 后构建报错，说 `export const dynamic` 不被支持。
  **原因**：`dynamic` / `revalidate` / `fetchCache` 在 Cache Components 下被移除。
  **解法**：删掉这些导出，改用 `"use cache"` 显式缓存 + `<Suspense>` 划分动态边界。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 3 条。

- **现象**：把应用代码挪进 `src/` 后，所有 `@/` 导入报「找不到模块」。
  **原因**：`tsconfig.json` 的 `paths` 还指向 `./*`，没加上 `src/` 前缀。
  **解法**：把 `paths` 改成 `{ "@/*": ["./src/*"] }`，重启 dev server。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 运行时配置 | `serverRuntimeConfig` / `publicRuntimeConfig` | **已移除**（v15 起）→ 环境变量 |
| 强制动态渲染 | `export const dynamic = 'force-dynamic'` | `<Suspense>` 边界（`cacheComponents` 下） |
| 路由级重验证 | `export const revalidate = 60` | `cacheLife('hours')` + `"use cache"` |
| 段级 fetch 策略 | `export const fetchCache = '...'` | 移除，用 `"use cache"` |
| Edge runtime | `export const runtime = 'edge'` | **弃用**，Cache Components 需 Node.js |
| 显式声明请求依赖 | — | `await connection()` |
| 段配置静态校验 | — | `next typegen` 生成类型后编辑器提示 |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 3、10 条。

## API / 配置速查

| 环境变量 / 文件 | 作用 |
|---|---|
| `.env` | 默认值，提交进仓库 |
| `.env.local` | 本地覆盖，不提交；`NODE_ENV=test` 时跳过 |
| `.env.development` / `.env.production` | 按 `NODE_ENV` 加载 |
| `.env.test` | 测试环境，提交进仓库 |
| `NEXT_PUBLIC_*` | 构建时内联进浏览器 bundle |
| `NODE_ENV` | `production` \| `development` \| `test` |
| `NEXT_RUNTIME` | `nodejs` \| `edge`，用于 `instrumentation` 分支 |

| 路由段配置 | 类型 | 默认 | `cacheComponents` 下 |
|---|---|---|---|
| `dynamicParams` | boolean | `true` | 移除 |
| `dynamic` | 4 个枚举值 | `'auto'` | 移除 |
| `revalidate` | `false \| 0 \| number` | `false` | 移除 |
| `fetchCache` | 7 个枚举值 | `'auto'` | 移除 |
| `runtime` | `'nodejs' \| 'edge'` | `'nodejs'` | `'edge'` 弃用 |
| `preferredRegion` | string \| string[] | `'auto'` | 已弃用 |
| `maxDuration` | number | 平台决定 | 保留 |
| `instant` | boolean | — | 新增，`false` 允许阻塞路由 |

## 延伸阅读

- [官方文档：Environment Variables](https://nextjs.org/docs/app/guides/environment-variables)
- [官方文档：Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)
- [官方文档：src Folder](https://nextjs.org/docs/app/api-reference/file-conventions/src-folder)
- [官方文档：TypeScript 路径别名](https://nextjs.org/docs/app/api-reference/config/typescript)
- [官方文档：Caching and Revalidating（旧模型）](https://nextjs.org/docs/app/guides/caching-without-cache-components)
- [官方文档：connection()](https://nextjs.org/docs/app/api-reference/functions/connection)
