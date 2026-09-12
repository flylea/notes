# 30 · 开发环境与调试

> **一句话结论**：`next dev` 的输出目录改成了 `.next/dev`，和 `next build` 彻底分开——所以两者现在**可以同时跑**。代价是新增了锁文件机制，同一项目起第二个实例会被拒。另一个容易踩的变化：配置文件在 dev 下**只加载一次**，`process.argv` 里也不再包含 `'dev'`。

## 最小可运行示例

```bash
# 同时跑 dev 和 build —— 16 起合法
pnpm dev &
pnpm build
```

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev -- --inspect"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    },
    {
      "name": "Next.js: debug full stack",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/next/dist/bin/next",
      "runtimeArgs": ["--inspect"],
      "skipFiles": ["<node_internals>/**"],
      "serverReadyAction": {
        "action": "debugWithEdge",
        "killOnServerStop": true,
        "pattern": "- Local:.+(https?://.+)",
        "uriFormat": "%s",
        "webRoot": "${workspaceFolder}"
      }
    }
  ]
}
```

按 `F5` 选配置即可。`debugWithEdge` 换成 `debugWithChrome` 就用 Chrome。monorepo 里要给服务端和 full stack 两个配置加 `"cwd": "${workspaceFolder}/apps/web"`。

## 为什么输出目录要分开

15 及以前，`next dev` 和 `next build` 都往 `.next` 里写。并发跑会互相覆盖产物——dev 的 HMR 清单被 build 覆写、build 的预渲染结果被 dev 的增量编译冲掉，症状是随机的白屏或 404，很难定位。

16 把 dev 的输出挪到 `.next/dev`：

| | 输出目录 |
|---|---|
| `next dev` | `.next/dev` |
| `next build` | `.next` |

两个目录互不干扰，所以并发执行是安全的。`next typegen` 也跟着走：开发时写 `.next/dev/types`，生产时写 `.next/types`。

这个改动解决的是一个很具体的开发场景：**在跑着 dev server 的同时验证生产构建**。以前必须停掉 dev 才能 build，现在不用。

配套加了锁文件：同一项目上起第二个 `next dev` 或第二个 `next build` 会被拒绝。这条是为了防止端口冲突和缓存互相踩。如果你确实要跑多实例（比如同时跑两个不同端口做对比），得用不同的项目目录或 `distDir`。

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 16 条。

## 配置文件只加载一次

15 及以前，Next.js 在 dev 中会把 `next.config.ts` 加载两次：一次在主进程，一次在 dev server 子进程。16 改成只加载一次。

这个改动让下面这类代码行为变了：

```ts
// next.config.ts —— 16 下行为不对
import type { NextConfig } from 'next'

// 16 起 process.argv 里不再有 'dev'
const isDev = process.argv.includes('dev')

const nextConfig: NextConfig = {
  reactStrictMode: isDev,
}
export default nextConfig
```

`process.argv` 里不再包含 `'dev'`（`typegen` 和 `build` 仍然可见），所以 `isDev` 恒为 `false`。

正确写法有两种：

```ts
// next.config.ts —— 方案一：用 NODE_ENV
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: process.env.NODE_ENV === 'development',
}
export default nextConfig
```

```ts
// next.config.ts —— 方案二：用 phase 参数
import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants'

