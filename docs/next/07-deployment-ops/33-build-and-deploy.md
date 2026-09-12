# 33 · 构建与部署总览

> **一句话结论**：部署方式的选择只有一个问题：**你的应用需要服务端吗**。需要就是 Node.js 服务器或 Docker（功能全支持），不需要就是静态导出（功能受限）。Vercel 是前者的一键托管形态，Build Adapters API 是让其他平台也能一键的接口，目前还是 Alpha。

## 最小可运行示例

```json
// package.json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

```bash
pnpm build   # 编译 + 预渲染，输出到 .next/
pnpm start   # 启动生产服务器，默认 0.0.0.0:3000
```

这三条就够了。任何支持 Node.js 的环境都能跑：一台 VPS、Railway、Fly.io、Cloud Run、自建 K8s，都一样。

## `next build` 做了什么

构建分六个阶段：

| 阶段 | 内容 |
|---|---|
| 1. Setup | 加载 `.env`、校验 `next.config`、生成 build ID |
| 2. Route discovery | 扫描 `app/` 和 `pages/`，识别 `proxy` / `instrumentation` 等根级约定文件，生成 TS 路由类型 |
| 3. Compilation | 用 Turbopack 打包客户端/服务端代码，转译、tree-shake、优化 CSS 和字体；类型检查并行跑 |
| 4. Static analysis | 给每个路由分类：能预渲染还是按需渲染；收集 `generateStaticParams` 结果；检查阻塞预渲染的错误 |
| 5. Prerendering | 把静态页面和 PPR 外壳预渲染成 HTML；为客户端导航生成 RSC payload |
| 6. Output | 写入 `.next/`；按 `output` 配置决定产物形态；打印路由表 |

第 5 步是最容易出问题的环节。预渲染时如果碰到未缓存的数据访问或请求时 API，会报「prerender-blocking error」：

```
Error: Route "/products/[id]": Next.js encountered uncached or runtime data during prerendering.

`fetch(...)`, `cookies()`, `headers()`, `params`, `searchParams`, or `connection()` accessed
outside of <Suspense> prevents the route from being prerendered...

Ways to fix this:
  - [stream] Provide a placeholder with <Suspense fallback={...}> around the data access
  - [cache] For uncached data (fetch, database calls): cache the access with "use cache"
  - [block] Set `export const instant = false` to allow a blocking route
```

三条修复路径对应三种不同的意图，选哪个取决于你想要的渲染行为：

| 方案 | 效果 | 什么时候用 |
|---|---|---|
| `[stream]` 加 `<Suspense>` | 外壳立即返回，这部分流式传入 | 数据本来就该按请求取，但页面其余部分可以静态 |
| `[cache]` 加 `"use cache"` | 数据进入静态外壳，构建时求值 | 数据变化不频繁，可以接受缓存 |
| `[block]` `export const instant = false` | 整条路由阻塞到数据就绪 | 数据必须按请求取，且不接受流式闪烁 |

调试这类错误用 `next build --debug-prerender`：它会禁用压缩、给服务端 bundle 开 source map、并在首个失败后继续跑，把所有问题一次暴露出来。**这个标志产生的构建禁止部署。**

## 路由表怎么读

```
Route (app)                    Revalidate  Expire
┌ ○ /
├ ○ /_not-found
├ ○ /products                        15m      1y
└   /products/[id]
  ├ ◐ /products/[id]
  ├ ○ /products/1                    15m      1y
  └ ○ /products/2                    15m      1y

○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
ƒ  (Dynamic)            server-rendered on demand
```

| 符号 | 名称 | 部署含义 |
|---|---|---|
| `○` | Static | 构建时生成 HTML，可以放 CDN，无需服务端 |
| `◐` | Partial Prerender | 静态外壳 + 流式动态内容，**必须能跑服务端** |
| `●` | SSG | `generateStaticParams` 生成的静态 HTML |
| `ƒ` | Dynamic | 每次请求服务端渲染，**必须能跑服务端** |

`Revalidate` / `Expire` 两列显示路由包含的**所有缓存中最短的值**。注意它不告诉你哪个缓存产生了这个值——路由里有多个缓存时要逐个查各自的 `cacheLife` 调用。

`size` 和 `First Load JS` 两列在 16 里被移除了，原因见第 30 章。

## output 模式

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}
export default nextConfig
```