export default (phase: string): NextConfig => ({
  reactStrictMode: phase === PHASE_DEVELOPMENT_SERVER,
})
```

`phase` 更精确——它区分的是「加载配置的阶段」而不是「Node 环境变量」，能区分 `PHASE_DEVELOPMENT_SERVER`、`PHASE_PRODUCTION_BUILD`、`PHASE_PRODUCTION_SERVER` 等。`NODE_ENV` 只能区分三档。

**更重要的原则**：不要在配置文件里写副作用。因为加载次数变了，副作用执行次数也跟着变——「加载配置时顺便创建数据库连接池」「顺便写一个临时文件」这类代码在 16 下会少执行一次。

## 构建输出变了

```bash
pnpm build
```

16 的路由表长这样：

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

**`size` 和 `First Load JS` 两列被移除了。** 原因不是「不想给你看」，而是这两个数字在 RSC 架构下没有意义：服务端组件不进入客户端 bundle，一个路由的「体积」取决于服务端/客户端的切分方式，单一数字既不能反映首屏下载量，也不能反映执行成本。留着它只会引导人做错误的优化（为了压小数字而把服务端组件改成客户端组件）。

取代它们的是 `Revalidate` / `Expire` 两列，显示路由包含的**所有缓存中最短的那个** `revalidate` 和 `expire` 值。即使没显式调 `cacheLife`，缓存也会用 `default` profile，所以这两列基本总会出现。

四个符号的含义：

| 符号 | 名称 | 行为 |
|---|---|---|
| `○` | Static | 构建时完全预渲染 |
| `◐` | Partial Prerender | 静态外壳立即返回，动态内容流式传入 |
| `●` | SSG | 预渲染的静态 HTML（来自 `generateStaticParams`） |
| `ƒ` | Dynamic | 每次请求服务端渲染 |

启用 `cacheComponents` 后，`◐` 成为默认渲染模型，路由落在一个从 `○` 到 `◐` 的连续谱上。**只有完全没有任何可预渲染内容的路由才显示 `ƒ`**（如依赖请求的 Route Handler、Proxy、动态 metadata 图像）。

需要看包体积就换工具，见第 39 章。

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 18 条附表。

## 调试方法

### 服务端代码

```bash
pnpm dev --inspect
```

`--inspect` 会透传给底层 Node 进程。看到这行就说明调试器起来了：

```
Debugger listening on ws://127.0.0.1:9229/0cf90313-...
ready - started server on 0.0.0.0:3000
```

然后打开 `chrome://inspect`，在 Remote Target 里找到应用，点 inspect。搜索源文件时路径前缀是 `webpack://{应用名}/./`。

Docker 容器里要远程调试，用 `--inspect=0.0.0.0`。

`--inspect-brk` / `--inspect-wait` 不能直接传给 `next`，要经 `NODE_OPTIONS`：

```bash
NODE_OPTIONS=--inspect-brk next dev
```

### 客户端代码

跑 `next dev`，在浏览器 DevTools 的 Sources 面板（Chrome）或 Debugger 面板（Firefox）里 `Ctrl/⌘ + P` 搜文件。源文件路径前缀是 `webpack://_N_E/./`。任何 `debugger` 语句都会让执行暂停。

React 相关的问题装 [React Developer Tools](https://react.dev/learn/react-developer-tools)：能检查组件树、改 props 和 state、定位性能问题。

### 服务端错误的快捷入口

出错时错误覆盖层上会有一个 Node.js 图标，在 Next.js 版本号下方。点它会**把 DevTools 的 URL 复制到剪贴板**，开个新标签页就能直接调试 Next.js 服务端进程——不用手动去 `chrome://inspect` 找。

### Windows 上的性能陷阱

Windows Defender 会检查**每一次文件读取**，官方确认这会显著拉长 `next dev` 的 Fast Refresh 时间。这是 Windows 的问题不是 Next.js 的问题，但确实影响开发体验。把项目目录和 `node_modules` 加进 Defender 的排除列表能明显改善。

## 内存排查

```bash
# 采集 CPU profile，退出时写入 .next-profiles/
pnpm dev --experimental-cpu-prof
pnpm build --experimental-cpu-prof
```

生成的 `.cpuprofile` 文件用 Chrome DevTools 的 Performance 面板 → Load profile 打开。文件名按命令区分：

| 命令 | 文件名前缀 |
|---|---|
| `next dev` | `dev-main-*`、`dev-server-*` |
| `next build`（Turbopack） | `build-main-*`、`build-turbopack-*` |
| `next build`（webpack） | `build-main-*`、`build-webpack-client-*` 等 |
| `next start` | `start-main-*` |

排查内存时重点看 `dev-server-*`（dev）和 `build-turbopack-*`（build），主进程通常只是调度。

服务端内存问题的常见来源是模块级缓存：

```ts
// lib/cache.ts —— 危险：模块级 Map 在 dev 下不随 HMR 清理
const cache = new Map<string, unknown>()

export function remember<T>(key: string, compute: () => T): T {
  if (!cache.has(key)) cache.set(key, compute())
  return cache.get(key) as T
}
```

模块级 `Map` 在热更新时可能被保留，反复改文件会持续堆积。生产环境同理，多个实例各自持有全量缓存，内存随数据量线性增长。要限制大小就用 LRU 或干脆换成外部缓存。

另外注意 `next build` 的峰值内存：预渲染大量静态页面时所有页面并发渲染，内存占用会显著高于运行时。CI 里给构建步骤留足内存，或用 `--debug-build-paths` 缩小范围排查。

## Next.js DevTools MCP

```json
// .mcp.json —— 放在项目根目录
{
  "mcpServers": {
    "next-devtools": {
      "command": "npx",
      "args": ["-y", "next-devtools-mcp@latest"]
    }
  }
}
```

要求 Next.js 16+。配好之后启动 dev server，MCP 会自动发现并连上运行中的实例。

原理：Next.js 16 在 `/_next/mcp` 暴露了一个内置 MCP 端点，跑在 dev server 里。`next-devtools-mcp` 这个包负责发现端点、转发调用、给编码助手提供统一接口。它还能连多个端口上的多个实例。

助手能用的工具：

| 工具 | 作用 |
|---|---|
| `get_errors` | 拉取当前的构建错误、运行时错误、类型错误 |
| `get_logs` | 拿到开发日志文件路径（含浏览器 console 输出和服务端输出） |
| `get_page_metadata` | 查询某个页面的路由、组件、渲染信息 |
| `get_project_metadata` | 项目结构、配置、dev server URL |
| `get_routes` | 扫描文件系统列出所有路由入口，按 router 类型分组 |
| `get_server_action_by_id` | 用 ID 反查 Server Action 的源文件和函数名 |
| `get_compilation_issues` | 整个项目的编译警告和错误（**仅 Turbopack**） |
| `compile_route` | 按需编译指定路由，不发 HTTP 请求（**仅 Turbopack**） |

除了运行时状态，它还做了一件对 AI 工作流很关键的事：**把助手指向你安装版本自带的文档**（`node_modules/next/dist/docs/`）。这解决的是「模型按训练数据里的旧版本写代码」的问题——它读到的是你实际在跑的版本的文档。`next upgrade` 会顺带更新这份内置文档。

典型用法：

```
你：现在应用里有哪些错误？
```

助手会调 `get_errors`，拿到错误列表后给出修复方案。比「贴错误信息给它」强的地方在于：它能拿到构建错误、运行时错误、类型错误三类，以及浏览器会话的 console 输出。

排查顺序上，先 `get_errors` 看有什么，再 `get_page_metadata` 确认渲染路径，最后 `compile_route` 单独验证某条路由——不用靠改代码 + 刷页面来试。

## 常见坑

- **现象**：`next dev` 报错说已有实例在运行，但你没开第二个终端。
  **原因**：16 新增的锁文件机制；可能是上一次进程没退干净（`Ctrl+C` 没生效，或后台进程残留）。
  **解法**：找到并结束残留的 node 进程。不要直接删锁文件——先确认没有活着的实例。

- **现象**：`next.config.ts` 里 `process.argv.includes('dev')` 判断环境，dev 下走了生产分支。
  **原因**：16 的配置文件在 dev 中只加载一次，且 `process.argv` 里不再包含 `'dev'`。
  **解法**：改用 `process.env.NODE_ENV === 'development'` 或函数式配置的 `phase` 参数。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 16 条。

- **现象**：`next build` 的表格里找不到 `First Load JS`，以为构建配置坏了。
  **原因**：16 移除了 `size` 和 `First Load JS` 两列。
  **解法**：需要分析包体积用 `next experimental-analyze`，见第 39 章。

- **现象**：改了 `next.config.ts` 但 dev server 行为没变。
  **原因**：配置文件只在启动时加载一次。
  **解法**：重启 dev server。注意这也意味着**不要**把会变化的值放在配置文件里，用环境变量。

- **现象**：`--inspect-brk` 传给 `next dev` 报未知参数。
  **原因**：`--inspect-brk` / `--inspect-wait` 不是 `next` 的参数。
  **解法**：用 `NODE_OPTIONS=--inspect-brk next dev`。

- **现象**：MCP 助手连不上应用。
  **原因**：dev server 没启动、`.mcp.json` 没配、或 Next.js 版本低于 16。
  **解法**：确认 `pnpm dev` 在跑；确认 `.mcp.json` 在项目根目录；重启 dev server；确认编码助手已加载 MCP 配置。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| dev 输出目录 | `.next`（与 build 共用） | **`.next/dev`** |
| dev + build 并发 | 会互相覆盖，不可行 | **可行** |
| 多实例 | 无保护 | **锁文件机制** |
| 配置加载次数 | dev 下加载两次 | **只加载一次** |
| `process.argv` | 含 `'dev'` | **不含** |
| 构建输出 | 含 `size` / `First Load JS` | **移除**，改为 `Revalidate` / `Expire` |
| AI 助手接入 | 无 | **Next.js DevTools MCP** |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 16、18 条。

## API / 配置速查

| 命令 / 参数 | 作用 |
|---|---|
| `next dev` | 开发服务器，输出到 `.next/dev` |
| `next dev --inspect` | 开启 Node 调试器 |
| `next dev --experimental-cpu-prof` | 采集 CPU profile 到 `.next-profiles/` |
| `next build --debug-prerender` | 预渲染错误逐个暴露，**禁止用于部署** |
| `next build --debug-build-paths=<glob>` | 只构建匹配的路由，用于定位问题 |
| `NODE_OPTIONS=--inspect-brk next dev` | 在首行暂停 |
| `next internal trace <file>` | 生成 Turbopack tracing |

| 路由表符号 | 含义 |
|---|---|
| `○` Static | 构建时完全预渲染 |
| `◐` Partial Prerender | 静态外壳 + 流式动态内容 |
| `●` SSG | `generateStaticParams` 生成的静态 HTML |
| `ƒ` Dynamic | 按请求服务端渲染 |

| MCP 工具 | 作用 |
|---|---|
| `get_errors` | 构建 / 运行时 / 类型错误 |
| `get_logs` | 开发日志文件路径 |
| `get_page_metadata` | 页面路由、组件、渲染信息 |
| `get_project_metadata` | 项目结构与配置 |
| `get_routes` | 列出所有路由入口 |
| `get_server_action_by_id` | 反查 Server Action 源文件 |
| `get_compilation_issues` | 全项目编译问题（仅 Turbopack） |
| `compile_route` | 按需编译单条路由（仅 Turbopack） |

## 延伸阅读

- [官方文档：Debugging](https://nextjs.org/docs/app/guides/debugging)
- [官方文档：Building](https://nextjs.org/docs/app/guides/building)
- [官方文档：Next.js MCP Server](https://nextjs.org/docs/app/guides/mcp)
- [官方文档：next CLI](https://nextjs.org/docs/app/api-reference/cli/next)
- [next-devtools-mcp 仓库](https://github.com/vercel/next-devtools-mcp)
- [官方文档：Local Development](https://nextjs.org/docs/app/guides/local-development)