| 模式 | 产物 | 功能支持 |
|---|---|---|
| 不设置（默认） | `.next/` + 需要 `node_modules` | 全支持 |
| `'standalone'` | `.next/standalone/`，含最小 `server.js` | 全支持，产物体积大幅缩小 |
| `'export'` | `out/` 纯静态文件 | 受限，见第 34 章 |

**`standalone` 是自托管的标准选择**。它用 `@vercel/nft` 静态分析 `import` / `require` / `fs` 的用法，只把真正需要的文件和 `node_modules` 子集复制进 `.next/standalone/`，部署时不用装依赖。

它不会自动复制 `public/` 和 `.next/static/`——这两个目录官方建议交给 CDN。要自己带就得手动复制：

```bash
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
```

不复制这两个目录的话，页面 HTML 能出来但样式和图片 404。这是 standalone 最常见的坑。

启动：

```bash
node .next/standalone/server.js
# 或指定端口和主机名
PORT=8080 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

monorepo 里 tracing 默认以项目目录为根，`packages/web-app` 之外的文件不会被包含。要包含就得配 `outputFileTracingRoot`：

```js
// packages/web-app/next.config.js
const path = require('path')

module.exports = {
  outputFileTracingRoot: path.join(__dirname, '../../'),
}
```

如果 Next.js 漏掉了必要文件（原生二进制、运行时读取的 JSON），用 `outputFileTracingIncludes` 补；如果多带了无用文件，用 `outputFileTracingExcludes` 排：

```js
// next.config.js
module.exports = {
  outputFileTracingIncludes: {
    '/*': ['node_modules/sharp/**/*'],
    '/api/login/\\[\\[\\.\\.\\.slug\\]\\]': ['./node_modules/aws-crt/dist/bin/**/*'],
  },
  outputFileTracingExcludes: {
    '/api/hello': ['./un-necessary-folder/**/*'],
  },
}
```

键是**路由 glob**（如 `/api/hello`），值是**相对项目根的文件 glob**。这两个选项只影响服务端 trace，不影响不产生 trace 的路由——Edge runtime 路由和完全静态页面不受影响。

> 模式里用正斜杠 `/`，跨平台才一致。另外别在仓库根写 `**/*`，会让 trace 体积爆炸。

详见第 35 章。

## Vercel 部署流程

```bash
# 方式一：CLI
pnpm add -g vercel
vercel

# 方式二：连 Git 仓库，push 即部署
```

Vercel 是 Next.js 的官方托管平台，也是 **verified adapter**（开源、跑完整的 Next.js 兼容测试套件、托管在 Next.js 的 GitHub 组织下）。这意味着它对全部 Next.js 特性的支持是经过验证的，不需要你操心 ISR 存储、图片优化服务、流式渲染的负载均衡配置。

Vercel 上几个自动生效的东西：

- 每个 PR 生成 Preview 部署，独立 URL
- `/_next/image` 的图片优化服务自动可用
- ISR 的缓存存储自动接上（不需要配 `cacheHandler`）
- OpenTelemetry 开箱可用，接上 provider 即可（见第 37 章）
- 静态资源自动上 CDN

代价是这些能力绑在平台上。要迁走，就得自己实现第 35、36 章讲的那些东西。

## Build Adapters API（Alpha）

Next.js 提供了一套构建适配器接口，让托管平台能接入构建流程，自己决定产物怎么组织、怎么部署。

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  adapterPath: require.resolve('./my-adapter.js'),
}

module.exports = nextConfig
```

平台侧也可以设 `NEXT_ADAPTER_PATH` 环境变量实现零配置接入。

| 项 | 状态 |
|---|---|
| 成熟度 | **Alpha**，接口可能变 |
| 配置键 | `adapterPath` |
| 零配置方式 | `NEXT_ADAPTER_PATH` 环境变量 |
| 参考实现 | [`nextjs/adapter-vercel`](https://github.com/nextjs/adapter-vercel) |
| 已验证适配器 | Vercel、Bun |
| 开发中 | Cloudflare、Netlify |

**verified adapter** 的含义值得说清楚：开源、跑完整的兼容性测试套件、托管在 `github.com/nextjs` 组织下、大版本发布前和 Next.js 团队联合测试。这比「平台说自己支持 Next.js」强得多——后者可能只是自己实现了一套集成。

适配器 API 的文档分几块：配置、创建适配器、API 参考、测试适配器、`@next/routing` 路由、在适配器里实现 PPR、runtime 集成、调用入口点、输出类型、路由信息、用例。

**普通项目用不到这个**。它是给平台开发者用的。除非你在做托管平台，或者用的平台要求你配 `adapterPath`，否则不用管。

## 上线前检查清单

### 构建与产物

- [ ] `pnpm build` 本地无错误、无警告
- [ ] 路由表里每条路由的渲染符号符合预期（该静态的没有变成 `ƒ`）
- [ ] 没有预渲染阻塞错误
- [ ] `pnpm next typegen && tsc --noEmit` 通过（`next build` 不再跑 lint，CI 要单独配）
- [ ] `eslint` 通过（`next lint` 已移除）
- [ ] 用 `output: 'standalone'` 时，确认 `public/` 和 `.next/static/` 已复制

### 环境与配置

- [ ] 所有 `.env.*` 文件已进 `.gitignore`
- [ ] 只有确实需要暴露给浏览器的变量用了 `NEXT_PUBLIC_` 前缀
- [ ] `NEXT_PUBLIC_*` 的值在**构建时**就是正确的（它会被冻进 bundle）
- [ ] 需要跨环境变化的值走运行时读取（`await connection()` + 服务端读取）
- [ ] 多实例部署时，`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 在所有实例上一致
- [ ] 配了 `deploymentId` 启用滚动部署的版本偏移保护
- [ ] `images.qualities` 显式列出了需要的档位
- [ ] `images.remotePatterns` 覆盖了所有外部图源（`domains` 已弃用）

### 缓存

- [ ] 每实例内存缓存对多实例部署是否够用（不够就配 `cacheHandler`）
- [ ] 自定义 `cacheHandler` 实现了 `refreshTags()`，标签失效能跨实例传播
- [ ] `revalidateTag()` 都带了第二个参数（cacheLife profile）
- [ ] 需要 read-your-writes 的场景用了 `updateTag()`（仅 Server Actions）

### 运行时

- [ ] Node.js 20.9+
- [ ] 反向代理已配置（nginx 等）：处理畸形请求、慢连接、载荷限制、限流
- [ ] 反向代理**禁用缓冲**以支持流式渲染（nginx 设 `X-Accel-Buffering: no`）
- [ ] 负载均衡器支持分块传输或 HTTP/2 流式
- [ ] 优雅停止：处理 `SIGINT` / `SIGTERM`，等待 10–30 秒排空（`after` 依赖这个）
- [ ] CDN 不会剥离 `rsc` 请求头、不会从缓存键里丢掉 `_rsc` 参数

### 安全

- [ ] `server-only` 包标记了数据访问层
- [ ] 每个 Server Action 和 Route Handler 内部都重新做了授权校验
- [ ] 评估是否启用 CSP（见第 38 章）
- [ ] 评估 `experimental.taint`

### 可观测性

- [ ] `instrumentation.ts` 配好（见第 37 章）
- [ ] 错误上报接入（`onRequestError`）
- [ ] 日志有请求 ID 便于串联

### 性能

- [ ] Lighthouse 跑一遍（无痕模式），结合真实用户数据看 Core Web Vitals
- [ ] 包体积分析过（见第 39 章）

## 常见坑

- **现象**：用 `output: 'standalone'` 部署后页面能打开但没样式、图片 404。
  **原因**：standalone 不会自动复制 `public/` 和 `.next/static/`，官方设计上认为这两个应该走 CDN。
  **解法**：构建后手动复制，或把这两个目录放到 CDN 上。

- **现象**：monorepo 里部署后报找不到模块。
  **原因**：tracing 默认以 Next.js 项目目录为根，仓库里其他包的文件没被包含。
  **解法**：配 `outputFileTracingRoot` 指向 monorepo 根。

- **现象**：本地 `pnpm build` 通过，CI 里失败。
  **原因**：`next build` 不再跑 lint，本地靠 lint 拦截的问题在 CI 里没被拦；或者 CI 的环境变量和本地不一致（尤其 `NEXT_PUBLIC_*`）。
  **解法**：CI 里显式加 `eslint` 和 `tsc --noEmit` 两步；核对构建时的环境变量。

- **现象**：`next build` 报「encountered uncached or runtime data during prerendering」。
  **原因**：预渲染时碰到了未缓存的数据访问或请求时 API。
  **解法**：按错误提示选一条路——加 `<Suspense>`（流式）、加 `"use cache"`（进静态外壳）、或 `export const instant = false`（整条路由阻塞）。

- **现象**：`next build --debug-prerender` 的产物部署上去行为异常。
  **原因**：这个标志会禁用压缩并开 source map，产物不适合部署。
  **解法**：只用它定位问题，部署用正常的 `next build`。

- **现象**：线上流式渲染变成了「等全部数据好了一次性返回」。
  **原因**：反向代理开了响应缓冲，把分块响应攒起来才发。
  **解法**：nginx 里设 `X-Accel-Buffering: no`；确认负载均衡器支持 HTTP/2 或分块传输。

- **现象**：滚动部署期间用户点按钮报「Failed to find Server Action」。
  **原因**：新旧实例的 Server Action 加密密钥不一致。
  **解法**：所有实例用同一个 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`（base64，AES 密钥 16/24/32 字节，Next.js 默认生成 32 字节）；同时配 `deploymentId` 启用版本偏移保护，不匹配时触发整页硬导航而不是报错。

## 旧写法 vs 新写法

| 场景 | 旧写法 | 16 写法 |
|---|---|---|
| 构建产物 | `.next/` 含 `size` / `First Load JS` | 移除，改为 `Revalidate` / `Expire` |
| 部署模式 | `next export` 命令 | **`output: 'export'`**（14 起） |
| 服务端产物 | `target: 'serverless'` | `output: 'standalone'` |
| 平台接入 | 各自实现集成 | **Build Adapters API（Alpha）** |
| 构建期 lint | `next build` 顺带跑 | **不再跑**，CI 单独配 |
| 预渲染错误排查 | 逐个改代码试 | `next build --debug-prerender` |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 13、18 条。

## API / 配置速查

| 命令 / 配置 | 作用 |
|---|---|
| `next build` | 生产构建，默认 Turbopack |
| `next build --webpack` | 用 webpack 构建 |
| `next build --debug` | 更详细输出（含 rewrites / redirects / headers） |
| `next build --debug-prerender` | 暴露所有预渲染错误，**禁止部署** |
| `next build --debug-build-paths=<glob>` | 只构建匹配路由 |
| `next build --profile` | React 生产性能分析 |
| `next start` | 启动生产服务器，默认 3000 端口 |
| `next start --keepAliveTimeout <ms>` | 空闲连接超时 |
| `output: 'standalone'` | 最小化服务端产物 |
| `output: 'export'` | 纯静态导出 |
| `outputFileTracingRoot` | monorepo tracing 根目录 |
| `outputFileTracingIncludes` / `Excludes` | 调整 trace 文件集 |
| `adapterPath` | 平台适配器入口（Alpha） |
| `deploymentId` | 版本偏移保护 |
| `generateBuildId` | 自定义 build ID（设了 `deploymentId` 后失效） |

| 路由表符号 | 部署要求 |
|---|---|
| `○` Static | 静态托管即可 |
| `●` SSG | 静态托管即可 |
| `◐` Partial Prerender | 需要服务端 |
| `ƒ` Dynamic | 需要服务端 |

| 部署方式 | 功能支持 |
|---|---|
| Node.js 服务器 | 全部 |
| Docker 容器 | 全部 |
| 静态导出 | 受限 |
| Adapters | 依平台 |

## 延伸阅读

- [官方文档：Deploying](https://nextjs.org/docs/app/getting-started/deploying)
- [官方文档：Building](https://nextjs.org/docs/app/guides/building)
- [官方文档：output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [官方文档：adapterPath](https://nextjs.org/docs/app/api-reference/config/next-config-js/adapterPath)
- [官方文档：Deploying to Platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms)
- [官方文档：Production Checklist](https://nextjs.org/docs/app/guides/production-checklist)
- [官方示例：with-docker](https://github.com/vercel/next.js/tree/canary/examples/with-docker)
- [官方适配器参考实现：adapter-vercel](https://github.com/nextjs/adapter-vercel)
